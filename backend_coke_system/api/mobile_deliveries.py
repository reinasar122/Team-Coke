"""Saved delivery addresses and durable groups of mobile orders in the POS DB."""

import uuid

from django.db import connections, DatabaseError, IntegrityError, transaction
from rest_framework import serializers
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from .mobile_orders import (
    MobileOrderConfirmSerializer, MobileOrderConflict, MobileOrdersUnavailable,
    _order_address_sql, _request_warehouse, _source_warehouse_id, _status, logger,
)
from .models import MobileDelivery, MobileDeliveryAddress, MobileDeliveryOrder
from .pos_auth import CanProcessMobileOrders, CanViewMobileOrders, POSSessionAuthentication


class DeliveryAddressSerializer(serializers.ModelSerializer):
    class Meta:
        model = MobileDeliveryAddress
        fields = ["id", "address"]
        read_only_fields = ["id"]

    def validate_address(self, value):
        return " ".join(value.split())


class DeliverySerializer(serializers.ModelSerializer):
    order_numbers = serializers.SerializerMethodField()

    class Meta:
        model = MobileDelivery
        fields = ["id", "address", "destination_id", "order_numbers", "created_at"]

    def get_order_numbers(self, delivery):
        return [item.order_number for item in delivery.orders.all()]


class DeliveryCreateSerializer(MobileOrderConfirmSerializer):
    destination_id = serializers.IntegerField(min_value=1)
    request_id = serializers.UUIDField(default=uuid.uuid4)


def _response(data, status=200):
    response = Response(data, status=status)
    response["Cache-Control"] = "no-store"
    return response


class MobileDeliveryAddressView(APIView):
    authentication_classes = [POSSessionAuthentication]

    def get_permissions(self):
        return [CanViewMobileOrders() if self.request.method == "GET" else CanProcessMobileOrders()]

    def get(self, request):
        warehouse = _request_warehouse(request)
        try:
            saved = DeliveryAddressSerializer(
                MobileDeliveryAddress.objects.filter(warehouse=warehouse), many=True,
            ).data
            with connections["mobile_orders"].cursor() as cursor:
                source_id = _source_warehouse_id(cursor, warehouse)
                order_address = _order_address_sql()
                cursor.execute(
                    f"SELECT DISTINCT {order_address} AS order_address FROM merchandising m "
                    "LEFT JOIN customer c ON c.id = m.customer_id "
                    f"WHERE m.warehouse_id = %s AND {order_address} <> '' ORDER BY order_address",
                    [source_id],
                )
                available = [row[0] for row in cursor.fetchall()]
        except (DatabaseError, ValueError):
            logger.exception("Unable to load mobile delivery addresses.")
            raise MobileOrdersUnavailable()
        return _response({"saved": saved, "available": available})

    def post(self, request):
        warehouse = _request_warehouse(request)
        serializer = DeliveryAddressSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                destination = serializer.save(warehouse=warehouse)
        except IntegrityError:
            raise ValidationError({"address": "This address is already saved for this warehouse."})
        except DatabaseError:
            logger.exception("Unable to save a mobile delivery address.")
            raise MobileOrdersUnavailable()
        return _response(DeliveryAddressSerializer(destination).data, status=201)


class MobileDeliveryListCreateView(APIView):
    authentication_classes = [POSSessionAuthentication]

    def get_permissions(self):
        return [CanViewMobileOrders() if self.request.method == "GET" else CanProcessMobileOrders()]

    def get(self, request):
        warehouse = _request_warehouse(request)
        try:
            deliveries = MobileDelivery.objects.filter(warehouse=warehouse).prefetch_related("orders")
            # Delivery history is paginated independently of the filtered orders.
            from .mobile_orders import MobileOrderPagination
            pagination = MobileOrderPagination()
            page = pagination.paginate_queryset(deliveries, request, view=self)
            response = pagination.get_paginated_response(DeliverySerializer(page, many=True).data)
            response["Cache-Control"] = "no-store"
            return response
        except DatabaseError:
            logger.exception("Unable to load mobile deliveries.")
            raise MobileOrdersUnavailable()

    def post(self, request):
        warehouse = _request_warehouse(request)
        serializer = DeliveryCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        try:
            existing = MobileDelivery.objects.filter(pk=data["request_id"]).prefetch_related("orders").first()
            if existing:
                if (
                    existing.warehouse_id == warehouse.pk
                    and existing.destination_id == data["destination_id"]
                    and {item.order_number for item in existing.orders.all()} == set(data["order_numbers"])
                ):
                    return _response(DeliverySerializer(existing).data)
                raise MobileOrderConflict("This delivery request was already used. Refresh and try again.")
            destination = MobileDeliveryAddress.objects.filter(
                pk=data["destination_id"], warehouse=warehouse,
            ).first()
            if destination is None:
                raise ValidationError({"destination_id": "Choose a saved address in this warehouse."})
            source = connections["mobile_orders"]
            # Hold source order locks until the local delivery group is committed.
            # This transaction reads the mobile DB; grouping doesn't change status.
            with transaction.atomic(using="mobile_orders"), source.cursor() as cursor:
                source_id = _source_warehouse_id(cursor, warehouse)
                placeholders = ", ".join(["%s"] * len(data["order_numbers"]))
                lock = " FOR UPDATE" if source.features.has_select_for_update else ""
                cursor.execute(
                    f"SELECT msp_no, status FROM merchandising WHERE warehouse_id = %s "
                    f"AND msp_no IN ({placeholders}) ORDER BY msp_no{lock}",
                    [source_id, *data["order_numbers"]],
                )
                orders = dict(cursor.fetchall())
                if len(orders) != len(data["order_numbers"]):
                    raise NotFound("One or more orders were not found in this warehouse.")
                if any(_status(value) not in {"NEW", "PENDING", "CONFIRMED", "PROCESSING"} for value in orders.values()):
                    raise MobileOrderConflict("Only orders awaiting dispatch can be grouped for delivery.")
                with transaction.atomic():
                    if MobileDeliveryOrder.objects.filter(
                        warehouse=warehouse, order_number__in=data["order_numbers"],
                    ).exists():
                        raise MobileOrderConflict("One or more selected orders already belong to a delivery.")
                    delivery = MobileDelivery.objects.create(
                        pk=data["request_id"], warehouse=warehouse, destination=destination,
                        address=destination.address, created_by=request.user,
                    )
                    MobileDeliveryOrder.objects.bulk_create([
                        MobileDeliveryOrder(delivery=delivery, warehouse=warehouse, order_number=number)
                        for number in data["order_numbers"]
                    ])
            return _response(DeliverySerializer(delivery).data, status=201)
        except IntegrityError:
            raise MobileOrderConflict("One or more orders were grouped by another request. Refresh and try again.")
        except (DatabaseError, ValueError):
            logger.exception("Unable to group mobile orders for delivery.")
            raise MobileOrdersUnavailable()
