from django.db import models
import uuid

class Warehouse(models.Model):
    name = models.CharField(max_length=255, unique=True)
    street = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    country = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)
    phone_number = models.CharField(max_length=50)
    email = models.EmailField(unique=True)

    def __str__(self):
        return self.name
    
class Supplier(models.Model):
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=20, unique=True, editable=False)
    bir_no = models.CharField(max_length=100, blank=True, null=True)
    contact_person = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=50)
    street_address = models.CharField(max_length=255)
    city = models.CharField(max_length=100)
    region = models.CharField(max_length=100)
    zip_code = models.CharField(max_length=20)

    def save(self, *args, **kwargs):
        if not self.registration_number:
            self.registration_number = f"SUP-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.company_name
    

class SupplierContact(models.Model):
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name="contacts")
    contact_person = models.CharField(max_length=255)
    email = models.EmailField()
    phone_number = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.contact_person} ({self.supplier.company_name})"