from rest_framework import serializers
from .models import Warehouse
from .models import Supplier, SupplierContact


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
