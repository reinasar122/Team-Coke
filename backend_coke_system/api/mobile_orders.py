"""Read mobile purchases and process their fulfillment in the source database."""

from collections import defaultdict
from datetime import timezone as datetime_timezone
from decimal import Decimal, ROUND_HALF_UP
import logging
from urllib.parse import urljoin, urlparse

from django.conf import settings
from django.db import connections, DatabaseError, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException, NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import LimitOffsetPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import MobileDeliveryOrder, MobileOrderStockCommitment, Warehouse
from .pos_auth import CanProcessMobileOrders, CanViewMobileOrders, POSSessionAuthentication, is_pos_admin


logger = logging.getLogger(__name__)


class MobileOrdersDatabaseRouter:
    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if db == "mobile_orders":
            return False
        return None


def _rows(cursor):
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def _image_url(value):
    if not value:
        return None
    if urlparse(value).scheme in {"http", "https"}:
        return value
    base = settings.MOBILE_ORDERS_MEDIA_BASE_URL
    return urljoin(base.rstrip("/") + "/", value) if base else None


def _timestamp(value):
    if value is None:
        return None
    # Both backends store their timezone-aware dates as UTC in MySQL.
    if timezone.is_naive(value):
        value = timezone.make_aware(value, datetime_timezone.utc)
    return value.isoformat()


def _source_warehouse_id(cursor, warehouse):
    """Match warehouses by name; the two databases may assign different IDs."""
    cursor.execute(
        "SELECT id FROM warehouse WHERE LOWER(TRIM(name)) = LOWER(TRIM(%s))",
        [warehouse.name],
    )
    warehouse_ids = [row[0] for row in cursor.fetchall()]
    if not warehouse_ids:
        return None
    if warehouse.pk in warehouse_ids:
        return warehouse.pk
    if len(warehouse_ids) == 1:
        return warehouse_ids[0]
    raise ValueError("Mobile warehouse mapping is ambiguous.")


def _request_warehouse(request):
    requested_id = request.query_params.get("warehouse") or request.headers.get("X-Warehouse-ID")
    warehouse_id = request.user.warehouse_id
    if requested_id is not None:
        try:
            warehouse_id = int(requested_id)
            if warehouse_id <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValidationError({"warehouse": "Choose a valid warehouse."})
    if not is_pos_admin(request.user) and warehouse_id != request.user.warehouse_id:
        raise PermissionDenied("You can only access your assigned warehouse's mobile purchases.")
    warehouse = Warehouse.objects.filter(pk=warehouse_id).first()
    if warehouse is None:
        raise ValidationError({"warehouse": "Choose a valid warehouse."})
    if "mobile_orders" not in connections.databases:
        raise MobileOrdersUnavailable("Mobile purchases are not connected yet.")
    return warehouse


def _order_address_sql():
    """Read the checkout address stored by mobile core/orders.py in the receipt.

    Keep this expression shared by lists, details, and address filters. The
    customer's profile/default address can change after an order was placed.
    SUBSTR/INSTR work on both the source MySQL DB and isolated SQLite tests.
    """
    prefix = "[AIVA:________-____-____-____-____________] Deliver to: "
    start = len(prefix) + 1  # SQL strings are one-indexed.
    return (
        "COALESCE(NULLIF(TRIM(CASE "
        f"WHEN m.remarks LIKE '{prefix}%%; Delivery slot: %%' "
        f"THEN SUBSTR(m.remarks, {start}, INSTR(m.remarks, '; Delivery slot: ') - {start}) "
        "END), ''), NULLIF(TRIM(c.address), ''), '')"
    )


def read_mobile_orders(warehouse, limit=50, offset=0, order_number=None, address="", processed=False, order_numbers=None):
    source = connections["mobile_orders"]
    with source.cursor() as cursor:
        source_warehouse_id = _source_warehouse_id(cursor, warehouse)
        if source_warehouse_id is None:
            return 0, []
        where = "m.warehouse_id = %s"
        params = [source_warehouse_id]
        order_address = _order_address_sql()
        if order_number is not None:
            where += " AND m.msp_no = %s"
            params.append(order_number)
        if order_numbers is not None:
            if not order_numbers:
                return 0, []
            where += " AND m.msp_no IN (" + ", ".join(["%s"] * len(order_numbers)) + ")"
            params.extend(order_numbers)
        if address:
            where += f" AND LOWER({order_address}) LIKE LOWER(%s) ESCAPE '!'"
            search = address.replace("!", "!!").replace("%", "!%").replace("_", "!_")
            params.append(f"%{search}%")
        if processed:
            where += " AND UPPER(REPLACE(REPLACE(m.status, '-', '_'), ' ', '_')) IN (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
            params.extend(["CONFIRMED", "ORDER_CONFIRMED", "PROCESSING", "IN_PROGRESS", "OUT_FOR_DELIVERY", "SHIPPED", "COMPLETED", "DELIVERED", "PICKED_UP", "COMPLETE", "RETURNED"])
        cursor.execute(
            f"SELECT COUNT(*) FROM merchandising m LEFT JOIN customer c ON c.id = m.customer_id WHERE {where}", params,
        )
        count = cursor.fetchone()[0]
        # Older mobile databases may not have the public-number migration yet.
        # Keep orders readable while retaining their source identifiers.
        has_references = 'mobile_order_reference' in source.introspection.table_names(cursor)
        reference_column = 'r.id' if has_references else 'NULL'
        reference_join = ('LEFT JOIN mobile_order_reference r ON r.source_order_id = m.msp_no'
                          if has_references else '')
        cursor.execute(
            f"""
            SELECT m.msp_no, {reference_column} AS mobile_reference_id, m.status, m.expected_sale AS total_amount,
                   m.date_time AS created_at, c.name AS customer_name,
                   c.address AS customer_address, {order_address} AS order_address
            FROM merchandising m
            {reference_join}
            LEFT JOIN customer c ON c.id = m.customer_id
            WHERE {where}
            ORDER BY m.date_time DESC, m.msp_no DESC
            LIMIT %s OFFSET %s
            """,
            [*params, limit, offset],
        )
        orders = _rows(cursor)
        if not orders:
            return count, []

        order_numbers = [order["msp_no"] for order in orders]
        placeholders = ", ".join(["%s"] * len(order_numbers))
        cursor.execute(
            f"""
            SELECT i.id, i.msp_no, i.product_id, i.sold_pcs AS quantity,
                   i.selling_price AS unit_price, i.discount_percent,
                   p.product_name AS name, p.image_url
            FROM merchandising_item i
            JOIN product p ON p.id = i.product_id
            WHERE i.msp_no IN ({placeholders})
            ORDER BY i.id
            """,
            order_numbers,
        )
        products = defaultdict(list)
        for item in _rows(cursor):
            order_number = item.pop("msp_no")
            # Use the price saved at checkout, even if catalog prices change.
            # actual_sale may still be zero for orders awaiting fulfillment.
            price = Decimal(str(item["unit_price"]))
            discount = Decimal(str(item["discount_percent"] or 0))
            line_total = price * item["quantity"] * (1 - discount / 100)
            item["unit_price"] = str(price.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            item["discount_percent"] = str(discount)
            item["line_total"] = str(line_total.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
            item["image_url"] = _image_url(item["image_url"])
            products[order_number].append(item)

    deliveries = {
        item.order_number: item.delivery
        for item in MobileDeliveryOrder.objects.filter(
            warehouse=warehouse, order_number__in=order_numbers,
        ).select_related("delivery")
    }
    van_load_receipts = list(MobileOrderStockCommitment.objects.filter(
            warehouse=warehouse, order_number__in=order_numbers, van_load_batch__isnull=False,
        ).select_related("van_load_batch__merchandising"))
    van_loads = {receipt.order_number: receipt.van_load_batch for receipt in van_load_receipts}
    van_load_fees = {}
    batch_ids = {receipt.van_load_batch_id for receipt in van_load_receipts}
    if batch_ids:
        batch_order_numbers = defaultdict(list)
        for batch_id, number in MobileOrderStockCommitment.objects.filter(
            warehouse=warehouse, van_load_batch_id__in=batch_ids,
        ).order_by("van_load_batch_id", "order_number").values_list("van_load_batch_id", "order_number"):
            batch_order_numbers[batch_id].append(number)

        batches = {receipt.van_load_batch_id: receipt.van_load_batch for receipt in van_load_receipts}
        for batch_id, numbers in batch_order_numbers.items():
            delivery_fee = batches[batch_id].merchandising.delivery_fee if batches[batch_id].merchandising_id else Decimal("0.00")
            total_cents = int((delivery_fee * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
            cents_per_order, remainder = divmod(total_cents, len(numbers))
            for index, number in enumerate(numbers):
                share_cents = cents_per_order + (1 if index < remainder else 0)
                van_load_fees[number] = Decimal(share_cents) / 100

    return count, [
        {
            "order_number": order["msp_no"],
            "mobile_order_number": f'MO-{order["mobile_reference_id"]:04d}' if order["mobile_reference_id"] else order["msp_no"],
            "customer_name": order["customer_name"] or "",
            "customer_address": order["customer_address"] or "",
            "order_address": order["order_address"],
            "status": order["status"],
            "total_amount": str(order["total_amount"]),
            "created_at": _timestamp(order["created_at"]),
            "is_test": order["msp_no"].startswith("MOCK-"),
            "products": products[order["msp_no"]],
            "delivery_id": str(deliveries[order["msp_no"]].pk) if order["msp_no"] in deliveries else None,
            "delivery_address": deliveries[order["msp_no"]].address if order["msp_no"] in deliveries else None,
            "delivery_fee": str(
                van_load_fees.get(
                    order["msp_no"],
                    deliveries[order["msp_no"]].delivery_fee_per_order
                    if order["msp_no"] in deliveries else Decimal("0.00"),
                )
            ),
            "van_load_batch_id": str(van_loads[order["msp_no"]].pk) if order["msp_no"] in van_loads else None,
            "van_load_sale_id": van_loads[order["msp_no"]].merchandising_id if order["msp_no"] in van_loads else None,
        }
        for order in orders
    ]


class MobileOrderPagination(LimitOffsetPagination):
    default_limit = 50
    max_limit = 100


class MobileOrderListView(APIView):
    authentication_classes = [POSSessionAuthentication]
    permission_classes = [CanViewMobileOrders]

    def get(self, request):
        warehouse = _request_warehouse(request)
        address = serializers.CharField(max_length=1000, allow_blank=True).run_validation(
            request.query_params.get("address", ""),
        )
        processed = serializers.BooleanField().run_validation(request.query_params.get("processed", False))

        pagination = MobileOrderPagination()
        pagination.request = request
        pagination.limit = pagination.get_limit(request)
        pagination.offset = pagination.get_offset(request)
        try:
            pagination.count, orders = read_mobile_orders(
                warehouse, pagination.limit, pagination.offset, address=address, processed=processed,
            )
        except (DatabaseError, ValueError):
            logger.exception("Unable to read the mobile-order database.")
            return Response({"detail": "Mobile purchases are temporarily unavailable. Please try again."}, status=503)
        response = pagination.get_paginated_response(orders)
        response["Cache-Control"] = "no-store"
        return response


class MobileOrdersUnavailable(APIException):
    status_code = 503
    default_detail = "Mobile purchases are temporarily unavailable. Please try again."


class MobileOrderConflict(APIException):
    status_code = 409
    default_detail = "The order changed. Refresh mobile purchases and try again."


STATUS_TRANSITIONS = {
    "NEW": {"CONFIRMED", "CANCELLED"},
    "PENDING": {"CONFIRMED", "CANCELLED"},
    "CONFIRMED": {"PROCESSING", "OUT_FOR_DELIVERY", "CANCELLED"},
    "PROCESSING": {"OUT_FOR_DELIVERY", "CANCELLED"},
    "OUT_FOR_DELIVERY": {"DELIVERED"},
    "DELIVERED": set(),
    "CANCELLED": set(),
    "RETURNED": set(),
}
STATUS_ALIASES = {
    "ORDER_CONFIRMED": "CONFIRMED", "IN_PROGRESS": "PROCESSING",
    "SHIPPED": "OUT_FOR_DELIVERY", "COMPLETED": "DELIVERED", "COMPLETE": "DELIVERED",
    "PICKED_UP": "DELIVERED", "CANCELED": "CANCELLED",
}


def _status(value):
    key = str(value or "").strip().upper().replace("-", "_").replace(" ", "_")
    return STATUS_ALIASES.get(key, key)


class MobileOrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED",
    ])
    expected_status = serializers.ChoiceField(choices=list(STATUS_TRANSITIONS), required=False)
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")


class MobileOrderConfirmSerializer(serializers.Serializer):
    order_numbers = serializers.ListField(
        child=serializers.CharField(max_length=20), min_length=1, max_length=100,
    )
    notes = serializers.CharField(max_length=500, required=False, allow_blank=True, default="")

    def validate_order_numbers(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Select each order only once.")
        return value


def process_mobile_orders(warehouse, order_numbers, status, user, notes="", expected_status=None, van_load_batch=None):
    """Lock, validate, and update the whole batch, including chatbot history."""
    source = connections["mobile_orders"]
    placeholders = ", ".join(["%s"] * len(order_numbers))
    results = []
    with transaction.atomic(using="mobile_orders"):
        with source.cursor() as cursor:
            source_id = _source_warehouse_id(cursor, warehouse)
            if source_id is None:
                raise NotFound("Order not found in this warehouse.")
            # SQLite is used only for isolated tests; MySQL locks rows here.
            lock = " FOR UPDATE" if source.features.has_select_for_update else ""
            cursor.execute(
                f"SELECT msp_no, status FROM merchandising WHERE warehouse_id = %s "
                f"AND msp_no IN ({placeholders}) ORDER BY msp_no{lock}",
                [source_id, *order_numbers],
            )
            orders = dict(cursor.fetchall())
            if len(orders) != len(order_numbers):
                raise NotFound("One or more orders were not found in this warehouse.")
            linked = MobileOrderStockCommitment.objects.filter(
                warehouse=warehouse, order_number__in=order_numbers, van_load_batch__isnull=False,
            )
            if linked.exists() and van_load_batch is None:
                raise MobileOrderConflict("These orders are assigned to a van load. Manage dispatch and returns through Trading.")
            for number in order_numbers:
                current = _status(orders[number])
                if expected_status is not None and current != expected_status:
                    raise MobileOrderConflict(f"Order {number} is now {current}. Refresh and try again.")
                van_load_confirmation = van_load_batch is not None and status == "PROCESSING" and current in {"NEW", "PENDING"}
                van_load_dispatch = van_load_batch is not None and van_load_batch.merchandising_id and status == "OUT_FOR_DELIVERY" and current in {"NEW", "PENDING"}
                van_load_return = van_load_batch is not None and van_load_batch.return_fingerprint and status in {"DELIVERED", "RETURNED"} and current in {"PROCESSING", "OUT_FOR_DELIVERY"}
                if current != status and status not in STATUS_TRANSITIONS.get(current, set()) and not van_load_confirmation and not van_load_dispatch and not van_load_return:
                    raise MobileOrderConflict(f"Order {number} cannot change from {current} to {status}.")
            from .mobile_inventory import sync_mobile_inventory
            if van_load_batch is None or not van_load_batch.merchandising_id:
                sync_mobile_inventory(cursor, source_id, warehouse, orders, status, user)
            for number in order_numbers:
                current = _status(orders[number])
                changed = current != status
                if changed:
                    cursor.execute(
                        "UPDATE merchandising SET status = %s "
                        "WHERE msp_no = %s AND warehouse_id = %s AND status = %s",
                        [status, number, source_id, orders[number]],
                    )
                    if cursor.rowcount != 1:
                        raise MobileOrderConflict()
                    cursor.execute(
                        "SELECT chatbot_order_id FROM chatbot_order WHERE msp_no = %s" + lock,
                        [number],
                    )
                    chatbot_orders = cursor.fetchall()
                    at = timezone.now()
                    # Raw MySQL dates use UTC without timezone information.
                    db_at = at.astimezone(datetime_timezone.utc).replace(tzinfo=None)
                    for (chatbot_id,) in chatbot_orders:
                        cursor.execute(
                            "UPDATE chatbot_order SET fulfillment_status = %s, completed_at = %s "
                            "WHERE chatbot_order_id = %s",
                            [status, db_at if status == "DELIVERED" else None, chatbot_id],
                        )
                        cursor.execute(
                            "INSERT INTO order_fulfillment "
                            "(chatbot_order_id, fulfillment_stage, stage_timestamp, notes) "
                            "VALUES (%s, %s, %s, %s)",
                            [chatbot_id, status, db_at, f"POS user {user.pk}. {notes}".strip()],
                        )
                results.append({
                    "order_number": number, "previous_status": current,
                    "status": status, "changed": changed,
                })
    return results


class MobileOrderProcessingView(APIView):
    authentication_classes = [POSSessionAuthentication]
    permission_classes = [CanProcessMobileOrders]

    def process(self, request, warehouse, order_numbers, **kwargs):
        try:
            orders = process_mobile_orders(warehouse, order_numbers, user=request.user, **kwargs)
        except (DatabaseError, ValueError):
            logger.exception("Unable to process mobile orders.")
            try:
                stock_committed = kwargs.get("status") == "CONFIRMED" and MobileOrderStockCommitment.objects.filter(
                    warehouse=warehouse, order_number__in=order_numbers, active=True,
                ).count() == len(order_numbers)
            except DatabaseError:
                stock_committed = False
            if stock_committed:
                raise MobileOrdersUnavailable("Stock has been updated, but confirmation could not finish. Retry this same order to complete it.")
            raise MobileOrdersUnavailable()
        response = Response({"updated_count": sum(order["changed"] for order in orders), "results": orders})
        response["Cache-Control"] = "no-store"
        return response


class MobileOrderDetailView(MobileOrderProcessingView):
    def get_permissions(self):
        if self.request.method == "GET":
            return [CanViewMobileOrders()]
        return super().get_permissions()

    def get(self, request, order_number):
        warehouse = _request_warehouse(request)
        try:
            _, orders = read_mobile_orders(warehouse, limit=1, order_number=order_number)
        except (DatabaseError, ValueError):
            logger.exception("Unable to read a mobile order.")
            raise MobileOrdersUnavailable()
        if not orders:
            raise NotFound("Order not found in this warehouse.")
        response = Response(orders[0])
        response["Cache-Control"] = "no-store"
        return response

    def patch(self, request, order_number):
        warehouse = _request_warehouse(request)
        serializer = MobileOrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.process(request, warehouse, [order_number], **serializer.validated_data)


class MobileOrderConfirmView(MobileOrderProcessingView):
    def post(self, request):
        warehouse = _request_warehouse(request)
        serializer = MobileOrderConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return self.process(request, warehouse, status="CONFIRMED", **serializer.validated_data)
