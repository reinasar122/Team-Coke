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



class RoleAccessibilitySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = RoleAccessibility
        fields = '__all__'

class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model"""
    class Meta:
        model = Role
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True
    )
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all(), source='warehouse', write_only=True
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'email', 'first_name', 'last_name', 'gender',
            'phone_number', 'role_name', 'role_id', 'warehouse_name', 'warehouse_id',
            'is_active', 'created_at', 'last_login'
        ]
        extra_kwargs = {'password': {'write_only': True}}

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        if password:
            validated_data['password'] = make_password(password)

        user = super().create(validated_data)

        # ✅ Send email with username and password
        from django.core.mail import send_mail
        send_mail(
            subject='Your Account Credentials',
            message=f"""
Hello {user.first_name},

Your account has been created.

Username: {user.username}
Password: {self.initial_data.get('password')}F

Please log in and change your password as soon as possible.

Best regards,
Admin Team
""",
            from_email='your_email@gmail.com',  # Replace with your Gmail
            recipient_list=[user.email],
            fail_silently=False,
        )

        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        role = validated_data.pop('role', None)
        warehouse = validated_data.pop('warehouse', None)

        if password:
            instance.set_password(password)
        if role:
            instance.role = role
        if warehouse:
            instance.warehouse = warehouse

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        instance.save()
        return instance






class WarehouseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Warehouse
        fields = '__all__'


class SupplierContactSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierContact
        fields = ["id", "contact_person", "email", "phone_number"]  # Include 'id' for updates


class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, required=False)

    class Meta:
        model = Supplier
        fields = '__all__'

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

        for contact in instance.contacts.all():
            if contact.id not in incoming_ids:
                contact.delete()

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
    class Meta:
        model = Van
        fields = '__all__'


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
    class Meta:
        model = Product
        fields = '__all__'


class ProductDetailSerializer(serializers.ModelSerializer):
    unit_type = UnitTypeSerializer(read_only=True)
    price = PricingSerializer(read_only=True)
    product_category = ProductCategorySerializer(read_only=True)

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





class RoleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Role
        fields = '__all__'

class RoleAccessibilitySerializer(serializers.ModelSerializer):
    role_name = serializers.CharField(source='role.name', read_only=True)

    class Meta:
        model = RoleAccessibility
        fields = '__all__'

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
    class Meta:
        model = MerchandisingSale
        fields = '__all__'  # or specify fields if you prefer: ['msp_no', 'date_time', ...]

# MiscellaneousItem Serializer
class MiscellaneousItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MiscellaneousItem
        fields = '__all__'
        extra_kwargs = {
            'merchandising': {'required': False}  # ✅ make it optional
        }

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'

class MerchandisingSerializer(serializers.ModelSerializer):
    # Read-only derived fields
    msp_no = serializers.CharField(read_only=True)  # ← server owns MSP
    transaction_type_name = serializers.CharField(source="transaction_type.name", read_only=True)
    customer_name = serializers.SerializerMethodField()

    # Nested
    items = MerchandisingItemSerializer(many=True)
    misc_items = MiscellaneousItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, required=False)

    # FK inputs
    route = serializers.PrimaryKeyRelatedField(
        queryset=Route.objects.all(), allow_null=True, required=False
    )

    # Computed aggregates for response
    total_trading_amount = serializers.SerializerMethodField()
    total_expenses_amount = serializers.SerializerMethodField()

    class Meta:
        model = Merchandising
        fields = '__all__'
        read_only_fields = ['msp_no', 'transaction_type_name', 'total_trading_amount', 'total_expenses_amount']

    def validate(self, data):
        transaction_type = data.get("transaction_type")
        route = data.get("route")
        van = data.get("van")

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

    def get_customer_name(self, obj):
        # Placeholder until you add a customer FK to Merchandising
        return "N/A"

    @transaction.atomic  # ← ensure all-or-nothing
    def create(self, validated_data):
        items_data = validated_data.pop('items', [])
        misc_items_data = validated_data.pop('misc_items', [])
        payments_data = validated_data.pop('payments', [])

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

            # Returnables (empties) → ReturnableStock
            if merchandising_item.empty_return_pcs > 0 or merchandising_item.empty_return_shell > 0:
                ReturnableStock.objects.create(
                    product=product,
                    empty_bottle_qty=merchandising_item.empty_return_pcs,
                    empty_shell_qty=merchandising_item.empty_return_shell,
                    source='customer',
                    supplier=getattr(product, 'supplier', None),
                    warehouse=merchandising.warehouse
                )

            # Restock non-empty returns
            if merchandising_item.actual_return_pcs > 0:
                stock, _ = Stock.objects.get_or_create(
                    product=product,
                    warehouse=merchandising.warehouse
                )
                stock.quantity_available = (stock.quantity_available or 0) + merchandising_item.actual_return_pcs
                stock.save(update_fields=['quantity_available'])

            # Deduct sold pcs
            if merchandising_item.sold_pcs > 0:
                stock, _ = Stock.objects.get_or_create(
                    product=product,
                    warehouse=merchandising.warehouse
                )
                stock.quantity_available = (stock.quantity_available or 0) - merchandising_item.sold_pcs
                stock.save(update_fields=['quantity_available'])

        for misc_data in misc_items_data:
            MiscellaneousItem.objects.create(merchandising=merchandising, **misc_data)

        for payment_data in payments_data:
            Payment.objects.create(merchandising=merchandising, **payment_data)

        return merchandising

    def update(self, instance, validated_data):
        # Prevent clients from altering msp_no on update as well
        validated_data.pop('msp_no', None)
        return super().update(instance, validated_data)



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
        username = data.get('username')
        password = data.get('password')

        try:
            user = User.objects.get(username=username)
        except User.DoesNotExist:
            raise serializers.ValidationError("User not found.")

        if not user.check_password(password):
            raise serializers.ValidationError("Incorrect password.")

        access_list = RoleAccessibility.objects.filter(role=user.role).values(
            'submenu', 'full', 'view', 'create', 'edit', 'delete'
        )

        # ✅ Return must_change_password in login response
        return {
            "id": user.id,
            "username": user.username,
            "role": user.role.name if user.role else None,
            "warehouse": user.warehouse.name if user.warehouse else None,
            "must_change_password": user.must_change_password,
            "accessibilities": list(access_list)
        }

class ChangePasswordSerializer(serializers.Serializer):
    user_id = serializers.IntegerField()
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        pattern = re.compile(
            r'^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?#&])[A-Za-z\d@$!%*?#&]{8,}$'
        )
        if not pattern.match(value):
            raise serializers.ValidationError(
                "Password must include at least 1 uppercase letter, 1 lowercase letter, 1 number, and 1 special character."
            )
        return value

    def save(self):
        user = User.objects.get(id=self.validated_data['user_id'])
        user.set_password(self.validated_data['new_password'])
        user.must_change_password = False
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