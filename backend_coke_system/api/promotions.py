"""POS-managed promotions and their public mobile display feed."""

from zoneinfo import ZoneInfo

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError
from rest_framework.permissions import AllowAny, BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Product, Promotion, RoleAccessibility, Warehouse
from .pos_auth import POSSessionAuthentication, is_pos_admin


def promotion_today():
    return timezone.localdate(timezone=ZoneInfo("Asia/Manila"))


class PromotionAccess(BasePermission):
    message = "Your role does not have permission to manage promotions."

    def has_permission(self, request, view):
        if not request.auth:
            return False
        if is_pos_admin(request.user):
            return True
        action = "view" if request.method in ("GET", "HEAD", "OPTIONS") else "create"
        access = RoleAccessibility.objects.filter(role=request.user.role, submenu="Trading").first()
        return bool(access and (access.full or getattr(access, action)))


def promotion_warehouse(request):
    value = request.query_params.get("warehouse", request.user.warehouse_id)
    try:
        warehouse_id = int(value)
    except (TypeError, ValueError):
        raise ValidationError({"warehouse": "Select a warehouse to manage promotions."})
    if not is_pos_admin(request.user) and warehouse_id != request.user.warehouse_id:
        raise PermissionDenied("You can only manage promotions for your assigned warehouse.")
    warehouse = Warehouse.objects.filter(pk=warehouse_id).first()
    if warehouse is None:
        raise ValidationError({"warehouse": "Choose a valid warehouse."})
    return warehouse


class PromotionSerializer(serializers.ModelSerializer):
    product_ids = serializers.PrimaryKeyRelatedField(
        queryset=Product.objects.all(), many=True, source="products", write_only=True,
        allow_empty=False,
    )
    products = serializers.SerializerMethodField()
    title = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()

    class Meta:
        model = Promotion
        fields = ["id", "promotion_type", "title", "discount_percent", "products", "product_ids",
                  "start_date", "end_date", "status", "warehouse", "created_at"]
        read_only_fields = ["warehouse", "created_at"]

    def get_products(self, obj):
        return [{"id": product.pk, "product_name": product.product_name}
                for product in obj.products.all()]

    def get_title(self, obj):
        if obj.promotion_type == Promotion.Type.OCCASIONAL_DISCOUNT:
            amount = f"{obj.discount_percent:.2f}".rstrip("0").rstrip(".")
            return f"{amount}% Off"
        return obj.get_promotion_type_display()

    def get_status(self, obj):
        today = self.context.get("today") or promotion_today()
        if not obj.is_active:
            return "Inactive"
        if obj.start_date > today:
            return "Scheduled"
        return "Expired" if obj.end_date < today else "Active"

    def validate(self, attrs):
        start_date = attrs.get("start_date", getattr(self.instance, "start_date", None))
        end_date = attrs.get("end_date", getattr(self.instance, "end_date", None))
        if end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date must be on or after start date."})
        promotion_type = attrs.get("promotion_type", getattr(self.instance, "promotion_type", None))
        discount = attrs.get("discount_percent", getattr(self.instance, "discount_percent", 0))
        if promotion_type == Promotion.Type.OCCASIONAL_DISCOUNT:
            if not 0 < discount <= 100:
                raise serializers.ValidationError({"discount_percent": "Enter a discount greater than 0 and at most 100%."})
        else:
            attrs["discount_percent"] = 0
        warehouse = self.context["warehouse"]
        products = attrs.get("products")
        if products is not None and any(product.warehouse_id != warehouse.pk for product in products):
            raise serializers.ValidationError({"product_ids": "Choose products from this warehouse only."})
        return attrs


class PromotionListCreateView(APIView):
    authentication_classes = [POSSessionAuthentication]
    permission_classes = [PromotionAccess]

    def get(self, request):
        warehouse = promotion_warehouse(request)
        today = promotion_today()
        rows = Promotion.objects.filter(warehouse=warehouse, end_date__gte=today).prefetch_related("products")
        return Response(PromotionSerializer(rows, many=True, context={"today": today}).data,
                        headers={"Cache-Control": "no-store"})

    def post(self, request):
        warehouse = promotion_warehouse(request)
        serializer = PromotionSerializer(data=request.data, context={"warehouse": warehouse})
        serializer.is_valid(raise_exception=True)
        with transaction.atomic():
            serializer.save(warehouse=warehouse, created_by=request.user)
        return Response(serializer.data, status=201, headers={"Cache-Control": "no-store"})

    def patch(self, request, promotion_id):
        warehouse = promotion_warehouse(request)
        promotion = Promotion.objects.filter(warehouse=warehouse).prefetch_related("products").filter(
            pk=promotion_id,
        ).first()
        if promotion is None:
            raise NotFound("Promotion not found.")
        if PromotionSerializer(promotion, context={"today": promotion_today()}).data["status"] != "Active":
            raise ValidationError({"detail": "Only active promotions can be edited."})
        serializer = PromotionSerializer(
            promotion, data=request.data, partial=True,
            context={"warehouse": warehouse, "today": promotion_today()},
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data, headers={"Cache-Control": "no-store"})


class ActivePromotionListView(APIView):
    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request):
        today = promotion_today()
        rows = Promotion.objects.filter(is_active=True, start_date__lte=today, end_date__gte=today)
        if "warehouse" in request.query_params:
            try:
                warehouse_id = int(request.query_params["warehouse"])
                if warehouse_id <= 0:
                    raise ValueError()
            except (TypeError, ValueError):
                raise ValidationError({"warehouse": "Choose a valid warehouse."})
            rows = rows.filter(warehouse_id=warehouse_id)
        rows = rows.filter(products__isnull=False).distinct().prefetch_related("products")
        return Response(PromotionSerializer(rows, many=True, context={"today": today}).data,
                        headers={"Cache-Control": "no-store"})
