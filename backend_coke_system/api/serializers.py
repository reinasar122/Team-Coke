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
    role_name = serializers.CharField(source='role.name', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.name', read_only=True)

    # These are the fields that will receive the ID from the frontend when updating
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

    def update(self, instance, validated_data):
        # Extract and update role and warehouse IDs
        role_id = validated_data.pop('role', None)
        warehouse_id = validated_data.pop('warehouse', None)

        if role_id:
            # Ensure role exists before assigning
            instance.role = role_id
        if warehouse_id:
            # Ensure warehouse exists before assigning
            instance.warehouse = warehouse_id

        # Update other fields as usual
        instance = super().update(instance, validated_data)

        # Manually update role_name and warehouse_name after update
        instance.role_name = instance.role.name if instance.role else None
        instance.warehouse_name = instance.warehouse.name if instance.warehouse else None

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
                source='customer'
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