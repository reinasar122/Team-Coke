from django.db import models
import uuid
from django.contrib.auth.hashers import make_password, check_password  # Use Django's secure hashers

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
    

class Role(models.Model):
    """Separate Role model to manage roles and optionally associate with warehouses."""
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name


class User(models.Model):
    """Updated User model with ForeignKey relationships."""
    STATUS_CHOICES = [
        (True, 'Active'),
        (False, 'Inactive'),
    ]

    GENDER_CHOICES = [
        ('Male', 'Male'),
        ('Female', 'Female'),
        ('Other', 'Other'),
    ]

    id = models.AutoField(primary_key=True)
    password = models.CharField(max_length=255)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True, null=True)
    username = models.CharField(max_length=150, unique=True)
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    role = models.ForeignKey(Role, on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.SET_NULL, null=True, blank=True)

    is_active = models.BooleanField(choices=STATUS_CHOICES, default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_login = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = 'users'

    def __str__(self):
        return self.username

    def set_password(self, raw_password):
        """Automatically hash password before saving."""
        self.password = make_password(raw_password)
        self.save()

    def check_password(self, raw_password):
        """Check hashed password."""
        return check_password(raw_password, self.password)
