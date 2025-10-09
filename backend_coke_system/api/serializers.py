from rest_framework import serializers
from .models import Warehouse
from .models import Supplier, SupplierContact
from django.contrib.auth.hashers import make_password
from .models import User, Role
from .models import Van
from .models import RoleAccessibility,ContentType, ShellType, UnitType, Pricing, Product, ProductCategory, Receiving, ReceivingItem, Stock, Route, TransactionType, Merchandising, MerchandisingItem, MiscellaneousItem, ReturnableStock, SupplierReturn, SupplierReturnItem, Payment, Customer
from .models import User, RoleAccessibility
import re
from .models import SupplierReturnForm, SupplierReturnFormItem, Product
from .models import *
from django.db import transaction
from django.db.models import F
# api/serializers.py
from rest_framework import serializers
from .models import CreditLedger, CreditPayment
from decimal import Decimal
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.mail import send_mail
from django.urls import reverse  # If you want to generate relative URL
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode
from .models import User
from django.utils.timezone import localtime



class CreditLedgerCreateSerializer(serializers.ModelSerializer):
    # Map camelCase (frontend) → snake_case (model)
    customerName = serializers.CharField(source="customer_name", required=False, allow_blank=True, default="Walk-in")
    handledBy = serializers.CharField(source="handled_by", required=False, allow_blank=True, default="")
    transactionTypeName = serializers.CharField(source="transaction_type", required=False, allow_blank=True, default="")
    payment_terms_days = serializers.IntegerField(required=False, default=30)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    transactionDate = serializers.DateTimeField(source="created_at", required=False)
    amountDue = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, write_only=True)  # ✅ Mark as write_only
    totalAmount = serializers.DecimalField(source="total_amount", max_digits=12, decimal_places=2)
    rows = serializers.ListField(child=serializers.DictField(), source="rows_json", required=False, default=list)
    creditNotes = serializers.CharField(source="remarks", required=False, allow_blank=True, default="")  # ✅ Map to remarks
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())

    class Meta:
        model = CreditLedger
        fields = [
            "msp_no",
            "customerName",
            "handledBy",
            "transactionTypeName",
            "remarks",
            "payment_terms_days",
            "due_date",
            "amountDue",
            "totalAmount",
            "rows",
            "transactionDate",
            "creditNotes",
            "warehouse",
        ]

    def create(self, validated_data):
        # ✅ Remove write_only fields that don't map to model fields
        validated_data.pop('amountDue', None)  # amountDue is the same as totalAmount
        return super().create(validated_data)
    
class CreditLedgerListSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)  # ADD WAREHOUSE NAME

    class Meta:
        model = CreditLedger
        fields = [
            "id", "msp_no", "created_at", "handled_by", "customer_name",
            "total_amount", "amount_paid", "status", "balance", "warehouse_id", "warehouse_name",  # ADD WAREHOUSE NAME
        ]

    def get_balance(self, obj):
        return obj.balance

class CreditLedgerDetailSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()
    payments = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)  # ADD WAREHOUSE NAME

    class Meta:
        model = CreditLedger
        fields = [
            "id", "msp_no", "created_at", "handled_by", "customer_name",
            "transaction_type", "remarks",
            "payment_terms_days", "due_date",
            "total_amount", "amount_paid", "status", "balance",
            "rows_json", "payments", "warehouse_name",  # ADD WAREHOUSE NAME
        ]

    def get_balance(self, obj):
        return obj.balance

    def get_payments(self, obj):
        return [
            {
                "id": p.id,
                "amount": str(p.amount),
                "method": p.method,
                "note": p.note,
                "created_at": p.created_at,
                "recorded_by": p.recorded_by,
            }
            for p in obj.payments.all().order_by("-created_at")
        ]



class CreditPaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditPayment
        fields = ["amount", "method", "note", "recorded_by"]

    def create(self, validated_data):
        credit = self.context["credit"]
        payment = CreditPayment.objects.create(credit=credit, **validated_data)
        credit.apply_payment(validated_data["amount"])
        return payment






class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model"""
    class Meta:
        model = Role
        fields = '__all__'

class RoleAccessibilitySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = RoleAccessibility
        fields = '__all__'



class UserSerializer(serializers.ModelSerializer):
    # Accept IDs when creating/updating
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True
    )
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all(),
        source="warehouse",
        write_only=True
    )

    # Return full object when reading
    role = serializers.SerializerMethodField(read_only=True)
    warehouse = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = User
        fields = [
            "id", "username", "password", "email", "first_name", "last_name",
            "gender", "phone_number",
            "role_id", "warehouse_id",  # for input
            "role", "warehouse",        # for output
            "is_active", "created_at", "last_login",
        ]
        extra_kwargs = {"password": {"write_only": True}}

    def get_role(self, obj):
        if obj.role:
            return {"id": obj.role.id, "name": obj.role.name}
        return None

    def get_warehouse(self, obj):
        if obj.warehouse:
            return {"id": obj.warehouse.id, "name": obj.warehouse.name}
        return None

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = super().create(validated_data)
        if password:
            user.set_password(password)
            user.save()

        # send reset link
        token = default_token_generator.make_token(user)
        uid = urlsafe_base64_encode(force_bytes(str(user.pk)))
        reset_link = f"http://localhost:3000/change-password/{uid}/{token}/"

        send_mail(
            subject="Set Your Account Password",
            message=(
                f"Hello {user.first_name} {user.last_name},\n\n"
                f"Your username is: {user.username}\n\n"
                f"Please set your password using the link below:\n{reset_link}"
            ),
            from_email="your_email@gmail.com",
            recipient_list=[user.email],
            fail_silently=False,
        )
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        user = super().update(instance, validated_data)
        if password:
            user.set_password(password)
            user.save()
        return user



class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'


class SupplierContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierContact
        fields = '__all__'


class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, required=False)
    can_delete = serializers.SerializerMethodField()  # ✅ still here

    class Meta:
        model = Supplier
        fields = '__all__'

    # ✅ Fix duplicate check: ignore self when editing
    def validate_company_name(self, value):
        qs = Supplier.objects.filter(company_name__iexact=value.strip())
        if self.instance:  # Editing case
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError(
                "A supplier with this company name already exists."
            )
        return value

    def get_can_delete(self, obj):
        has_receivings = getattr(obj, "receiving_set", None)
        has_returns = getattr(obj, "supplierreturn_set", None)
        if (has_receivings and has_receivings.exists()) or (has_returns and has_returns.exists()):
            return False
        return True

    def create(self, validated_data):
        contacts_data = validated_data.pop('contacts', [])
        supplier = Supplier.objects.create(**validated_data)
        for contact_data in contacts_data:
            SupplierContact.objects.create(supplier=supplier, **contact_data)
        return supplier

    def update(self, instance, validated_data):
        contacts_data = validated_data.pop("contacts", [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        existing_ids = [c.id for c in instance.contacts.all()]
        incoming_ids = [c.get("id") for c in contacts_data if c.get("id")]

        # Remove deleted contacts
        for contact in instance.contacts.all():
            if contact.id not in incoming_ids:
                contact.delete()

        # Update or create contacts
        for contact_data in contacts_data:
            contact_id = contact_data.get("id")
            if contact_id and contact_id in existing_ids:
                contact = SupplierContact.objects.get(id=contact_id, supplier=instance)
                for attr, value in contact_data.items():
                    setattr(contact, attr, value)
                contact.save()
            else:
                SupplierContact.objects.create(supplier=instance, **contact_data)

        return instance

class VanSerializer(serializers.ModelSerializer):
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Van
        fields = '__all__'

    def validate_plate_number(self, value):
        qs = Van.objects.filter(plate_number__iexact=value.strip())
        if self.instance:
            qs = qs.exclude(id=self.instance.id)
        if qs.exists():
            raise serializers.ValidationError("A van with this plate number already exists.")
        return value

    def get_can_delete(self, obj):
        has_routes = hasattr(obj, "route_set") and obj.route_set.exists()
        has_transactions = hasattr(obj, "merchandising_set") and obj.merchandising_set.exists()
        return not (has_routes or has_transactions)

#ProductSerializer

class ContentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentType
        fields = '__all__'

class ShellTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShellType
        fields = '__all__'


class ProductCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProductCategory
        fields = '__all__'


class UnitTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = UnitType
        fields = '__all__'


class PricingSerializer(serializers.ModelSerializer):
    class Meta:
        model = Pricing
        fields = '__all__'


class ProductSerializer(serializers.ModelSerializer):
    product_category = serializers.PrimaryKeyRelatedField(queryset=ProductCategory.objects.all())
    unit_type = serializers.PrimaryKeyRelatedField(queryset=UnitType.objects.all())
    price = serializers.PrimaryKeyRelatedField(queryset=Pricing.objects.all())
    image = serializers.ImageField(required=False, allow_null=True)
    remove_image = serializers.CharField(required=False, allow_blank=True, write_only=True)  # Add this
    
    class Meta:
        model = Product
        fields = '__all__'
    
    def update(self, instance, validated_data):
        # Handle image removal
        remove_image = validated_data.pop('remove_image', None)
        
        if remove_image == 'true':
            # Delete the old image file if it exists
            if instance.image:
                instance.image.delete(save=False)
            validated_data['image'] = None
        
        return super().update(instance, validated_data)
    

class ProductDetailSerializer(serializers.ModelSerializer):
    unit_type = UnitTypeSerializer(read_only=True)
    price = PricingSerializer(read_only=True)
    product_category = ProductCategorySerializer(read_only=True)
    image_url = serializers.ReadOnlyField()  # NEW: Image URL property
    
    class Meta:
        model = Product
        fields = '__all__'


class ReceivingItemSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(write_only=True)
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    unit_cost = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2, read_only=True)

    class Meta:
        model = ReceivingItem
        exclude = ['receiving']

    def validate(self, attrs):
        product_id = attrs.get('product_id')
        if not Product.objects.filter(id=product_id).exists():
            raise serializers.ValidationError({'product_id': 'Invalid product ID'})
        return attrs

    def create(self, validated_data):
        product_id = validated_data.pop('product_id')
        product = Product.objects.get(id=product_id)
        validated_data['product'] = product
        validated_data['product_name'] = product.product_name

        # Extract pricing from related product.price
        if hasattr(product, 'price'):
            purchase_price = product.price.purchase_price or 0
            bottle_price = product.price.bottle_price or 0
            shell_price = product.price.shell_price or 0
        else:
            purchase_price = bottle_price = shell_price = 0

        content_no = product.unit_type.content_no if product.unit_type else 1

        pcs_qty = validated_data.get('pcs_qty', 0)
        bad_order_pcs = validated_data.get('bad_order_pcs', 0)

        unit_cost = purchase_price + bottle_price + (shell_price / content_no if content_no else 0)
        adjusted_pcs = max(pcs_qty - bad_order_pcs, 0)
        total = unit_cost * adjusted_pcs

        validated_data.update({
            'unit_price': purchase_price,
            'bottle_price': bottle_price,
            'shell_price': shell_price,
            'unit_cost': unit_cost,
            'total': total
        })

        receiving = self.context.get('receiving')
        if not receiving:
            raise serializers.ValidationError("Receiving context is missing.")

        validated_data['receiving'] = receiving
        return ReceivingItem.objects.create(**validated_data)



class ReceivingSerializer(serializers.ModelSerializer):
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all(), required=False)
    received_by_first_name = serializers.CharField(source='received_by.first_name', read_only=True)
    received_by_last_name = serializers.CharField(source='received_by.last_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    details = ReceivingItemSerializer(many=True)

    class Meta:
        model = Receiving
        fields = '__all__'

    def create(self, validated_data):
        details_data = validated_data.pop('details')
        receiving = Receiving.objects.create(**validated_data)

        for item_data in details_data:
            item_serializer = ReceivingItemSerializer(data=item_data, context={'receiving': receiving})
            item_serializer.is_valid(raise_exception=True)
            item = item_serializer.save()

            # Stock logic - Handle warehouse filtering
            product = item.product
            content_no = product.unit_type.content_no if product.unit_type else 1
            pcs_qty = item.shell_qty * content_no
            adjusted_pcs = pcs_qty - item.bad_order_pcs

            # Get or create stock for this warehouse (or general stock if no warehouse)
            if receiving.warehouse:
                stock, _ = Stock.objects.get_or_create(
                    product=product, 
                    warehouse=receiving.warehouse,
                    defaults={'quantity_available': 0}
                )
            else:
                # Fallback: get or create stock without warehouse for existing data
                stock, _ = Stock.objects.get_or_create(
                    product=product, 
                    warehouse__isnull=True,
                    defaults={'quantity_available': 0}
                )
            
            stock.quantity_available += max(adjusted_pcs, 0)
            stock.save()

        return receiving

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        instance.details.all().delete()

        for item_data in details_data:
            item_serializer = ReceivingItemSerializer(data=item_data, context={'receiving': instance})
            item_serializer.is_valid(raise_exception=True)
            item = item_serializer.save()

            # Stock logic - Handle warehouse filtering
            product = item.product
            content_no = product.unit_type.content_no if product.unit_type else 1
            pcs_qty = item.shell_qty * content_no
            adjusted_pcs = pcs_qty - item.bad_order_pcs

            if instance.warehouse:
                stock, _ = Stock.objects.get_or_create(
                    product=product, 
                    warehouse=instance.warehouse,
                    defaults={'quantity_available': 0}
                )
            else:
                stock, _ = Stock.objects.get_or_create(
                    product=product, 
                    warehouse__isnull=True,
                    defaults={'quantity_available': 0}
                )
            
            stock.quantity_available += max(adjusted_pcs, 0)
            stock.save()

        return instance
    

class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ['id', 'product', 'product_name', 'warehouse', 'warehouse_name', 
                 'quantity_available', 'last_updated', 'stock_status']

    def get_stock_status(self, obj):
        return obj.stock_status()



class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = '__all__'

class TransactionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionType
        fields = '__all__'

class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name', 'warehouse']

class MerchandisingItemSerializer(serializers.ModelSerializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.all())  # Accept ID
    product_detail = ProductSerializer(source="product", read_only=True)  # Optional: for output

    class Meta:
        model = MerchandisingItem
        fields = '__all__'
        extra_kwargs = {
            'merchandising': {'required': False}
        }

    def create(self, validated_data):
        instance = MerchandisingItem(**validated_data)
        instance.save()
        return instance

    def update(self, instance, validated_data):
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        return instance


class MerchandisingSaleSerializer(serializers.ModelSerializer):
    # ✅ these must be class attributes, NOT inside Meta
    warehouse_name   = serializers.CharField(source="warehouse.warehouse", read_only=True)
    warehouse_address= serializers.CharField(source="warehouse.address", read_only=True)
    warehouse_phone  = serializers.CharField(source="warehouse.phone", read_only=True)
    warehouse_city   = serializers.CharField(source="warehouse.city", read_only=True)
    warehouse_region = serializers.CharField(source="warehouse.region", read_only=True)
    warehouse_email  = serializers.CharField(source="warehouse.email", read_only=True)

    class Meta:
        model  = MerchandisingSale
        fields = "__all__"


# MiscellaneousItem Serializer
class MiscellaneousItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MiscellaneousItem
        fields = "__all__"
        extra_kwargs = {
            "merchandising": {"required": False},   # still optional
            "created_at": {"read_only": True},      # 🔒 prevent client override
            "updated_at": {"read_only": True},      # 🔒 prevent client override
        }
class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class MerchandisingSerializer(serializers.ModelSerializer):
    # Store text in DB, but still accept numbers from the client
    handled_by = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    handled_by_name = serializers.SerializerMethodField()

    # ---- existing fields you already have ----
    msp_no = serializers.CharField(read_only=True)
    transaction_type_name = serializers.CharField(source="transaction_type.name", read_only=True)
    date_time = serializers.DateTimeField(required=False, default_timezone=timezone.get_current_timezone())

    def to_representation(self, instance):
        representation = super().to_representation(instance)
        # Convert UTC to local time before sending it back to frontend
        representation['date_time'] = localtime(instance.date_time).strftime('%Y-%m-%dT%H:%M:%S')
        return representation

    items = MerchandisingItemSerializer(many=True, required=False)
    misc_items = MiscellaneousItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, required=False, read_only=True)
    route = serializers.PrimaryKeyRelatedField(queryset=Route.objects.all(), allow_null=True, required=False)
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.all(), allow_null=True, required=False)
    total_trading_amount = serializers.SerializerMethodField()
    total_expenses_amount = serializers.SerializerMethodField()
    invoice_no = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = Merchandising
        fields = '__all__'
        # REMOVE the two discrepancy fields from read_only_fields
        read_only_fields = [
            'msp_no',
            'transaction_type_name',
            'total_trading_amount',
            'total_expenses_amount',
            # 'discrepancy_non_empty',  # ← remove these two
            # 'discrepancy_empty',
        ]


    # ACCEPT id OR name; if id, convert to "First Last" (or username) before saving
    def validate_handled_by(self, value):
        if value in (None, ""):
            return value
        # DRF CharField will give us a string; try to coerce to int
        try:
            uid = int(value)
        except (TypeError, ValueError):
            # Not numeric → assume it's already a name/username
            return str(value)

        user = User.objects.filter(pk=uid).first()
        if not user:
            # If the id doesn't exist, keep what came in (or you can raise a ValidationError)
            return str(value)
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username

    # Always provide a readable name in responses
    def get_handled_by_name(self, obj):
        hb = getattr(obj, "handled_by", None)
        if hb in (None, ""):
            return None
        # If DB contains an id-like string (legacy rows), resolve to a name
        try:
            uid = int(hb)
        except (TypeError, ValueError):
            return str(hb)  # already a name
        user = User.objects.filter(pk=uid).first()
        if not user:
            return str(hb)
        full_name = f"{user.first_name} {user.last_name}".strip()
        return full_name or user.username


    def validate(self, data):
        """
        🔁 CHANGED: on PATCH, fall back to instance values so Van Load
        validation still applies even if the field is omitted.
        """
        transaction_type = data.get("transaction_type") or getattr(self.instance, "transaction_type", None)
        route = data.get("route") if "route" in data else getattr(self.instance, "route", None)
        van = data.get("van") if "van" in data else getattr(self.instance, "van", None)

        if transaction_type and transaction_type.name.lower() == "van load":
            if not route:
                raise serializers.ValidationError({"route": "Route is required for Van Load transactions."})
            if not van:
                raise serializers.ValidationError({"van": "Van is required for Van Load transactions."})
        return data

    def get_total_trading_amount(self, obj):
        return sum([(item.actual_sale or 0) for item in obj.items.all()])

    def get_total_expenses_amount(self, obj):
        return sum([(item.amount or 0) for item in obj.misc_items.all()])

    @transaction.atomic  # ← ensure all-or-nothing
    def create(self, validated_data):
        # ⬇️ UNCHANGED: this is exactly your original create()
        items_data = validated_data.pop('items', [])
        misc_items_data = validated_data.pop('misc_items', [])
        payments_data = validated_data.pop('payments', [])

        print(">>> DEBUG misc_items_data received:", misc_items_data) 
        print(">>> SERIALIZER.create misc_items_data len:", len(misc_items_data))
        print(">>> SERIALIZER.create misc_items_data sample:", misc_items_data[:3])

        # Safety: client must NOT override msp_no
        validated_data.pop('msp_no', None)

        merchandising = Merchandising.objects.create(**validated_data)
        # At this point, Merchandising.save() has generated msp_no

        for item_data in items_data:
            product = item_data.get("product")
            if not isinstance(product, Product):
                product = Product.objects.get(id=product)

            merchandising_item = MerchandisingItem.objects.create(
                merchandising=merchandising,
                product=product,
                dispatched_pcs=item_data.get("dispatched_pcs", 0),
                dispatched_shell=item_data.get("dispatched_shell", 0),
                sold_pcs=item_data.get("sold_pcs", 0),
                sold_shell=item_data.get("sold_shell", 0),
                empty_return_pcs=item_data.get("empty_return_pcs", 0),
                empty_return_shell=item_data.get("empty_return_shell", 0),
                actual_return_pcs=item_data.get("actual_return_pcs", 0),
                actual_return_shell=item_data.get("actual_return_shell", 0),
                discrepancy_empties_pc=item_data.get("discrepancy_empties_pc", 0),
                discrepancy_empties_shell=item_data.get("discrepancy_empties_shell", 0),
                discrepancy_full_pcs=item_data.get("discrepancy_full_pcs", 0),
                discrepancy_full_shell=item_data.get("discrepancy_full_shell", 0),
                discount_percent=item_data.get("discount_percent", 0),
                expected_sale=item_data.get("expected_sale", 0),
                actual_sale=item_data.get("actual_sale", 0),
            )

            # Returnables (empties) → ReturnableStock (UPSERT)
            if merchandising_item.empty_return_pcs > 0 or merchandising_item.empty_return_shell > 0:
                add_bottle = max(0, int(merchandising_item.empty_return_pcs or 0))
                add_shell  = max(0, int(merchandising_item.empty_return_shell or 0))

                rs, created = (
                    ReturnableStock.objects
                    .select_for_update()
                    .get_or_create(
                        product=product,
                        warehouse=merchandising.warehouse,
                        source='customer',
                        supplier=getattr(product, 'supplier', None),
                        defaults={'empty_bottle_qty': 0, 'empty_shell_qty': 0},
                    )
                )

                ReturnableStock.objects.filter(pk=rs.pk).update(
                    empty_bottle_qty=F('empty_bottle_qty') + add_bottle,
                    empty_shell_qty=F('empty_shell_qty') + add_shell,
                )

            # Restock non-empty returns
            if merchandising_item.actual_return_pcs > 0:
                stock, _ = Stock.objects.get_or_create(
                    product=product,
                    warehouse=merchandising.warehouse
                )
                stock.quantity_available = (stock.quantity_available or 0) + merchandising_item.actual_return_pcs
                stock.save(update_fields=['quantity_available'])

            # Deduct sold pcs ONLY if transaction_type is "Warehouse"
            if merchandising.transaction_type.name.lower() == "warehouse":
                if merchandising_item.sold_pcs > 0:
                    stock, _ = Stock.objects.get_or_create(
                        product=product,
                        warehouse=merchandising.warehouse
                    )
                    old_qty = stock.quantity_available or 0
                    stock.quantity_available = (stock.quantity_available or 0) - merchandising_item.sold_pcs
                    stock.save(update_fields=['quantity_available'])
                    print(
                        f"[STOCK DEBUG] Deduction applied | MSP: {merchandising.msp_no} "
                        f"| Product: {product.product_name} "
                        f"| Sold: {merchandising_item.sold_pcs} "
                        f"| Before: {old_qty} | After: {stock.quantity_available}"
                    )

        # -- MISCELLANEOUS --
        created_ids = []
        total_misc = Decimal("0.00")
        for mi in misc_items_data:
            amt = Decimal(str(mi.get("amount", 0)))
            total_misc += amt
            created_misc = MiscellaneousItem.objects.create(
                merchandising=merchandising,
                description=mi.get("description", ""),
                amount=amt,
            )
            created_ids.append(created_misc.id)

        print(">>> SERIALIZER.create created Misc IDs:", created_ids)

        if merchandising.miscellaneous != total_misc:
            merchandising.miscellaneous = total_misc
            merchandising.save(update_fields=["miscellaneous"])

        for payment_data in payments_data:
            Payment.objects.create(merchandising=merchandising, **payment_data)

        return merchandising

    @transaction.atomic
    def update(self, instance, validated_data):
        """
        🔁 NEW: writable nested update for items & misc_items.
        - Upserts rows by `id`
        - Deletes rows missing from the payload
        - Leaves payments read-only in updates
        """
        # Prevent clients from altering msp_no on update as well
        validated_data.pop('msp_no', None)

        items_data = validated_data.pop('items', None)          # may be omitted in PATCH
        misc_items_data = validated_data.pop('misc_items', None)
        validated_data.pop('payments', None)                    # ignore on update

        # --- update parent fields ---
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # --- sync nested ITEMS if provided ---
        if items_data is not None:
            existing = {obj.id: obj for obj in instance.items.all()}
            seen = set()

            for line in items_data:
                line_id = line.get("id")

                # normalize product FK (frontend can send numeric id)
                product = line.get("product")
                if product and not isinstance(product, Product):
                    product = Product.objects.get(pk=product)
                    line["product"] = product

                if line_id and line_id in existing:
                    obj = existing[line_id]
                    for k, v in line.items():
                        if k == "id":
                            continue
                        setattr(obj, k, v)
                    obj.save()
                    seen.add(line_id)
                else:
                    MerchandisingItem.objects.create(merchandising=instance, **line)

            # delete rows removed by client
            for obj_id, obj in existing.items():
                if obj_id not in seen:
                    obj.delete()

        # --- sync nested MISC ITEMS if provided ---
        if misc_items_data is not None:
            existing = {obj.id: obj for obj in instance.misc_items.all()}
            seen = set()
            total_misc = Decimal("0.00")

            for mi in misc_items_data:
                mi_id = mi.get("id")
                amt = Decimal(str(mi.get("amount", 0)))
                total_misc += amt

                if mi_id and mi_id in existing:
                    obj = existing[mi_id]
                    obj.description = mi.get("description", obj.description)
                    obj.amount = amt
                    obj.save()
                    seen.add(mi_id)
                else:
                    new_obj = MiscellaneousItem.objects.create(
                        merchandising=instance,
                        description=mi.get("description", ""),
                        amount=amt,
                    )
                    seen.add(new_obj.id)

            # delete removed misc rows
            for obj_id, obj in existing.items():
                if obj_id not in seen:
                    obj.delete()

            # keep aggregate in sync
            if instance.miscellaneous != total_misc:
                instance.miscellaneous = total_misc
                instance.save(update_fields=["miscellaneous"])

        return instance



class ReturnableStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnableStock
        fields = '__all__'

class SupplierReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierReturnItem
        fields = '__all__'

class SupplierReturnSerializer(serializers.ModelSerializer):
    items = SupplierReturnItemSerializer(many=True)

    class Meta:
        model = SupplierReturn
        fields = '__all__'

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        supplier_return = SupplierReturn.objects.create(**validated_data)

        for item_data in items_data:
            SupplierReturnItem.objects.create(supplier_return=supplier_return, **item_data)

        return supplier_return

    def update(self, instance, validated_data):
        return super().update(instance, validated_data)

class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField()

    def validate(self, data):
        username_or_email = data.get('username')  # same frontend field
        password = data.get('password')

        # Try fetching user by username first
        user = User.objects.filter(username=username_or_email).first()

        # If not found, try email
        if not user:
            user = User.objects.filter(email=username_or_email).first()

        if not user:
            raise serializers.ValidationError("User not found.")

        if not user.check_password(password):
            raise serializers.ValidationError("Incorrect password.")

        access_list = RoleAccessibility.objects.filter(role=user.role).values(
            'submenu', 'full', 'view', 'create', 'edit', 'delete'
        )

        return {
            "id": user.id,
            "username": user.username,
            "role": user.role.name if user.role else None,
            "warehouse": user.warehouse.name if user.warehouse else None,
            "must_change_password": user.must_change_password,
            "accessibilities": list(access_list)
        }
#Kerk modify this part changepassword to otp
import logging
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_decode

class ChangePasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        # Password strength validation
        pattern = re.compile(
            r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$'
        )
        if not pattern.match(value):
            raise serializers.ValidationError(
                "Password must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
            )
        return value

    def validate(self, attrs):
        uid = attrs.get('uid')
        token = attrs.get('token')

        try:
            # Decode UID and cast to int
            user_id = int(urlsafe_base64_decode(uid).decode())
            user = User.objects.get(pk=user_id)

            # Log for debugging purposes
            logging.info(f"User found: {user.id}, Token: {token}")
        except (User.DoesNotExist, ValueError, TypeError, OverflowError):
            raise serializers.ValidationError("Invalid UID")

        # Validate the token
        if not default_token_generator.check_token(user, token):
            raise serializers.ValidationError("Invalid or expired token")

        attrs['user'] = user
        return attrs

    def save(self):
        user = self.validated_data['user']
        # Set new password for the user
        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False  # Make sure this field exists or remove it if unnecessary
        user.save()
        return user


class ForgotPasswordRequestSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        if not User.objects.filter(email=value).exists():
            raise serializers.ValidationError("User with this email does not exist.")
        return value


class OTPVerificationSerializer(serializers.Serializer):
    email = serializers.EmailField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate(self, data):
        if not User.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError("Email not found.")
        return data
    
#Supplier Return Item Serializer 
class SupplierReturnFormItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierReturnFormItem
        fields = ['product', 'qty_shell', 'qty_pcs', 'bottle_price', 'shell_price', 'line_total']

class SupplierReturnFormSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)  # ADD THIS
    items = SupplierReturnFormItemSerializer(many=True)

    class Meta:
        model = SupplierReturnForm
        fields = ['id', 'sup_no', 'supplier', 'supplier_name', 'warehouse', 'warehouse_name', 'date', 'total_amount', 'items']  # ADD warehouse fields

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        supplier_return = SupplierReturnForm.objects.create(**validated_data)
        for item_data in items_data:
            SupplierReturnFormItem.objects.create(supplier_return=supplier_return, **item_data)
        return supplier_return

class ProcessEmptiesReturnSerializer(serializers.Serializer):
    return_date = serializers.DateTimeField()
    items = serializers.ListField(
        child=serializers.DictField(
            child=serializers.CharField()
        )
    )
    
    def validate_items(self, value):
        if not value:
            raise serializers.ValidationError("At least one item is required")
        
        for item in value:
            required_fields = ['merchandising_id', 'item_id', 'product_id']
            for field in required_fields:
                if field not in item:
                    raise serializers.ValidationError(f"Missing required field: {field}")
        
        return value