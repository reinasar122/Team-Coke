"""Commit POS inventory once, then safely retry source fulfillment updates."""

from collections import defaultdict
from decimal import Decimal
import re

from django.db import transaction
from rest_framework.exceptions import APIException

from .models import Merchandising, MobileOrderStockCommitment, Product, Stock
from .serializers import MerchandisingSerializer


class MobileInventoryConflict(APIException):
    status_code = 409
    default_detail = "Order inventory changed. Refresh and try again."


def _quantities(cursor, number, warehouse):
    cursor.execute(
        "SELECT p.system_code, SUM(i.sold_pcs) FROM merchandising_item i "
        "JOIN product p ON p.id = i.product_id WHERE i.msp_no = %s "
        "GROUP BY p.system_code ORDER BY p.system_code", [number],
    )
    lines = cursor.fetchall()
    if not lines:
        raise MobileInventoryConflict("This order has no products to confirm.")
    result = {}
    for code, quantity in lines:
        products = list(Product.objects.filter(system_code=code, warehouse=warehouse))
        if len(products) != 1 or quantity is None or int(quantity) != quantity or quantity <= 0:
            raise MobileInventoryConflict("Order products could not be matched to this warehouse's POS inventory.")
        result[str(products[0].pk)] = int(quantity)
    return result


def _reservation(cursor, number, source_id, warehouse, quantities):
    cursor.execute(
        "SELECT remarks, expected_sale FROM merchandising WHERE msp_no = %s AND warehouse_id = %s",
        [number, source_id],
    )
    remarks, amount = cursor.fetchone()
    marker = re.search(r"\[AIVA:[0-9a-fA-F-]{36}\]", remarks or "")
    if not marker:
        # Legacy mobile-only orders have no POS reservation. Never adopt an
        # unrelated web transaction merely because its number happens to match.
        if Merchandising.objects.filter(warehouse=warehouse, msp_no=number).exists():
            raise MobileInventoryConflict("This transaction number has no verified POS reservation link.")
        return None
    matches = list(Merchandising.objects.select_for_update().filter(
        warehouse=warehouse, msp_no=number, remarks__contains=marker.group(),
        transaction_type__name__iexact="Warehouse",
    ).select_related("transaction_type", "warehouse"))
    if len(matches) != 1:
        raise MobileInventoryConflict("The POS reservation could not be uniquely verified for this order.")
    sale = matches[0]
    if sale.status.strip().upper() not in {"RESERVED", "PENDING", "NEW"}:
        raise MobileInventoryConflict("This POS reservation was already processed. Refresh before confirming.")
    reserved = defaultdict(int)
    for item in sale.items.select_for_update().all():
        reserved[str(item.product_id)] += item.dispatched_pcs
    if dict(reserved) != quantities or Decimal(str(amount)) != sale.expected_sale:
        raise MobileInventoryConflict("The mobile order differs from its POS reservation. Check its products and total.")
    return sale


def _adjust(warehouse, quantities, direction):
    for product_id in sorted(quantities, key=int):
        stock = Stock.objects.select_for_update().filter(warehouse=warehouse, product_id=product_id).first()
        if not stock or (direction < 0 and stock.quantity_available < quantities[product_id]):
            product = Product.objects.get(pk=product_id)
            raise MobileInventoryConflict(f"Insufficient stock for {product.product_name}. This order was not confirmed.")
        stock.quantity_available += direction * quantities[product_id]
        stock.save(update_fields=["quantity_available", "last_updated"])


def sync_mobile_inventory(cursor, source_id, warehouse, orders, target_status, user):
    """POS changes commit together; durable receipts survive source write failure.

    The databases have independent transactions. If source synchronization fails
    after POS commit, retrying finds this receipt and only repeats the source
    update. It never deducts stock again or creates another sale.
    """
    from .mobile_orders import _status, STATUS_TRANSITIONS

    with transaction.atomic():
        # Serialize receipt creation for the warehouse, including legacy orders
        # without a POS row. Lock order is shared by every confirmation request.
        type(warehouse).objects.select_for_update().get(pk=warehouse.pk)
        for number in sorted(orders):
            receipt = MobileOrderStockCommitment.objects.select_for_update().filter(
                warehouse=warehouse, order_number=number,
            ).first()
            current = str(orders[number]).strip().upper().replace("-", "_").replace(" ", "_")
            if target_status == "CONFIRMED" and current in {"PENDING", "NEW"}:
                if number.startswith("MOCK-"):
                    raise MobileInventoryConflict("Test orders cannot deduct real POS inventory.")
                quantities = _quantities(cursor, number, warehouse)
                if receipt:
                    if not receipt.active or receipt.quantities != quantities:
                        raise MobileInventoryConflict("This order changed after its inventory was committed.")
                    if receipt.merchandising_id and not Merchandising.objects.filter(pk=receipt.merchandising_id, status__iexact="Confirmed").exists():
                        raise MobileInventoryConflict("The POS transaction changed after confirmation. Refresh and check its status.")
                    continue
                sale = _reservation(cursor, number, source_id, warehouse, quantities)
                if sale:
                    # Preserve prices/payments and use the normal POS stock
                    # delta logic. No second merchandising transaction is made.
                    for item in sale.items.select_for_update().all():
                        type(item).objects.filter(pk=item.pk).update(sold_pcs=item.dispatched_pcs)
                    serializer = MerchandisingSerializer(sale, data={"status": "Confirmed"}, partial=True)
                    serializer.is_valid(raise_exception=True)
                    serializer.save()
                else:
                    _adjust(warehouse, quantities, -1)
                MobileOrderStockCommitment.objects.create(
                    warehouse=warehouse, order_number=number, merchandising=sale,
                    quantities=quantities, confirmed_by=user,
                )
            elif receipt and receipt.active:
                if receipt.merchandising_id:
                    sale = Merchandising.objects.select_for_update().select_related("transaction_type", "warehouse").get(pk=receipt.merchandising_id)
                    pos_status = _status(sale.status)
                    if target_status != pos_status and target_status not in STATUS_TRANSITIONS.get(pos_status, set()):
                        raise MobileInventoryConflict("The POS transaction advanced to a different status. Refresh before processing this order.")
                    serializer = MerchandisingSerializer(sale, data={"status": target_status.replace("_", " ").title()}, partial=True)
                    serializer.is_valid(raise_exception=True)
                    serializer.save()
                elif target_status == "CANCELLED":
                    _adjust(warehouse, receipt.quantities, 1)
                if target_status == "CANCELLED":
                    receipt.active = False
                    receipt.save(update_fields=["active"])
