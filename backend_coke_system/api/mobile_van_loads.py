"""Confirm mobile orders into a durable, idempotent van-load handoff."""

from collections import defaultdict
from decimal import Decimal
import hashlib
import json

from django.db import DatabaseError, connections, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .mobile_inventory import _adjust, _quantities, sync_mobile_inventory
from .mobile_orders import (
    MobileOrderConfirmSerializer, MobileOrderConflict, MobileOrdersUnavailable,
    _request_warehouse, _source_warehouse_id, _status, process_mobile_orders, read_mobile_orders,
)
from .models import Merchandising, MobileOrderStockCommitment, MobileVanLoadBatch, Product
from .pos_auth import CanProcessMobileOrders, POSSessionAuthentication
from .serializers import MerchandisingSerializer


def batch_quantities(batch):
    quantities = defaultdict(int)
    for receipt in batch.orders.order_by("order_number"):
        if not receipt.active:
            raise MobileOrderConflict("An order in this van load was cancelled.")
        for product_id, quantity in receipt.quantities.items():
            quantities[product_id] += quantity
    return dict(quantities)


def batch_data(batch):
    quantities = batch_quantities(batch)
    products = Product.objects.filter(pk__in=quantities, warehouse=batch.warehouse).select_related("unit_type", "price")
    numbers = list(batch.orders.order_by("order_number").values_list("order_number", flat=True))
    per_order = dict(batch.orders.values_list("order_number", "quantities"))
    _, source_orders = read_mobile_orders(batch.warehouse, limit=100, order_numbers=numbers)
    return {
        "id": str(batch.pk), "warehouse": batch.warehouse_id,
        "order_numbers": numbers,
        "orders": [{"order_number": order["order_number"], "number": order["mobile_order_number"], "customer": order["customer_name"], "quantities": per_order[order["order_number"]]} for order in source_orders],
        "outcomes": batch.return_outcomes,
        "sale_id": batch.merchandising_id,
        "status": "PROCESSING",
        "items": [{
            "product_id": product.pk, "product_name": product.product_name,
            "quantity": quantities[str(product.pk)],
            "content_no": product.unit_type.content_no if product.unit_type else None,
        } for product in products.order_by("pk")],
    }


def prepare_van_load(warehouse, order_numbers, user):
    numbers = sorted(order_numbers)
    # Commit the POS receipt before the source transaction exits. If source
    # history fails, this durable batch lets the same selection resume safely.
    with transaction.atomic(using="mobile_orders"):
        source = connections["mobile_orders"]
        with source.cursor() as cursor:
            source_id = _source_warehouse_id(cursor, warehouse)
            placeholders = ", ".join(["%s"] * len(numbers))
            lock = " FOR UPDATE" if source.features.has_select_for_update else ""
            cursor.execute(
                f"SELECT msp_no, status FROM merchandising WHERE warehouse_id = %s "
                f"AND msp_no IN ({placeholders}) ORDER BY msp_no{lock}", [source_id, *numbers],
            )
            orders = dict(cursor.fetchall())
            if len(orders) != len(numbers):
                raise NotFound("One or more orders were not found in this warehouse.")
            if any(_status(value) not in {"NEW", "PENDING", "CONFIRMED", "PROCESSING"} for value in orders.values()):
                raise MobileOrderConflict("Only orders awaiting dispatch can be loaded into a van.")
            if any(number.startswith("MOCK-") for number in numbers):
                raise MobileOrderConflict("Test orders cannot be dispatched.")
            with transaction.atomic():
                type(warehouse).objects.select_for_update().get(pk=warehouse.pk)
                receipts = list(MobileOrderStockCommitment.objects.select_for_update().filter(
                    warehouse=warehouse, order_number__in=numbers,
                ))
                batch_ids = {receipt.van_load_batch_id for receipt in receipts if receipt.van_load_batch_id}
                if batch_ids:
                    if len(batch_ids) != 1:
                        raise MobileOrderConflict("These orders already belong to different van loads.")
                    batch = MobileVanLoadBatch.objects.select_for_update().get(pk=batch_ids.pop())
                    if set(batch.orders.values_list("order_number", flat=True)) != set(numbers):
                        raise MobileOrderConflict("Select all orders from the existing van load to resume it.")
                    if batch.merchandising_id:
                        return batch_data(batch)
                else:
                    batch = MobileVanLoadBatch.objects.create(warehouse=warehouse, created_by=user)
                existing = {receipt.order_number: receipt for receipt in receipts}
                for number in numbers:
                    receipt = existing.get(number)
                    if receipt:
                        if not receipt.active or receipt.quantities != _quantities(cursor, number, warehouse):
                            raise MobileOrderConflict("An order changed after its inventory was committed.")
                    else:
                        # Confirmation reserves inventory once for both legacy
                        # orders and verified AIVA warehouse reservations.
                        sync_mobile_inventory(cursor, source_id, warehouse, {number: "PENDING"}, "CONFIRMED", user)
                MobileOrderStockCommitment.objects.filter(
                    warehouse=warehouse, order_number__in=numbers,
                ).update(van_load_batch=batch)
                process_mobile_orders(warehouse, numbers, "PROCESSING", user, van_load_batch=batch)
            return batch_data(batch)


class MobileVanLoadView(APIView):
    authentication_classes = [POSSessionAuthentication]
    permission_classes = [CanProcessMobileOrders]

    def handle_exception(self, exc):
        if isinstance(exc, DatabaseError):
            exc = MobileOrdersUnavailable("The van-load handoff could not finish. Retry the same selection to resume it safely.")
        return super().handle_exception(exc)


class MobileVanLoadPrepareView(MobileVanLoadView):
    def post(self, request):
        warehouse = _request_warehouse(request)
        serializer = MobileOrderConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        response = Response(prepare_van_load(warehouse, serializer.validated_data["order_numbers"], request.user))
        response["Cache-Control"] = "no-store"
        return response


class MobileVanLoadDispatchView(MobileVanLoadView):
    @transaction.atomic
    def post(self, request, batch_id):
        warehouse = _request_warehouse(request)
        type(warehouse).objects.select_for_update().get(pk=warehouse.pk)
        batch = get_object_or_404(MobileVanLoadBatch.objects.select_for_update(), pk=batch_id, warehouse=warehouse)
        if batch.merchandising_id:
            return Response(MerchandisingSerializer(batch.merchandising).data)
        quantities = batch_quantities(batch)
        serializer = MerchandisingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["warehouse"] != warehouse or data["transaction_type"].name.strip().lower() != "van load":
            raise ValidationError("Use Van Load in this order's warehouse.")
        if data["route"].warehouse_id != warehouse.pk or data["van"].warehouse_id != warehouse.pk:
            raise ValidationError("Choose a route and van from this warehouse.")
        lines = data.get("items", [])
        sent = {}
        for line in lines:
            pid = str(line["product"].pk)
            if pid in sent or line["product"].warehouse_id != warehouse.pk:
                raise ValidationError("Select each product once from this warehouse.")
            sent[pid] = line.get("dispatched_pcs", 0)
        if sent != quantities:
            raise ValidationError("Keep the products and quantities from the selected mobile orders.")
        # A draft may have survived a failed source history write. Verify that
        # synchronization finished before dispatching its already reserved stock.
        numbers = list(batch.orders.values_list("order_number", flat=True))
        with connections["mobile_orders"].cursor() as cursor:
            source_id = _source_warehouse_id(cursor, warehouse)
            placeholders = ", ".join(["%s"] * len(numbers))
            cursor.execute(f"SELECT msp_no, status FROM merchandising WHERE warehouse_id = %s AND msp_no IN ({placeholders})", [source_id, *numbers])
            statuses = {number: _status(value) for number, value in cursor.fetchall()}
        if any(statuses.get(number) != "PROCESSING" for number in numbers):
            raise MobileOrderConflict("Confirm this selection again to finish its Processing status before dispatch.")
        for line in lines:
            for field in ("sold_pcs", "sold_shell", "empty_return_pcs", "empty_return_shell", "actual_return_pcs", "actual_return_shell",
                          "discrepancy_empties_pc", "discrepancy_empties_shell", "discrepancy_full_pcs", "discrepancy_full_shell", "expected_sale", "actual_sale"):
                line[field] = 0
        sale = serializer.save(status="Pending", expected_sale=0, actual_sale=0, full_returns_applied=False)
        batch.merchandising = sale
        batch.save(update_fields=["merchandising"])
        # These reservations now travel with the van; they must not become a
        # second completed sale or release the inventory transferred to it.
        Merchandising.objects.filter(pk__in=batch.orders.values_list("merchandising_id", flat=True)).update(status="Transferred to Van Load")
        return Response(MerchandisingSerializer(sale).data, status=201)


class MobileVanLoadDetailView(MobileVanLoadView):
    def get(self, request, batch_id):
        warehouse = _request_warehouse(request)
        batch = get_object_or_404(MobileVanLoadBatch, pk=batch_id, warehouse=warehouse)
        response = Response(batch_data(batch))
        response["Cache-Control"] = "no-store"
        return response


class ReturnLineSerializer(serializers.Serializer):
    productId = serializers.IntegerField(min_value=1)
    sold_pcs = serializers.IntegerField(min_value=0)
    sold_shell = serializers.IntegerField(min_value=0, default=0)
    actual_return_pcs = serializers.IntegerField(min_value=0)
    actual_return_shell = serializers.IntegerField(min_value=0, default=0)
    empty_return_pcs = serializers.IntegerField(min_value=0)
    empty_return_shell = serializers.IntegerField(min_value=0, default=0)
    discrepancy_empties_pc = serializers.IntegerField(min_value=0, default=0)
    discrepancy_empties_shell = serializers.IntegerField(min_value=0, default=0)
    discrepancy_full_pcs = serializers.IntegerField(min_value=0, default=0)
    discrepancy_full_shell = serializers.IntegerField(min_value=0, default=0)
    discount = serializers.DecimalField(max_digits=5, decimal_places=2, min_value=Decimal(0), max_value=Decimal(100), default=Decimal(0))
    actual_sale = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal(0))


class MobileVanLoadReturnView(MobileVanLoadView):
    def post(self, request, batch_id):
        # Persist the return receipt first. A source-history failure then retries
        # only fulfillment updates, never inventory/empties movements.
        with transaction.atomic(using="mobile_orders"):
            response, batch = self.record(request, batch_id)
            for target in ("DELIVERED", "RETURNED"):
                numbers = [number for number, outcome in batch.return_outcomes.items() if outcome == target]
                if numbers:
                    process_mobile_orders(batch.warehouse, numbers, target, request.user, van_load_batch=batch)
        return response

    @transaction.atomic
    def record(self, request, batch_id):
        warehouse = _request_warehouse(request)
        batch = get_object_or_404(MobileVanLoadBatch.objects.select_for_update(), pk=batch_id, warehouse=warehouse)
        if not batch.merchandising_id:
            raise MobileOrderConflict("Save the van load before declaring its returns.")
        sale = Merchandising.objects.select_for_update().get(pk=batch.merchandising_id)
        fingerprint = hashlib.sha256(json.dumps(request.data, sort_keys=True).encode()).hexdigest()
        if batch.return_fingerprint:
            if batch.return_fingerprint != fingerprint:
                raise MobileOrderConflict("Returns were already declared. Refresh this van load before making corrections.")
            return Response({"sale_id": sale.pk, "status": sale.status}), batch
        lines = ReturnLineSerializer(data=request.data.get("products", []), many=True)
        lines.is_valid(raise_exception=True)
        quantities = batch_quantities(batch)
        if len(lines.validated_data) != len(quantities) or {str(line["productId"]) for line in lines.validated_data} != set(quantities):
            raise ValidationError("Declare sold products and returns for every product in this van load once.")
        outcomes = request.data.get("order_outcomes", {})
        receipts = list(batch.orders.all())
        if not isinstance(outcomes, dict) or set(outcomes) != {receipt.order_number for receipt in receipts} or any(value not in {"DELIVERED", "RETURNED"} for value in outcomes.values()):
            raise ValidationError("Mark every mobile order as Accepted or Returned.")
        sold = defaultdict(int)
        returned = defaultdict(int)
        for receipt in receipts:
            target = sold if outcomes[receipt.order_number] == "DELIVERED" else returned
            for pid, quantity in receipt.quantities.items():
                target[pid] += quantity
        for line in lines.validated_data:
            pid = str(line["productId"])
            if line["sold_pcs"] != sold[pid] or line["actual_return_pcs"] != returned[pid]:
                raise ValidationError("Sold and returned full pieces must match the Accepted/Returned orders.")
        adjustment = {}
        for line in lines.validated_data:
            pid = str(line.pop("productId"))
            if line["sold_pcs"] + line["actual_return_pcs"] + line["discrepancy_full_pcs"] != quantities[pid]:
                raise ValidationError("Sold pieces, returned full pieces and missing pieces must equal the dispatched quantity.")
            item = sale.items.select_related("product").get(product_id=pid)
            line["discount_percent"] = line.pop("discount")
            for field, value in line.items():
                setattr(item, field, value)
            item.expected_sale = (item.selling_price * quantities[pid] * (1 - item.discount_percent / 100)).quantize(Decimal("0.01"))
            item.save()
            adjustment[pid] = item.actual_return_pcs
            serializer = MerchandisingSerializer()
            serializer._adjust_returnable_stock(item.product, warehouse, item.empty_return_pcs, item.empty_return_shell)
        _adjust(warehouse, adjustment, 1)
        money_fields = {
            "expected_sale": "total_expected_sale", "actual_sale": "actual_sale",
            "discrepancy_empty": "discrepancy_empty_total", "discrepancy_non_empty": "discrepancy_non_empty_total",
            "empties_price_total": "empties_price_total", "empty_returns": "empty_returns",
            "returned_with_content": "returned_with_content",
        }
        for field, key in money_fields.items():
            value = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=Decimal(0)).run_validation(request.data.get(key, 0))
            setattr(sale, field, value)
        sale.remarks = str(request.data.get("remarks", ""))
        sale.full_returns_applied = True
        sale.save()
        batch.return_fingerprint = fingerprint
        batch.return_outcomes = outcomes
        batch.save(update_fields=["return_fingerprint", "return_outcomes"])
        return Response({"sale_id": sale.pk, "status": sale.status}), batch
