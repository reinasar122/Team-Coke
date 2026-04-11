from rest_framework import serializers
from .models import Warehouse
from .models import Supplier, SupplierContact
from django.contrib.auth.hashers import make_password
from .models import User, Role, Holiday, Forecast
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
from .models import Notification, NotificationPreference, ProcessedNotification
from django.core.exceptions import ValidationError
from django.conf import settings
from random import randint
from datetime import timedelta
from django.utils import timezone
import os

# Path to your service account key JSON file


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['phone_number', 'first_name', 'last_name', 'gender', 'email', 'password', 'confirm_password']

    def _is_unverified_signup_draft(self, user):
        if not user:
            return False
        status_value = str(getattr(user, "status", "") or "").strip().lower()
        return (
            status_value == "pending"
            and not bool(getattr(user, "is_approved", False))
            and not bool(getattr(user, "is_active", False))
            and getattr(user, "role_id", None) is None
            and getattr(user, "warehouse_id", None) is None
        )

    def validate(self, attrs):
        # Ensure password and confirm password match
        if attrs['password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords do not match.")
        
        attrs["phone_number"] = (attrs.get("phone_number") or "").strip()
        self._pending_signup_user = None

        existing_user = User.objects.filter(phone_number=attrs["phone_number"]).first()
        if existing_user:
            if self._is_unverified_signup_draft(existing_user):
                # Allow retrying signup for users who closed OTP before verification.
                self._pending_signup_user = existing_user
            elif str(existing_user.status or "").strip().lower() == "pending approval" and not existing_user.is_approved:
                raise serializers.ValidationError("Phone number already verified and pending admin approval.")
            else:
                raise serializers.ValidationError("Phone number already registered.")
        
        # Handle empty email - convert to None to avoid unique constraint issues
        if 'email' in attrs and not attrs['email']:
            attrs['email'] = None
        elif 'email' in attrs and attrs['email']:
            attrs['email'] = attrs['email'].strip()

        if attrs.get("email"):
            email_qs = User.objects.filter(email__iexact=attrs["email"])
            if self._pending_signup_user:
                email_qs = email_qs.exclude(pk=self._pending_signup_user.pk)
            if email_qs.exists():
                raise serializers.ValidationError({"email": "Email already registered."})
        
        return attrs

    def create(self, validated_data):
        validated_data.pop('confirm_password', None)  # Remove confirm_password field before saving
        raw_password = validated_data.pop('password')

        user = getattr(self, "_pending_signup_user", None)
        if user:
            user.phone_number = validated_data.get("phone_number")
            user.first_name = validated_data.get("first_name")
            user.last_name = validated_data.get("last_name")
            user.gender = validated_data.get("gender")
            user.email = validated_data.get("email")
            user.status = "Pending"
            user.is_approved = False
            user.is_active = False
            user.otp_required = True
        else:
            user = User(
                status="Pending",  # Initial status before OTP verification
                is_approved=False,
                is_active=False,
                otp_required=True,
                **validated_data
            )

        # Generate OTP
        otp = str(randint(100000, 999999))
        user.password = make_password(raw_password)
        user.must_change_password = True
        user.otp = otp
        user.otp_required = True
        user.otp_expiry = timezone.now() + timedelta(minutes=5)
        user.save()

        # Send OTP to user via SMS (Simulated here)
        self.send_sms_otp(user.phone_number, otp)
        
        return user

    def send_sms_otp(self, phone_number, otp):
        # Simulate sending OTP (replace with actual SMS service if needed)
        print(f"OTP for {phone_number} is: {otp}")


class WarehouseSerializer(serializers.ModelSerializer):
    full_address = serializers.SerializerMethodField()
    class Meta:
        model = Warehouse
        fields = '__all__'

    def get_full_address(self, obj):
        parts = []
        if obj.street_address:
            parts.append(obj.street_address)
        if obj.city:
            parts.append(obj.city)
        if obj.region:
            parts.append(obj.region)
        return ", ".join(parts) if parts else ""   

    def validate_phone_number(self, value):
        if not value:
            return value
        if not value.isdigit():
            raise serializers.ValidationError("Phone number must contain only numbers.")
        if len(value) != 11:
            raise serializers.ValidationError("Phone number must be exactly 11 digits long.")
        return value

    def validate_zip_code(self, value):
        if not value:
            return value
        if not value.isdigit():
            raise serializers.ValidationError("Zip code must contain only numbers.")
        if len(value) != 4:
            raise serializers.ValidationError("Zip code must be exactly 4 digits long.")
        return value


class CreditLedgerCreateSerializer(serializers.ModelSerializer):
    # Map camelCase (frontend) -> snake_case (model)
    customerName = serializers.CharField(source="customer_name", required=False, allow_blank=True, default="Walk-in")
    handledBy = serializers.CharField(source="handled_by", required=False, allow_blank=True, default="")
    transactionTypeName = serializers.CharField(source="transaction_type", required=False, allow_blank=True, default="")
    payment_terms_days = serializers.IntegerField(required=False, default=30)
    due_date = serializers.DateTimeField(required=False, allow_null=True)
    transactionDate = serializers.DateTimeField(source="created_at", required=False)
    amountDue = serializers.DecimalField(max_digits=12, decimal_places=2, required=False, write_only=True)
    totalAmount = serializers.DecimalField(source="total_amount", max_digits=12, decimal_places=2)
    rows = serializers.ListField(child=serializers.DictField(), source="rows_json", required=False, default=list)
    creditNotes = serializers.CharField(source="remarks", required=False, allow_blank=True, default="")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.all())  # keep only this

    amountPaid = serializers.DecimalField(
        source="amount_paid",  # maps correctly
        max_digits=12,
        decimal_places=2,
        required=False,
        default=0
    )

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
            "amountPaid",
            "totalAmount",
            "rows",
            "transactionDate",
            "creditNotes",
            "warehouse",   # only warehouse, not warehouse_id
        ]

    def create(self, validated_data):
        # Remove non-model fields
        validated_data.pop('amountDue', None)
        return super().create(validated_data)

    
class CreditLedgerListSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()  # add computed status
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = CreditLedger
        fields = [
            "id", "msp_no", "created_at", "handled_by", "customer_name",
            "total_amount", "amount_paid", "status", "balance",
            "warehouse_id", "warehouse_name",
        ]

    def get_balance(self, obj):
        return float(obj.total_amount or 0) - float(obj.amount_paid or 0)

    def get_status(self, obj):
        balance = self.get_balance(obj)
        if balance <= 0:
            return "PAID"
        elif obj.amount_paid > 0:
            return "PARTIAL"
        return "PENDING"


class CreditLedgerDetailSerializer(serializers.ModelSerializer):
    balance = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()  # add this
    payments = serializers.SerializerMethodField()
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = CreditLedger
        fields = [
            "id", "msp_no", "created_at", "handled_by", "customer_name",
            "transaction_type", "remarks",
            "payment_terms_days", "due_date",
            "total_amount", "amount_paid", "status", "balance",
            "rows_json", "payments", "warehouse_name",
        ]

    def get_balance(self, obj):
        return float(obj.total_amount or 0) - float(obj.amount_paid or 0)

    def get_status(self, obj):
        balance = self.get_balance(obj)
        if balance <= 0:
            return "PAID"
        elif obj.amount_paid > 0:
            return "PARTIAL"
        return "PENDING"

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


class CreditPaymentDisplaySerializer(serializers.ModelSerializer):
    customer_name = serializers.CharField(source='credit.customer_name')  
    credit_amount = serializers.DecimalField(source='credit.total_amount', max_digits=12, decimal_places=2) 
    due_date = serializers.DateTimeField(source='credit.due_date')  

    class Meta:
        model = CreditPayment
        fields = ['customer_name', 'credit_amount', 'due_date', 'amount', 'method', 'created_at']




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



# serializers.py
from rest_framework import serializers
from .models import User, Role, Warehouse
import random
from django.core.mail import send_mail
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.contrib.auth.tokens import default_token_generator

# serializers.py
from rest_framework import serializers
from .models import User, Role, Warehouse
import random

class UserSerializer(serializers.ModelSerializer):
    # Accept IDs when creating/updating
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(),
        source="role",
        write_only=True,
        required=False,
        allow_null=True,
    )
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all(),
        source="warehouse",
        write_only=True,
        required=False,
        allow_null=True,
    )

    # Return full object when reading
    role = serializers.SerializerMethodField(read_only=True)
    warehouse = serializers.SerializerMethodField(read_only=True)

    # status + is_approved now writable so admin can approve
    status = serializers.CharField(required=False)
    is_approved = serializers.BooleanField(required=False)

    class Meta:
        model = User
        fields = [
            "id",
            "password",
            "first_name",
            "last_name",
            "gender",
            "phone_number",
            "email",
            "role_id",
            "warehouse_id",   # input
            "role",
            "warehouse",      # output
            "is_active",
            "status",
            "is_approved",
            "created_at",
            "last_login",
            "otp",
        ]
        extra_kwargs = {
            "password": {"write_only": True},
            "otp": {"read_only": True},
        }

    def get_role(self, obj):
        if obj.role:
            return {"id": obj.role.id, "name": obj.role.name}
        return None

    def get_warehouse(self, obj):
        if obj.warehouse:
           return {
                "id": obj.warehouse.id,
                "name": obj.warehouse.name,
                "address": obj.warehouse.street_address,
                "phone": obj.warehouse.phone_number,
                "city": obj.warehouse.city,
                "region": obj.warehouse.region,
                "email": obj.warehouse.email,
            }
        return None

    def create(self, validated_data):
        # handle password
        password = validated_data.pop("password", None)

        # new users are pending and not approved
        validated_data.setdefault("status", "Pending")
        validated_data.setdefault("is_approved", False)
        validated_data.setdefault("is_active", False)

        user = super().create(validated_data)

        if password:
            user.set_password(password)

        # Generate OTP (6 digits) for phone verification
        otp = random.randint(100000, 999999)
        user.otp = str(otp)
        user.otp_required = True
        user.save(update_fields=["password", "otp", "otp_required", "status", "is_approved", "is_active"])

        # Send OTP via SMS provider (placeholder)
        self.send_sms_otp(user.phone_number, otp)

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)

        # remember old approval state
        was_approved = instance.is_approved
        old_role = instance.role
        old_wh = instance.warehouse

        user = super().update(instance, validated_data)

        # handle password change
        if password:
            user.set_password(password)
            user.save(update_fields=["password"])

        # if admin just approved the user now
        if not was_approved and user.is_approved:
            # make sure status / is_active aligned
            if user.status != "Active":
                user.status = "Active"
            user.is_active = True
            user.save(update_fields=["status", "is_active"])

            role = user.role or old_role
            wh = user.warehouse or old_wh
            self.send_approval_sms(
                user.phone_number,
                role.name if role else "",
                wh.name if wh else "",
            )

        return user

    def send_sms_otp(self, phone_number, otp):
        print(f"[OTP] OTP for {phone_number} is: {otp}")
        # integrate Firebase/Twilio here

    def send_approval_sms(self, phone_number, role_name, warehouse_name):
        if not phone_number:
            return
        msg = (
            f"Your Wilfie's account has been approved. "
            f"Role: {role_name}, Warehouse: {warehouse_name}."
        )
        print(f"[APPROVAL SMS] {phone_number}: {msg}")
        # integrate Firebase/Twilio here

class SupplierContactSerializer(serializers.ModelSerializer):
    id = serializers.IntegerField(required=False)

    class Meta:
        model = SupplierContact
        fields = ['id', 'supplier', 'contact_person', 'email', 'phone_number']
        extra_kwargs = {
            'supplier': {'read_only': True},
            'email': {'required': True},
            'contact_person': {'required': False, 'allow_blank': True},
        }


class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, required=False)
    can_delete = serializers.SerializerMethodField()

    class Meta:
        model = Supplier
        fields = '__all__'
        extra_kwargs = {
            'contact_person': {'required': False, 'allow_blank': True},
        }

    def validate_company_name(self, value):
        qs = Supplier.objects.filter(company_name__iexact=value.strip())
        if self.instance:
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
        contacts_data = validated_data.pop('contacts', [])

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        existing_contacts = {c.id: c for c in instance.contacts.all()}
        incoming_ids = []

        for contact_data in contacts_data:
            contact_id = contact_data.get('id')
            if contact_id and contact_id in existing_contacts:
                contact = existing_contacts[contact_id]
                for attr, val in contact_data.items():
                    if attr != 'id':
                        setattr(contact, attr, val)
                contact.save()
                incoming_ids.append(contact_id)
            else:
                new_contact = SupplierContact.objects.create(supplier=instance, **contact_data)
                incoming_ids.append(new_contact.id)

        for contact_id, contact in existing_contacts.items():
            if contact_id not in incoming_ids:
                contact.delete()

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
    product_category = serializers.PrimaryKeyRelatedField(queryset=ProductCategory.objects.all(), required=False)
    unit_type = serializers.PrimaryKeyRelatedField(queryset=UnitType.objects.all(), required=False)
    price = serializers.PrimaryKeyRelatedField(queryset=Pricing.objects.all(), required=False)
    image = serializers.ImageField(required=False, allow_null=True)
    remove_image = serializers.CharField(required=False, allow_blank=True, write_only=True)

    class Meta:
        model = Product
        fields = '__all__'

    def _ensure_product_image_dir(self):
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'product_images')
        try:
            os.makedirs(upload_dir, exist_ok=True)
        except OSError as exc:
            raise serializers.ValidationError({
                'image': f'Unable to access upload directory: {upload_dir}'
            }) from exc

    def create(self, validated_data):
        if validated_data.get('image') is not None:
            self._ensure_product_image_dir()

        try:
            return super().create(validated_data)
        except OSError as exc:
            raise serializers.ValidationError({
                'image': f'Unable to save product image. Check write access to {settings.MEDIA_ROOT}.'
            }) from exc
    
    def update(self, instance, validated_data):
        # Handle image removal
        remove_image = validated_data.pop('remove_image', None)
        if validated_data.get('image') is not None:
            self._ensure_product_image_dir()
        
        if str(remove_image).lower() == 'true':
            # Delete the old image file if it exists
            if instance.image:
                instance.image.delete(save=False)
            validated_data['image'] = None

        try:
            return super().update(instance, validated_data)
        except OSError as exc:
            raise serializers.ValidationError({
                'image': f'Unable to save product image. Check write access to {settings.MEDIA_ROOT}.'
            }) from exc
    

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
    system_product_code = serializers.CharField(source='product.system_code', read_only=True)
    supplier_product_code = serializers.CharField(source='product.supplier_code', read_only=True)
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ['id', 'product', 'product_name', 'warehouse', 'warehouse_name', 
                 'quantity_available', 'last_updated', 'stock_status', 
                 'system_product_code', 'supplier_product_code']

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
        fields = ['id', 'name', 'warehouse', 'address', 'phone']

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
    # these must be class attributes, NOT inside Meta
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
            "created_at": {"read_only": True},      # prevent client override
            "updated_at": {"read_only": True},      # prevent client override
        }
class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class MerchandisingSerializer(serializers.ModelSerializer):
    # Store text in DB, but still accept numbers from the client
    handled_by = serializers.CharField(required=False, allow_null=True, allow_blank=True)
    handled_by_name = serializers.SerializerMethodField()
    customer_name = serializers.SerializerMethodField()
    customer_display_name = serializers.SerializerMethodField()
    warehouse_full_address = serializers.SerializerMethodField()

    # ---- existing fields you already have ----
    msp_no = serializers.CharField(read_only=True)
    transaction_type_name = serializers.CharField(source="transaction_type.name", read_only=True)
    date_time = serializers.DateTimeField(required=False, default_timezone=timezone.get_current_timezone())

    # Warehouse details
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    warehouse_address = serializers.CharField(source="warehouse.street_address", read_only=True)
    warehouse_phone = serializers.CharField(source="warehouse.phone_number", read_only=True)
    warehouse_city = serializers.CharField(source="warehouse.city", read_only=True)
    warehouse_region = serializers.CharField(source="warehouse.region", read_only=True)
    warehouse_email = serializers.CharField(source="warehouse.email", read_only=True)
    warehouse_full_address = serializers.SerializerMethodField()

    # Route and Van details
    route_name = serializers.CharField(source="route.name", read_only=True)
    van_name = serializers.CharField(source="van.name", read_only=True)

    def get_warehouse_full_address(self, obj):
        if obj.warehouse:
            parts = []
            if obj.warehouse.street_address:
                parts.append(obj.warehouse.street_address)
            if obj.warehouse.city:
                parts.append(obj.warehouse.city)
            if obj.warehouse.region:
                parts.append(obj.warehouse.region)
            if parts:
                return ",".join(parts)
            return "N/A"
        return "N/A"
    def get_customer_name(self, obj):
        customer = getattr(obj, "customer", None)
        if customer and getattr(customer, "name", None):
            return customer.name
        return ""

    def get_customer_display_name(self, obj):
        return self.get_customer_name(obj)


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
            # 'discrepancy_non_empty',  # remove these two
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
            # Not numeric -> assume it's already a name/username
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
        CHANGED: on PATCH, fall back to instance values so Van Load
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

    def _is_pending_van_load(self, transaction_type, status_value):
        tt_name = (getattr(transaction_type, "name", transaction_type) or "").strip().lower()
        status_name = str(status_value or "").strip().lower()
        return tt_name == "van load" and status_name not in {"complete", "completed"}

    def _is_warehouse_transaction(self, transaction_type):
        tt_name = (getattr(transaction_type, "name", transaction_type) or "").strip().lower()
        return tt_name == "warehouse"

    def _warehouse_holds_stock(self, transaction_type, status_value):
        status_name = str(status_value or "").strip().lower()
        return self._is_warehouse_transaction(transaction_type) and status_name not in {"cancelled", "canceled"}

    def _warehouse_committed_pcs(self, item, status_value):
        if item is None:
            return 0

        status_name = str(status_value or "").strip().lower()
        if status_name == "reserved":
            return int(getattr(item, "dispatched_pcs", 0) or 0)

        return int(getattr(item, "sold_pcs", 0) or 0)

    def _normalize_status_key(self, value):
        return " ".join(str(value or "").strip().lower().replace("-", " ").split())

    def _sync_reservation_lifecycle_fields(self, validated_data, instance=None):
        transaction_type = validated_data.get("transaction_type", getattr(instance, "transaction_type", None))
        reserved_date = validated_data.get("reserved_date", getattr(instance, "reserved_date", None))
        status_name = self._normalize_status_key(
            validated_data.get("status", getattr(instance, "status", None))
        )
        is_reservation = self._is_warehouse_transaction(transaction_type) and reserved_date is not None
        has_explicit_actual_pickup = "actual_pickup_date" in validated_data

        if not is_reservation:
            if (
                not has_explicit_actual_pickup
                and instance is not None
                and getattr(instance, "actual_pickup_date", None)
                and "reserved_date" in validated_data
                and validated_data.get("reserved_date") is None
            ):
                validated_data["actual_pickup_date"] = None
            return

        if status_name in {"complete", "completed", "picked up"}:
            validated_data["status"] = "Picked Up"
            if not has_explicit_actual_pickup:
                validated_data["actual_pickup_date"] = (
                    getattr(instance, "actual_pickup_date", None) or timezone.localdate()
                )
            return

        if status_name == "reserved":
            validated_data["status"] = "Reserved"
            if has_explicit_actual_pickup or getattr(instance, "actual_pickup_date", None):
                validated_data["actual_pickup_date"] = None
            return

        if status_name in {"cancelled", "canceled"}:
            validated_data["status"] = "Cancelled"
            if has_explicit_actual_pickup or getattr(instance, "actual_pickup_date", None):
                validated_data["actual_pickup_date"] = None



    def _adjust_stock_quantity(self, product, warehouse, delta_pcs):
        if not product or not warehouse or int(delta_pcs or 0) == 0:
            return

        stock = (
            Stock.objects
            .select_for_update()
            .filter(product=product, warehouse=warehouse)
            .first()
        )
        if stock is None:
            stock = Stock(product=product, warehouse=warehouse, quantity_available=0)

        old_qty = int(stock.quantity_available or 0)
        new_qty = old_qty + int(delta_pcs)
        if new_qty < 0:
            raise serializers.ValidationError({
                "items": [
                    f"Insufficient stock for {product.product_name}. Available: {old_qty}, required: {abs(int(delta_pcs))}."
                ]
            })

        stock.quantity_available = new_qty
        stock.save(update_fields=['quantity_available']) if stock.pk else stock.save()

    def _adjust_returnable_stock(self, product, warehouse, bottle_delta=0, shell_delta=0):
        bottle_delta = int(bottle_delta or 0)
        shell_delta = int(shell_delta or 0)
        if not product or not warehouse or (bottle_delta == 0 and shell_delta == 0):
            return

        rs = (
            ReturnableStock.objects
            .select_for_update()
            .filter(
                product=product,
                warehouse=warehouse,
                source='customer',
                supplier=getattr(product, 'supplier', None),
            )
            .first()
        )
        if rs is None:
            rs = ReturnableStock(
                product=product,
                warehouse=warehouse,
                source='customer',
                supplier=getattr(product, 'supplier', None),
                empty_bottle_qty=0,
                empty_shell_qty=0,
            )

        next_bottle = int(rs.empty_bottle_qty or 0) + bottle_delta
        next_shell = int(rs.empty_shell_qty or 0) + shell_delta
        if next_bottle < 0 or next_shell < 0:
            raise serializers.ValidationError({
                "items": [
                    f"Returnable stock adjustment for {product.product_name} would become negative."
                ]
            })

        rs.empty_bottle_qty = next_bottle
        rs.empty_shell_qty = next_shell
        rs.save(update_fields=['empty_bottle_qty', 'empty_shell_qty']) if rs.pk else rs.save()

    @transaction.atomic  # ensure all-or-nothing
    def create(self, validated_data):
        # UNCHANGED: this is exactly your original create()
        items_data = validated_data.pop('items', [])
        misc_items_data = validated_data.pop('misc_items', [])
        payments_data = validated_data.pop('payments', [])
        transaction_type = validated_data.get("transaction_type")
        self._sync_reservation_lifecycle_fields(validated_data)
        status_value = validated_data.get("status")

        print(">>> DEBUG misc_items_data received:", misc_items_data) 
        print(">>> SERIALIZER.create misc_items_data len:", len(misc_items_data))
        print(">>> SERIALIZER.create misc_items_data sample:", misc_items_data[:3])

        # Safety: client must NOT override msp_no
        validated_data.pop('msp_no', None)

        if self._is_pending_van_load(transaction_type, status_value):
            validated_data["expected_sale"] = Decimal("0.00")
            for item_data in items_data:
                item_data["expected_sale"] = Decimal("0.00")

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

            # Returnables (empties) -> ReturnableStock (UPSERT)
            if merchandising_item.empty_return_pcs > 0 or merchandising_item.empty_return_shell > 0:
                self._adjust_returnable_stock(
                    product,
                    merchandising.warehouse,
                    bottle_delta=merchandising_item.empty_return_pcs,
                    shell_delta=merchandising_item.empty_return_shell,
                )

            # Restock non-empty returns
            if merchandising_item.actual_return_pcs > 0:
                self._adjust_stock_quantity(
                    product,
                    merchandising.warehouse,
                    merchandising_item.actual_return_pcs,
                )

            # Reserved warehouse rows hold dispatched stock; completed rows hold only what was sold.
            if self._warehouse_holds_stock(merchandising.transaction_type, merchandising.status):
                committed_pcs = self._warehouse_committed_pcs(merchandising_item, merchandising.status)
                if committed_pcs > 0:
                    self._adjust_stock_quantity(
                        product,
                        merchandising.warehouse,
                        -committed_pcs,
                    )
                    print(
                        f"[STOCK DEBUG] Reservation applied | MSP: {merchandising.msp_no} "
                        f"| Product: {product.product_name} "
                        f"| Committed: {committed_pcs}"
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

        # --- PAYMENTS ---
        # --- PAYMENTS ---
        for payment_data in payments_data:
            Payment.objects.create(merchandising=merchandising, **payment_data)

        # Refresh instance so reverse relations (payments) are loaded
        merchandising.refresh_from_db()

        # Compute method accurately based on paid amounts
        if merchandising.payments.exists():
            total_paid = Decimal("0.00")
            total_cash = Decimal("0.00")
            total_credit = Decimal("0.00")

            for p in merchandising.payments.all():
                amt = Decimal(str(p.amount or 0))
                total_paid += amt
                if p.method.lower() == "cash":
                    total_cash += amt
                elif p.method.lower() == "credit":
                    total_credit += amt

            sale_total = Decimal(str(merchandising.actual_sale or merchandising.expected_sale or 0))

            if total_credit == 0 and total_cash > 0 and total_cash >= sale_total:
                merchandising.payment_method = "cash"
            elif total_cash > 0 and total_credit > 0:
                merchandising.payment_method = "cash+credit"
            elif total_credit > 0 and total_cash == 0:
                merchandising.payment_method = "credit"
            else:
                merchandising.payment_method = None

            merchandising.save(update_fields=["payment_method"])

        # Van Load fallback
        # Van Load fallback (only if truly no payment data)
        if merchandising.transaction_type and merchandising.transaction_type.name.lower() == "van load":
            if not merchandising.payment_method:
                if merchandising.payments.exists():
                    # derive from payments instead
                    cash_exists = merchandising.payments.filter(method__iexact="cash").exists()
                    credit_exists = merchandising.payments.filter(method__iexact="credit").exists()
                    if cash_exists and credit_exists:
                        merchandising.payment_method = "cash+credit"
                    elif credit_exists:
                        merchandising.payment_method = "credit"
                    elif cash_exists:
                        merchandising.payment_method = "cash"
                else:
                    merchandising.payment_method = "cash"
                merchandising.save(update_fields=["payment_method"])

        print(">>> payment_method finally set to:", merchandising.payment_method)
        return merchandising



    @transaction.atomic
    def update(self, instance, validated_data):
        """
        NEW: writable nested update for items & misc_items.
        - Upserts rows by `id`
        - Deletes rows missing from the payload
        - Leaves payments read-only in updates
        """
        # Prevent clients from altering msp_no on update as well
        validated_data.pop('msp_no', None)

        items_data = validated_data.pop('items', None)          # may be omitted in PATCH
        misc_items_data = validated_data.pop('misc_items', None)
        validated_data.pop('payments', None)                    # ignore on update
        before_transaction_type = instance.transaction_type
        before_status = instance.status
        self._sync_reservation_lifecycle_fields(validated_data, instance)
        transaction_type = validated_data.get("transaction_type", instance.transaction_type)
        status_value = validated_data.get("status", instance.status)
        zero_expected_sale = self._is_pending_van_load(transaction_type, status_value)
        before_items = list(instance.items.select_related("product"))

        if zero_expected_sale:
            validated_data["expected_sale"] = Decimal("0.00")
            if items_data is not None:
                for line in items_data:
                    line["expected_sale"] = Decimal("0.00")

        # --- update parent fields ---
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if zero_expected_sale and items_data is None:
            instance.items.update(expected_sale=Decimal("0.00"))

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

        after_items = list(instance.items.select_related("product"))
        product_map = {
            obj.product_id: obj.product
            for obj in before_items + after_items
            if getattr(obj, "product_id", None)
        }

        from collections import defaultdict

        if items_data is not None:
            bottle_deltas = defaultdict(int)
            shell_deltas = defaultdict(int)
            for obj in before_items:
                bottle_deltas[obj.product_id] -= int(obj.empty_return_pcs or 0)
                shell_deltas[obj.product_id] -= int(obj.empty_return_shell or 0)
            for obj in after_items:
                bottle_deltas[obj.product_id] += int(obj.empty_return_pcs or 0)
                shell_deltas[obj.product_id] += int(obj.empty_return_shell or 0)

            for product_id in set(list(bottle_deltas.keys()) + list(shell_deltas.keys())):
                self._adjust_returnable_stock(
                    product_map.get(product_id),
                    instance.warehouse,
                    bottle_delta=bottle_deltas.get(product_id, 0),
                    shell_delta=shell_deltas.get(product_id, 0),
                )

        if self._is_warehouse_transaction(before_transaction_type) or self._is_warehouse_transaction(transaction_type):
            stock_deltas = defaultdict(int)
            before_holds_stock = self._warehouse_holds_stock(before_transaction_type, before_status)
            after_holds_stock = self._warehouse_holds_stock(transaction_type, status_value)

            for obj in before_items:
                if before_holds_stock:
                    stock_deltas[obj.product_id] += self._warehouse_committed_pcs(obj, before_status)
                stock_deltas[obj.product_id] -= int(obj.actual_return_pcs or 0)

            for obj in after_items:
                if after_holds_stock:
                    stock_deltas[obj.product_id] -= self._warehouse_committed_pcs(obj, status_value)
                stock_deltas[obj.product_id] += int(obj.actual_return_pcs or 0)

            for product_id, delta in stock_deltas.items():
                self._adjust_stock_quantity(
                    product_map.get(product_id),
                    instance.warehouse,
                    delta,
                )

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
    phone_number = serializers.CharField()
    otp = serializers.CharField(min_length=6, max_length=6, required=False)
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        phone_number = data.get('phone_number')
        password = data.get('password')

        user = User.objects.filter(phone_number=phone_number).first()
        if not user:
            raise serializers.ValidationError("User not found.")

        if not user.check_password(password):
            raise serializers.ValidationError("Incorrect username or password.")

        # Allow admin users to bypass approval check
        is_admin = user.role and user.role.name.lower() in ['admin', 'administrator', 'super admin']
        
        if not is_admin and not user.is_approved:
            raise serializers.ValidationError("Account pending approval.")
        
        if not user.is_active:
            raise serializers.ValidationError("Account is inactive.")

        if not user.role:
            raise serializers.ValidationError("User role not assigned.")
        
        if not user.warehouse:
            raise serializers.ValidationError("User warehouse not assigned.")

        access_list = RoleAccessibility.objects.filter(role=user.role).values(
            'submenu', 'full', 'view', 'create', 'edit', 'delete'
        )

        return {
            "id": user.id,
            "phone_number": user.phone_number,
            "role": user.role.name if user.role else None,
            "warehouse": user.warehouse.name if user.warehouse else None,
            "warehouse_id": user.warehouse.id if user.warehouse else None,
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
    phone_number = serializers.CharField()

    def validate_phone_number(self, value):
        if not User.objects.filter(phone_number=value).exists():
            raise serializers.ValidationError("User with this phone number does not exist.")
        return value

class OTPVerificationSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    otp = serializers.CharField(min_length=6, max_length=6)

    def validate(self, data):
        phone_number = data.get('phone_number')
        otp = data.get('otp')

        # Validate phone number existence
        user = User.objects.filter(phone_number=phone_number).first()

        if not user:
            raise serializers.ValidationError("Mobile number not found.")

        # Validate OTP
        if user.otp != otp:
            raise serializers.ValidationError("Invalid OTP.")

        # Handle OTP expiration
        if timezone.now() > user.otp_expiry:  # Assuming `otp_expiry` field in your model
            raise serializers.ValidationError("OTP has expired. Please request a new OTP.")

        # OTP is valid, proceed to allow user to login
        return data

    
#Supplier Return Item Serializer 
class SupplierReturnFormItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierReturnFormItem
        fields = ['product', 'qty_shell', 'qty_pcs', 'bottle_price', 'shell_price', 'line_total']

class SupplierReturnFormSerializer(serializers.ModelSerializer):
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)
    items = SupplierReturnFormItemSerializer(many=True)

    class Meta:
        model = SupplierReturnForm
        fields = ['id', 'sup_no', 'supplier', 'supplier_name', 'warehouse', 'warehouse_name', 'date', 'total_amount', 'status', 'items']  # ADD 'status'

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
    

class HolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Holiday
        fields = ["id", "name", "date"]

class ForecastSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source="product.product_name", read_only=True)

    class Meta:
        model = Forecast
        fields = ["id", "product", "product_name", "date", "forecast", "lower", "upper"]

class NotificationSerializer(serializers.ModelSerializer):
    timestamp = serializers.DateTimeField(source='created_at', read_only=True)
    warehouse_id = serializers.IntegerField(source='warehouse_id', read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'type', 'category', 'title', 'message', 'details',
            'priority', 'target_roles', 'warehouse_id', 'data',
            'is_read', 'read_at', 'timestamp', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'read_at']

class NotificationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating notifications"""
    
    class Meta:
        model = Notification
        fields = [
            'type', 'category', 'title', 'message', 'details',
            'priority', 'user', 'target_roles', 'warehouse_id',
            'data', 'source_id', 'source_type'
        ]
    
    def validate(self, data):
        """Validate notification data"""
        if not data.get('target_roles') and not data.get('user'):
            raise serializers.ValidationError("Either target_roles or user must be specified")
        return data

class NotificationUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating notifications"""
    
    class Meta:
        model = Notification
        fields = ['is_read', 'is_deleted']

class BulkNotificationUpdateSerializer(serializers.Serializer):
    """Serializer for bulk operations on notifications"""
    notification_ids = serializers.ListField(
        child=serializers.UUIDField(),
        allow_empty=False
    )
    action = serializers.ChoiceField(choices=['mark_read', 'mark_unread', 'delete'])

class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            'user', 'warehouse_id', 'enabled_types', 'disabled_types',
            'browser_notifications', 'high_priority_only',
            'email_notifications', 'email_digest'
        ]

class NotificationStatsSerializer(serializers.Serializer):
    """Serializer for notification statistics"""
    total = serializers.IntegerField()
    unread = serializers.IntegerField()
    by_type = serializers.DictField()
    by_priority = serializers.DictField()
    by_category = serializers.DictField()

class CreateNotificationRequestSerializer(serializers.Serializer):
    """Serializer for notification creation requests from frontend"""
    notification_type = serializers.CharField()
    data = serializers.DictField()
    user_role = serializers.CharField()
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    target_user_id = serializers.IntegerField(required=False, allow_null=True)
