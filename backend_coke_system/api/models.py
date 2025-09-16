from django.db import models, transaction
import uuid
import string
import random
from django.utils import timezone
from django.contrib.auth.hashers import make_password, check_password
from django.core.validators import MinValueValidator, MaxValueValidator
from decimal import Decimal
from django.core.exceptions import ValidationError
# app: sales (or whatever app holds Merchandising)
from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from django.db.models import Q


from django.db.models.signals import post_migrate
from django.dispatch import receiver


class CreditLedger(models.Model):
    STATUS_PENDING = "PENDING"
    STATUS_PARTIAL = "PARTIAL"
    STATUS_PAID = "PAID"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_PARTIAL, "Partially Paid"),
        (STATUS_PAID, "Fully Paid"),
    ]

    # ADD WAREHOUSE FIELD
    warehouse = models.ForeignKey(
        "api.Warehouse",  # Assuming you have a Warehouse model
        on_delete=models.CASCADE,
        related_name="credit_ledgers"
    )

    # Link to your real Merchandising model in the SAME app
    merchandising = models.ForeignKey(
        "api.Merchandising",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="credit_ledgers",
    )

    # header / identity
    msp_no = models.CharField(max_length=50, db_index=True)
    customer_name = models.CharField(max_length=255, blank=True, default="Walk-in")
    handled_by = models.CharField(max_length=255, blank=True, default="")
    transaction_type = models.CharField(max_length=50, blank=True, default="")
    remarks = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    due_date = models.DateTimeField(null=True, blank=True)
    payment_terms_days = models.PositiveIntegerField(default=30)

    # money
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0)])
    amount_paid = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_PENDING)

    # optional raw rows snapshot (for the "receipt")
    rows_json = models.JSONField(default=list, blank=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def balance(self):
        return max(self.total_amount - self.amount_paid, 0)

    def recalc_status(self, save=True):
        if self.amount_paid <= 0:
            self.status = self.STATUS_PENDING
        elif self.amount_paid < self.total_amount:
            self.status = self.STATUS_PARTIAL
        else:
            self.status = self.STATUS_PAID
        if save:
            self.save(update_fields=["status"])

    def apply_payment(self, amount: float):
        self.amount_paid = (self.amount_paid or 0) + amount
        self.recalc_status(save=False)
        self.save(update_fields=["amount_paid", "status"])



class CreditPayment(models.Model):
    METHOD_CASH = "cash"
    METHOD_BANK = "bank"
    METHOD_EWALLET = "ewallet"
    METHOD_CHOICES = [
        (METHOD_CASH, "Cash"),
        (METHOD_BANK, "Bank"),
        (METHOD_EWALLET, "E-wallet"),
    ]

    credit = models.ForeignKey(CreditLedger, on_delete=models.CASCADE, related_name="payments")
    amount = models.DecimalField(max_digits=12, decimal_places=2, validators=[MinValueValidator(0.01)])
    method = models.CharField(max_length=20, choices=METHOD_CHOICES, default=METHOD_CASH)
    note = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(default=timezone.now)
    recorded_by = models.CharField(max_length=255, blank=True, default="")  # optional: user name

    class Meta:
        ordering = ["-created_at"]


class Warehouse(models.Model):
    name = models.CharField(max_length=255)
    country = models.CharField(max_length=100, default="Philippines")
    region = models.CharField(max_length=100, default="", blank=True)
    province = models.CharField(max_length=100, default="", blank=True)
    city = models.CharField(max_length=100, default="", blank=True)
    barangay = models.CharField(max_length=255, default="", blank=True)
    street_address = models.CharField(max_length=255, default="", blank=True)
    zip_code = models.CharField(max_length=10, default="", blank=True)
    phone_number = models.CharField(max_length=20, default="", blank=True)
    email = models.EmailField(default="", blank=True)
    def __str__(self):
        return self.name

class Supplier(models.Model):
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=20, unique=True, editable=False)
    bir_no = models.CharField(max_length=100, blank=True, null=True)
    contact_person = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    phone_number = models.CharField(max_length=50)
    country = models.CharField(max_length=100, default="Philippines")
    region = models.CharField(max_length=100, default="", blank=True)
    province = models.CharField(max_length=100, default="", blank=True)
    city = models.CharField(max_length=100, default="", blank=True)
    barangay = models.CharField(max_length=255, default="", blank=True)
    street_address = models.CharField(max_length=255, default="", blank=True)
    zip_code = models.CharField(max_length=10, default="", blank=True)

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
    name = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.name

class RoleAccessibility(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE)
    submenu = models.CharField(max_length=100)

    full = models.BooleanField(default=False)
    view = models.BooleanField(default=False)
    create = models.BooleanField(default=False)
    edit = models.BooleanField(default=False)
    delete = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('role', 'submenu')

    def __str__(self):
        return f"{self.role.name} - {self.submenu} (F:{self.full} V:{self.view} C:{self.create} E:{self.edit} D:{self.delete})"


class User(models.Model):
    STATUS_CHOICES = [(True, 'Active'), (False, 'Inactive')]
    GENDER_CHOICES = [('Male', 'Male'), ('Female', 'Female'), ('Other', 'Other')]

    id = models.AutoField(primary_key=True)
    email = models.EmailField(unique=True, null=True, blank=True)  # ✅ REQUIRED for sending email
    password = models.CharField(max_length=255)
    must_change_password = models.BooleanField(default=True)
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
        self.password = make_password(raw_password)
        self.save()

    def check_password(self, raw_password):
        return check_password(raw_password, self.password)


class Van(models.Model):
    van_id = models.CharField(max_length=50)
    plate_number = models.CharField(max_length=20)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, related_name='vans')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.van_id} - {self.plate_number} ({self.warehouse.name})"

    class Meta:
        unique_together = [['van_id', 'warehouse'], ['plate_number', 'warehouse']]

class ContentType(models.Model):
    description = models.TextField()

    def __str__(self):
        return self.description

class ShellType(models.Model):
    description = models.TextField()

    def __str__(self):
        return self.description

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

    def __str__(self):
        return f"{self.content_no} units - {self.shell_type}"

class Pricing(models.Model):
    purchase_price = models.FloatField()
    selling_price = models.FloatField()
    shell_price = models.FloatField()
    bottle_price = models.FloatField()

    def __str__(self):
        return f"₱{self.selling_price:.2f}"

class Product(models.Model):
    system_code = models.CharField(max_length=100, unique=True)
    supplier_code = models.CharField(max_length=100, blank=True, null=True)
    product_name = models.CharField(max_length=255)
    product_category = models.ForeignKey(ProductCategory, on_delete=models.SET_NULL, null=True)
    unit_type = models.ForeignKey(UnitType, on_delete=models.SET_NULL, null=True)
    price = models.ForeignKey(Pricing, on_delete=models.SET_NULL, null=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey(Warehouse, on_delete=models.CASCADE,  null=True, blank=True)  # NEW: Add warehouse field
    image = models.ImageField(upload_to='product_images/', null=True, blank=True)  # NEW: Image field

    def save(self, *args, **kwargs):
        if not self.system_code:
            last = Product.objects.order_by('-id').first()
            next_id = last.id + 1 if last else 1
            self.system_code = f"PROD-{next_id:04d}"
        super().save(*args, **kwargs)

    def __str__(self):
        return self.product_name

    @property
    def image_url(self):
        """Return image URL or None if no image"""
        if self.image:
            return self.image.url
        return None


# You can continue the remaining models following the same patterns...



class Receiving(models.Model):
    receive_no = models.CharField(max_length=20, unique=True, editable=False)
    date_time = models.DateTimeField(default=timezone.now)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    invoice_no = models.CharField(max_length=100, blank=True, null=True)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)

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
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)
    quantity_available = models.PositiveIntegerField(default=0)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['product', 'warehouse']  # Ensure unique stock per product per warehouse

    def __str__(self):
        if self.warehouse:
            return f"{self.product.product_name} - {self.warehouse.name} - {self.quantity_available} pcs"
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
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE)  # ADD THIS

    def __str__(self):
        return self.route_name

class TransactionType(models.Model):
    VAN_LOAD = "Van Load"
    WAREHOUSE = "Warehouse"
    ALLOWED_TYPES = [VAN_LOAD, WAREHOUSE]

    name = models.CharField(max_length=100, unique=True)

    def clean(self):
        if self.name not in self.ALLOWED_TYPES:
            raise ValidationError(f"Invalid transaction type: '{self.name}'")

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

@receiver(post_migrate)
def create_default_transaction_types(sender, **kwargs):
    for t_name in TransactionType.ALLOWED_TYPES:
        TransactionType.objects.get_or_create(name=t_name)


class Customer(models.Model):
    name = models.CharField(max_length=255)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)  # ADD THIS

    def __str__(self):
        return self.name
    
    class Meta:
        ordering = ['name']
    


def _local_day(dt):
    # Equivalent to your astimezone logic, but clearer/shorter
    return timezone.localdate(dt or timezone.now())  
    
# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def _tt_lower(tt):
    return (tt.name or '').strip().lower()

def _local_day(dt):
    tz = timezone.get_current_timezone()
    return (dt or timezone.now()).astimezone(tz).date()

def _prefix_for(tt):
    name = _tt_lower(tt)
    if name == 'warehouse': return 'WA'
    if name == 'van load':  return 'VA'
    return 'XX'


# ------------------------------------------------------------
# MerchandisingSale (your separate listing/summary model)
# ------------------------------------------------------------
class MerchandisingSale(models.Model):
    msp_no = models.CharField(max_length=100)
    date_time = models.DateTimeField()
    transaction_type_name = models.CharField(max_length=100)
    customer_name = models.CharField(max_length=255)
    route = models.ForeignKey('Route', null=True, blank=True, on_delete=models.SET_NULL)
    handled_by = models.CharField(max_length=100)
    total_trading_amount = models.DecimalField(max_digits=10, decimal_places=2)
    total_expenses_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=50)

    def __str__(self):
        return f"{self.msp_no} - {self.customer_name}"


# ------------------------------------------------------------
# MSP daily sequence (for Van Load)
# ------------------------------------------------------------
class MSPSequence(models.Model):
    # allow null for van-load (continuous) counter
    date = models.DateField(null=True, blank=True)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE)
    transaction_type = models.ForeignKey('TransactionType', on_delete=models.CASCADE)
    last_number = models.PositiveIntegerField(default=0)

    class Meta:
        # remove old unique_together
        # unique_together = ('date', 'warehouse', 'transaction_type')
        constraints = [
            # one row per DAY *only when date is not null*  → for Warehouse
            models.UniqueConstraint(
                fields=['date', 'warehouse', 'transaction_type'],
                condition=Q(date__isnull=False),
                name='uniq_msp_per_day'
            ),
            # one timeless row per (warehouse, tt) *only when date is null* → for Van Load
            models.UniqueConstraint(
                fields=['warehouse', 'transaction_type'],
                condition=Q(date__isnull=True),
                name='uniq_msp_vanload'
            ),
        ]

    def __str__(self):
        d = self.date.isoformat() if self.date else 'None'
        return f"{d} {self.warehouse_id} {self.transaction_type_id} -> {self.last_number}"

# ------------------------------------------------------------
# Merchandising (main header)
# ------------------------------------------------------------
class Merchandising(models.Model):
    msp_no = models.CharField(max_length=20, editable=False)  # not unique (by design)
    transaction_type = models.ForeignKey('TransactionType', on_delete=models.CASCADE)
    handled_by = models.CharField(max_length=100)
    route = models.ForeignKey('Route', null=True, blank=True, on_delete=models.SET_NULL)
    van = models.ForeignKey('Van', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)
    customer = models.ForeignKey('Customer', on_delete=models.SET_NULL, null=True, blank=True)
    date_time = models.DateTimeField(default=timezone.now)

    expected_sale = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    actual_sale = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    discrepancy_non_empty = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    discrepancy_empty = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    miscellaneous = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=50, blank=True, null=True)
    invoice_no = models.CharField(max_length=20, blank=True, null=True)
    status = models.CharField(max_length=50, default="PENDING")
    remarks = models.TextField(blank=True, null=True)

    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    cash_received = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    change = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    # ✅ NEW: used by the /api/van-load-return/ endpoint so stocks aren’t added twice
    full_returns_applied = models.BooleanField(default=False)

    

    def save(self, *args, **kwargs):
        is_new = self._state.adding
        if is_new and not self.msp_no:
            # ensure there is some dt set
            if not self.date_time:
                self.date_time = timezone.now()

            tt = self.transaction_type
            tt_name = (tt.name or "").strip().lower()
            prefix = _prefix_for(tt)

            if tt_name == 'warehouse':
                # Always use server-local “today”
                today = timezone.localdate()
                # Also store server time (ignore client datetime for MSP purposes)
                self.date_time = timezone.now()

                with transaction.atomic():
                    # 1) Get or create the daily row
                    seq, created = MSPSequence.objects.select_for_update().get_or_create(
                        date=today,
                        warehouse=self.warehouse,
                        transaction_type=tt,
                        defaults={'last_number': 0}
                    )

                    if created or seq.last_number == 0:
                        # 2) First Warehouse transaction today → decide today's number
                        #    Find the last used number across any previous day for this warehouse
                        last_rec = (
                            Merchandising.objects
                            .filter(warehouse=self.warehouse, transaction_type=tt)
                            .exclude(msp_no__isnull=True)
                            .order_by('-id')
                            .first()
                        )
                        if last_rec and '-' in last_rec.msp_no:
                            try:
                                prev_num = int(last_rec.msp_no.split('-')[1])
                            except ValueError:
                                prev_num = 0
                        else:
                            prev_num = 0

                        seq.last_number = prev_num + 1  # today’s fixed number
                        seq.save(update_fields=['last_number'])

                    # 3) Reuse the same number for the rest of the day
                    self.msp_no = f'{prefix}-{seq.last_number:04d}'

            elif tt_name == 'van load':
                with transaction.atomic():
                    seq, created = MSPSequence.objects.select_for_update().get_or_create(
                        date=None,                        # ← ensure the single timeless row
                        warehouse=self.warehouse,
                        transaction_type=tt,
                        defaults={'last_number': 0}
                    )
                    seq.last_number += 1
                    seq.save(update_fields=['last_number'])
                    self.msp_no = f'{prefix}-{seq.last_number:04d}'

            else:
                self.msp_no = f'{prefix}-0001'

        super().save(*args, **kwargs)

# ------------------------------------------------------------
# MerchandisingItem
# ------------------------------------------------------------
class MerchandisingItem(models.Model):
    merchandising = models.ForeignKey(Merchandising, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey('Product', on_delete=models.CASCADE)

    dispatched_pcs = models.PositiveIntegerField(default=0)
    dispatched_shell = models.PositiveIntegerField(default=0)

    selling_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    sold_pcs = models.PositiveIntegerField(default=0)
    sold_shell = models.PositiveIntegerField(default=0)

    empty_price_shell = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    empty_price_pc = models.DecimalField(max_digits=10, decimal_places=2, default=0)

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
         return f"{self.product.product_name} - {self.merchandising.msp_no}"

    def save(self, *args, **kwargs):
        if self.product and getattr(self.product, 'price', None):
            self.selling_price = self.product.price.selling_price or 0
            self.empty_price_pc = self.product.price.bottle_price or 0
            self.empty_price_shell = self.product.price.shell_price or 0
        super().save(*args, **kwargs)


class MiscellaneousItem(models.Model):
    merchandising = models.ForeignKey(
        Merchandising, related_name='misc_items', on_delete=models.CASCADE
    )
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    receipt_file = models.FileField(upload_to='misc_receipts/', blank=True, null=True)
    notes = models.CharField(max_length=255, blank=True, null=True) 

    # timestamps
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True)
    

    def __str__(self):
        return f"{self.description} - ₱{self.amount}"

    def __str__(self):
        return f"{self.description} - ₱{self.amount}"
    
class ReturnableStock(models.Model):
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    empty_bottle_qty = models.PositiveIntegerField(default=0)
    empty_shell_qty = models.PositiveIntegerField(default=0)
    source = models.CharField(
        max_length=20,
        choices=[('customer', 'Customer'), ('supplier', 'Supplier')],
        default='customer'
    )
    supplier = models.ForeignKey('Supplier', on_delete=models.SET_NULL, null=True, blank=True)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)  # ADD THIS
    last_updated = models.DateTimeField(auto_now=True)

    def __str__(self):
          return f"{self.product.product_name} Returnables from {self.source}"
    
    class Meta:
        unique_together = ("product", "warehouse", "source", "supplier")

class SupplierReturn(models.Model):
    supplier = models.ForeignKey('Supplier', on_delete=models.CASCADE)
    return_no = models.CharField(max_length=20, unique=True)
    date_returned = models.DateTimeField(auto_now_add=True)
    remarks = models.TextField(blank=True, null=True)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)  # ADD THIS

    def __str__(self):
        return self.return_no

class SupplierReturnItem(models.Model):
    supplier_return = models.ForeignKey(SupplierReturn, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey('Product', on_delete=models.CASCADE)
    returned_empty_pcs = models.PositiveIntegerField(default=0)
    returned_empty_shell = models.PositiveIntegerField(default=0)
    
    def __str__(self):
        return f"{self.product.product_name} returned"  # ✅ product_name


class Payment(models.Model):
    merchandising = models.ForeignKey(Merchandising, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    method = models.CharField(max_length=50)
    date_paid = models.DateTimeField(auto_now_add=True)
    reference_no = models.CharField(max_length=100, blank=True, null=True)

    def __str__(self):
        return f"{self.method} - ₱{self.amount}"


class SupplierReturnForm(models.Model):
    sup_no = models.CharField(max_length=20, unique=True)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE, null=True, blank=True)  # ADD THIS
    date = models.DateTimeField()
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.sup_no} - {self.warehouse.name}"

class SupplierReturnFormItem(models.Model):
    supplier_return = models.ForeignKey(SupplierReturnForm, related_name='items', on_delete=models.CASCADE)
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    qty_shell = models.PositiveIntegerField()
    qty_pcs = models.PositiveIntegerField()
    bottle_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    shell_price = models.DecimalField(max_digits=12, decimal_places=2, default=0.00)
    line_total = models.DecimalField(max_digits=12, decimal_places=2)

    def __str__(self):
        return f"{self.product.product_name} ({self.qty_shell} shell)"
    

class Invoice(models.Model):
    invoice_no = models.CharField(max_length=50, unique=True)
    customer_name = models.CharField(max_length=255)
    date = models.DateTimeField(auto_now_add=True)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(
        max_length=20,
        choices=[("Pending", "Pending"), ("Paid", "Paid"), ("Cancelled", "Cancelled")],
        default="Pending"
    )

    def __str__(self):
     return f"Invoice {self.invoice_no} - {self.customer_name}"