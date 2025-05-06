from rest_framework import serializers
from .models import Warehouse
from .models import Supplier, SupplierContact
from django.contrib.auth.hashers import make_password
from .models import User, Role
from .models import Van
from .models import ContentType, ShellType, UnitType, Pricing, Product, ProductCategory, Receiving, ReceivingItem, Stock, Route, TransactionType, Merchandising, MerchandisingItem, MiscellaneousItem, ReturnableStock, SupplierReturn, SupplierReturnItem, Payment, Customer



class RoleSerializer(serializers.ModelSerializer):
    """Serializer for Role model"""
    class Meta:
        model = Role
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    """Updated UserSerializer to return role_name and warehouse_name instead of full objects"""
    role_name = serializers.CharField(source='role.name', read_only=True)  # Only the role name
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)  # Only the warehouse name
    
    role_id = serializers.PrimaryKeyRelatedField(
        queryset=Role.objects.all(), source='role', write_only=True
    )
    warehouse_id = serializers.PrimaryKeyRelatedField(
        queryset=Warehouse.objects.all(), source='warehouse', write_only=True
    )

    class Meta:
        model = User
        fields = [
            'id', 'username', 'password', 'first_name', 'last_name', 'gender',
            'phone_number', 'role_name', 'role_id', 'warehouse_name', 'warehouse_id',
            'is_active', 'created_at', 'last_login'
        ]
        extra_kwargs = {'password': {'write_only': True}}  # Hide password from responses

    def create(self, validated_data):
        """Hash password before saving"""
        if 'password' in validated_data:
            validated_data['password'] = make_password(validated_data['password'])
        return super().create(validated_data)

    def update(self, instance, validated_data):
        """Hash password if it's being updated"""
        if 'password' in validated_data:
            validated_data['password'] = make_password(validated_data['password'])

        # Set the role and warehouse based on their IDs
        role_id = validated_data.pop('role', None)
        warehouse_id = validated_data.pop('warehouse', None)

        if role_id is not None:
            instance.role = role_id
        if warehouse_id is not None:
            instance.warehouse = warehouse_id

        return super().update(instance, validated_data)




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

    class Meta:
        model = ReceivingItem
        exclude = ['receiving']
        read_only_fields = ['product_name', 'unit_cost', 'total']

    def create(self, validated_data):
        product_id = validated_data.pop('product_id')
        product = Product.objects.get(id=product_id)
        validated_data['product'] = product
        validated_data['product_name'] = product.product_name
        return ReceivingItem(**validated_data)


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

        for detail in details_data:
            detail_instance = ReceivingItemSerializer().create(detail)
            detail_instance.receiving = receiving
            detail_instance.save()

            # ✅ Update stock (based on saved ReceivingItem logic)
            try:
                product = detail_instance.product
                content_no = product.unit_type.content_no if product.unit_type else 1
                pcs_qty = detail_instance.shell_qty * content_no
                adjusted_pcs = pcs_qty - detail_instance.bad_order_pcs

                stock, _ = Stock.objects.get_or_create(product=product)
                stock.quantity_available += max(adjusted_pcs, 0)
                stock.save()
            except Product.DoesNotExist:
                continue

        return receiving

    def update(self, instance, validated_data):
        details_data = validated_data.pop('details', [])

        # Update Receiving fields
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # Clear old ReceivingItems
        instance.details.all().delete()

        # Save updated items and update stock
        for detail in details_data:
            detail_instance = ReceivingItemSerializer().create(detail)
            detail_instance.receiving = instance
            detail_instance.save()

            try:
                product = detail_instance.product
                content_no = product.unit_type.content_no if product.unit_type else 1
                pcs_qty = detail_instance.shell_qty * content_no
                adjusted_pcs = pcs_qty - detail_instance.bad_order_pcs

                stock, _ = Stock.objects.get_or_create(product=product)
                stock.quantity_available += max(adjusted_pcs, 0)
                stock.save()
            except Product.DoesNotExist:
                continue

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
            MerchandisingItem.objects.create(merchandising=merchandising, **item_data)

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