from rest_framework import serializers
from .models import Warehouse
from .models import Supplier, SupplierContact
from django.contrib.auth.hashers import make_password
from .models import User, Role
from .models import ContentType, ShellType, UnitType, Pricing, Product


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
    


#ProductSerializer

class ContentTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentType
        fields = '__all__'

class ShellTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ShellType
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

    class Meta:
        model = Product
        fields = '__all__'
