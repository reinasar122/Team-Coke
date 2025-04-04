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