from django.db import models
import uuid
import string
import random
from django.utils import timezone
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
    

class Van(models.Model):
    van_id = models.CharField(max_length=50)
    plate_number = models.CharField(max_length=20)

    def __str__(self):
        return f"{self.van_id} - {self.plate_number}"
    

#Product and Pricing Models

class ContentType(models.Model):
    description = models.TextField()

class ShellType(models.Model):
    description = models.TextField()

class ProductCategory(models.Model):
    name = models.CharField(max_length=100)

    def __str__(self):
        return self.name

class UnitType(models.Model):
    content_no = models.IntegerField()
    shell_type = models.ForeignKey(ShellType, on_delete=models.SET_NULL, null=True)
    returnable = models.BooleanField()
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True)
    content_returnable = models.BooleanField()

class Pricing(models.Model):
    purchase_price = models.FloatField()
    selling_price = models.FloatField()
    shell_price = models.FloatField()
    bottle_price = models.FloatField()

class Product(models.Model):
    system_code = models.TextField()
    supplier_code = models.TextField()
    product_name = models.TextField()
    product_category = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True)
    unit_type = models.ForeignKey(UnitType, on_delete=models.SET_NULL, null=True)
    price = models.ForeignKey(Pricing, on_delete=models.SET_NULL, null=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)

    def save(self, *args, **kwargs):
        if not self.system_code:
            last = Product.objects.order_by('-id').first()
            next_id = last.id + 1 if last else 1
            self.system_code = f"PROD-{next_id:04d}"
        super().save(*args, **kwargs)


class Receiving(models.Model):
    receive_no = models.CharField(max_length=20, unique=True, editable=False)
    date_time = models.DateTimeField(default=timezone.now)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    invoice_no = models.CharField(max_length=100, blank=True, null=True)

    return_total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    receive_total_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    net_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    received_by = models.CharField(max_length=100, blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)

    def save(self, *args, **kwargs):
        if not self.receive_no:
            self.receive_no = self.generate_code()
        super().save(*args, **kwargs)

    def generate_code(self):
        chars = string.ascii_uppercase + string.digits
        while True:
            code = 'RCV-' + ''.join(random.choices(chars, k=6))
            if not Receiving.objects.filter(receive_no=code).exists():
                return code

    def __str__(self):
        return self.receive_no



class ReceivingItem(models.Model):
    receiving = models.ForeignKey('Receiving', related_name="details", on_delete=models.CASCADE)
    product = models.ForeignKey('Product', on_delete=models.CASCADE, null=True)
    product_name = models.CharField(max_length=255, blank=True, null=True)
    pcs_qty = models.PositiveIntegerField(default=0)
    shell_qty = models.PositiveIntegerField(default=0)
    bottle_qty = models.PositiveIntegerField(default=0)
    bad_order_pcs = models.PositiveIntegerField(default=0)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    shell_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    bottle_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        content_no = self.product.unit_type.content_no if self.product and self.product.unit_type else 1

        if self.shell_qty > 0:
            self.pcs_qty = self.shell_qty * content_no
        elif self.pcs_qty > 0:
            self.shell_qty = self.pcs_qty // content_no

        self.bottle_qty = self.pcs_qty

        # Compute unit cost and total
        self.unit_cost = (
            self.unit_price +
            self.bottle_price +
            (self.shell_price / content_no if content_no else 0)
        )

        adjusted_pcs = max(self.pcs_qty - self.bad_order_pcs, 0)
        self.total = self.unit_cost * adjusted_pcs

        super().save(*args, **kwargs)



# === STOCK  ===
class Stock(models.Model):
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    quantity_available = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.product_name} - {self.quantity_available} pcs"

    def stock_status(self):
        if self.quantity_available == 0:
            return "Out of Stock"
        elif self.quantity_available < 1000:
            return "Low"
        elif self.quantity_available < 5000:
            return "Moderate"
        else:
            return "High"
        

class Route(models.Model):
    route_name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.route_name

    
    #   TransactionType
class TransactionType(models.Model):
    name = models.CharField(max_length=100, unique=True)

    def __str__(self):
        return self.name
    
class Customer(models.Model):
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


    #   Merchandising (Main Header)
class Merchandising(models.Model):
    msp_no = models.CharField(max_length=20, unique=True, editable=False)
    transaction_type = models.ForeignKey(TransactionType, on_delete=models.CASCADE)
    handled_by = models.CharField(max_length=100)
    route = models.ForeignKey('Route', on_delete=models.CASCADE)
    van = models.ForeignKey('Van', on_delete=models.CASCADE)
    date_time = models.DateTimeField(default=timezone.now)

    expected_sale = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_sale = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    miscellaneous = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    invoice_no = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=50, default="PENDING")
    remarks = models.TextField(blank=True, null=True)

    # 🔽 NEW FIELDS
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_received = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    change = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def save(self, *args, **kwargs):
        if not self.msp_no:
            prefix = ''
            if self.transaction_type.name.lower() == 'warehouse':
                prefix = 'W'
            elif self.transaction_type.name.lower() == 'van':
                prefix = 'V'
            else:
                prefix = 'X'

            last = Merchandising.objects.filter(transaction_type=self.transaction_type).order_by('-id').first()
            next_number = 1 if not last else int(last.msp_no.split('-')[-1]) + 1
            self.msp_no = f"{prefix}-{next_number:04d}"

        super().save(*args, **kwargs)



        
# 7. MerchandisingItem (Per-product Detail)
class MerchandisingItem(models.Model):
    merchandising = models.ForeignKey(Merchandising, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey('Product', on_delete=models.CASCADE)

    dispatched_pcs = models.PositiveIntegerField(default=0)
    dispatched_shell = models.PositiveIntegerField(default=0)

    sold_pcs = models.PositiveIntegerField(default=0)
    sold_shell = models.PositiveIntegerField(default=0)

    empty_return_pcs = models.PositiveIntegerField(default=0)
    empty_return_shell = models.PositiveIntegerField(default=0)

    discrepancy_empties_pc = models.PositiveIntegerField(default=0)
    discrepancy_empties_shell = models.PositiveIntegerField(default=0)


    actual_return_pcs = models.PositiveIntegerField(default=0)
    actual_return_shell = models.PositiveIntegerField(default=0)

    discrepancy_full_pcs = models.PositiveIntegerField(default=0)
    discrepancy_full_shell = models.PositiveIntegerField(default=0)

    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    expected_sale = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_sale = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    def __str__(self):
        return f"{self.product.name} - {self.merchandising.msp_no}"


# 9. ReturnableStock
# filepath: c:\Users\Lenizo.karenzoe\Desktop\Inventory 111\coke-POS-system\backend_coke_system\api\models.py
class ReturnableStock(models.Model):
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    empty_bottle_qty = models.PositiveIntegerField(default=0)
    empty_shell_qty = models.PositiveIntegerField(default=0)
    source = models.CharField(
        max_length=20,
        choices=[('customer', 'Customer'), ('supplier', 'Supplier')],
        default='customer'  # Provide a default value here
    )
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.product.name} Returnables from {self.source}"

# 10. SupplierReturn
class SupplierReturn(models.Model):
    supplier = models.ForeignKey('Supplier', on_delete=models.CASCADE)
    return_no = models.CharField(max_length=20, unique=True)
    date_returned = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)

    def __str__(self):
        return self.return_no

# 11. SupplierReturnItem
class SupplierReturnItem(models.Model):
    supplier_return = models.ForeignKey(SupplierReturn, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    returned_empty_pcs = models.PositiveIntegerField(default=0)
    returned_empty_shell = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.product.name} returned"
    

class MiscellaneousItem(models.Model):
    merchandising = models.ForeignKey(Merchandising, related_name='misc_items', on_delete=models.CASCADE)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    receipt_file = models.FileField(upload_to='misc_receipts/', blank=True, null=True)  # <-- Add this line

    def __str__(self):
        return f"{self.description} - ₱{self.amount}"



class Payment(models.Model):
    merchandising = models.ForeignKey(Merchandising, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=50)
    date_paid = models.DateTimeField(auto_now_add=True)
    reference_no = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.method} - ₱{self.amount}"
