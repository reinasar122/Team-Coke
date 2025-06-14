from rest_framework import serializers
from .models import Warehouse
from .models import Supplier, SupplierContact
from django.contrib.auth.hashers import make_password
from .models import User, Role
from .models import Van
from .models import RoleAccessibility,ContentType, ShellType, UnitType, Pricing, Product, ProductCategory, Receiving, ReceivingItem, Stock, Route, TransactionType, Merchandising, MerchandisingItem, MiscellaneousItem, ReturnableStock, SupplierReturn, SupplierReturnItem, Payment, Customer
from .models import User, RoleAccessibility
import re

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
Password: {self.initial_data.get('password')}

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
        fields = ["contact_person", "email", "phone_number"]

class SupplierSerializer(serializers.ModelSerializer):
    contacts = SupplierContactSerializer(many=True, required=False)

    class Meta:
        model = Supplier
        fields = '__all__'

    def create(self, validated_data):
        contacts_data = validated_data.pop("contacts", [])  # ✅ Match related_name
        supplier = Supplier.objects.create(**validated_data)
        for contact_data in contacts_data:
            SupplierContact.objects.create(supplier=supplier, **contact_data)
        return supplier

    def update(self, instance, validated_data):
        contacts_data = validated_data.pop("contacts", [])

        # Update the Supplier fields
        instance.company_name = validated_data.get('company_name', instance.company_name)
        instance.bir_no = validated_data.get('bir_no', instance.bir_no)
        instance.contact_person = validated_data.get('contact_person', instance.contact_person)
        instance.email = validated_data.get('email', instance.email)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.street_address = validated_data.get('street_address', instance.street_address)
        instance.city = validated_data.get('city', instance.city)
        instance.region = validated_data.get('region', instance.region)
        instance.zip_code = validated_data.get('zip_code', instance.zip_code)
        instance.save()

        # Delete old contacts and recreate them
        instance.contacts.all().delete()
        for contact_data in contacts_data:
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
    received_by_first_name = serializers.CharField(source='received_by.first_name', read_only=True)
    received_by_last_name = serializers.CharField(source='received_by.last_name', read_only=True)
    supplier_name = serializers.CharField(source='supplier.company_name', read_only=True)
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

            # Stock logic
            product = item.product
            content_no = product.unit_type.content_no if product.unit_type else 1
            pcs_qty = item.shell_qty * content_no
            adjusted_pcs = pcs_qty - item.bad_order_pcs

            stock, _ = Stock.objects.get_or_create(product=product)
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

            # Stock logic
            product = item.product
            content_no = product.unit_type.content_no if product.unit_type else 1
            pcs_qty = item.shell_qty * content_no
            adjusted_pcs = pcs_qty - item.bad_order_pcs

            stock, _ = Stock.objects.get_or_create(product=product)
            stock.quantity_available += max(adjusted_pcs, 0)
            stock.save()

        return instance
    

class StockSerializer(serializers.ModelSerializer):
    product_name = serializers.CharField(source='product.product_name', read_only=True)
    stock_status = serializers.SerializerMethodField()

    class Meta:
        model = Stock
        fields = ['id', 'product', 'product_name', 'quantity_available', 'last_updated', 'stock_status']  # ← ✅ include stock_status

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



# TransactionType Serializer
class TransactionTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = TransactionType
        fields = '__all__'


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'name']


# MerchandisingItem Serializer
class MerchandisingItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MerchandisingItem
        fields = '__all__'


# MiscellaneousItem Serializer
class MiscellaneousItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = MiscellaneousItem
        fields = '__all__'


# Payment Serializer
class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'


# Merchandising Serializer (Main Transaction)
class MerchandisingSerializer(serializers.ModelSerializer):
    items = MerchandisingItemSerializer(many=True)
    misc_items = MiscellaneousItemSerializer(many=True, required=False)
    payments = PaymentSerializer(many=True, required=False)

    class Meta:
        model = Merchandising
        fields = '__all__'

    def create(self, validated_data):
        items_data = validated_data.pop('items')
        misc_items_data = validated_data.pop('misc_items', [])
        payments_data = validated_data.pop('payments', [])

        merchandising = Merchandising.objects.create(**validated_data)

        for item_data in items_data:
            product_id = item_data.get("product")
            product = Product.objects.get(id=product_id)

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

            # ✅ Handle returned empties (ReturnableStock)
            if merchandising_item.empty_return_pcs > 0 or merchandising_item.empty_return_shell > 0:
                ReturnableStock.objects.create(
                    product=product,
                    empty_bottle_qty=merchandising_item.empty_return_pcs,
                    empty_shell_qty=merchandising_item.empty_return_shell,
                    source='customer',
                    supplier=product.supplier  # ✅ Link the return to the correct supplier
                )

            # ✅ Handle returned full items (restock)
            if merchandising_item.actual_return_pcs > 0:
                stock, _ = Stock.objects.get_or_create(product=product)
                stock.quantity_available += merchandising_item.actual_return_pcs
                stock.save()

            # ✅ Deduct sold quantity from stock
            if merchandising_item.sold_pcs > 0:
                stock, _ = Stock.objects.get_or_create(product=product)
                stock.quantity_available -= merchandising_item.sold_pcs
                stock.save()


        for misc_data in misc_items_data:
            MiscellaneousItem.objects.create(merchandising=merchandising, **misc_data)

        for payment_data in payments_data:
            Payment.objects.create(merchandising=merchandising, **payment_data)

        return merchandising

    def update(self, instance, validated_data):
        # Optional: we can add complex update logic if you need
        return super().update(instance, validated_data)


# ReturnableStock Serializer
class ReturnableStockSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReturnableStock
        fields = '__all__'


# SupplierReturnItem Serializer
class SupplierReturnItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierReturnItem
        fields = '__all__'


# SupplierReturn Serializer
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
        # Optional update logic
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

