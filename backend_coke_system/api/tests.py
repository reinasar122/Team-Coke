from io import BytesIO
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image
from rest_framework.test import APIClient

from .models import (
    ContentType,
    Pricing,
    Product,
    ProductCategory,
    ShellType,
    Supplier,
    UnitType,
    Stock,
    TransactionType,
    Warehouse,
)
from .serializers import MerchandisingSerializer


class ProductImageUpdateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.temp_media = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_media.cleanup)

        self.warehouse = Warehouse.objects.create(
            name="Main Warehouse",
            email="warehouse@example.com",
        )
        self.supplier = Supplier.objects.create(
            company_name="Supplier Test Co",
            contact_person="Tester",
            email="supplier@example.com",
        )
        self.category = ProductCategory.objects.create(name="Softdrinks")
        self.shell_type = ShellType.objects.create(description="PET")
        self.content_type = ContentType.objects.create(description="Plastic")
        self.unit_type = UnitType.objects.create(
            content_no=12,
            returnable=False,
            shell_type=self.shell_type,
            content_type=self.content_type,
            content_returnable=False,
        )
        self.price = Pricing.objects.create(
            purchase_price=10,
            selling_price=15,
            shell_price=0,
            bottle_price=0,
        )
        self.product = Product.objects.create(
            system_code="TEST-PROD-0001",
            supplier_code="SUP-001",
            supplier=self.supplier,
            product_name="Sprite Test",
            product_category=self.category,
            unit_type=self.unit_type,
            price=self.price,
            warehouse=self.warehouse,
        )

    def _make_image(self):
        buffer = BytesIO()
        image = Image.new("RGB", (10, 10), color="red")
        image.save(buffer, format="PNG")
        return SimpleUploadedFile(
            "test.png",
            buffer.getvalue(),
            content_type="image/png",
        )

    def test_product_patch_accepts_multipart_image_upload(self):
        media_root = tempfile.mkdtemp(dir=self.temp_media.name)

        with override_settings(MEDIA_ROOT=media_root):
            response = self.client.patch(
                f"/api/products/{self.product.id}/",
                {
                    "system_code": self.product.system_code,
                    "supplier_code": self.product.supplier_code,
                    "supplier": self.supplier.id,
                    "product_name": "Sprite Test Updated",
                    "product_category": self.category.id,
                    "unit_type": self.unit_type.id,
                    "price": self.price.id,
                    "warehouse": self.warehouse.id,
                    "image": self._make_image(),
                },
                format="multipart",
            )

        self.assertEqual(response.status_code, 200, response.content)
        self.product.refresh_from_db()
        self.assertTrue(self.product.image.name.startswith("product_images/"))


class ReservedWarehouseStockTests(TestCase):
    def setUp(self):
        self.warehouse = Warehouse.objects.create(
            name="Main Warehouse",
            email="warehouse-stock@example.com",
        )
        self.supplier = Supplier.objects.create(
            company_name="Reserved Stock Supplier",
            contact_person="Tester",
            email="reserved-stock-supplier@example.com",
        )
        self.category = ProductCategory.objects.create(name="Reserved Softdrinks")
        self.shell_type = ShellType.objects.create(description="Reserved PET")
        self.content_type = ContentType.objects.create(description="Reserved Plastic")
        self.unit_type = UnitType.objects.create(
            content_no=12,
            returnable=False,
            shell_type=self.shell_type,
            content_type=self.content_type,
            content_returnable=False,
        )
        self.price = Pricing.objects.create(
            purchase_price=10,
            selling_price=15,
            shell_price=0,
            bottle_price=0,
        )
        self.product = Product.objects.create(
            system_code="TEST-RESERVED-0001",
            supplier_code="RS-001",
            supplier=self.supplier,
            product_name="Reserved Coke",
            product_category=self.category,
            unit_type=self.unit_type,
            price=self.price,
            warehouse=self.warehouse,
        )
        self.transaction_type, _ = TransactionType.objects.get_or_create(
            name=TransactionType.WAREHOUSE
        )
        self.stock, _ = Stock.objects.get_or_create(
            product=self.product,
            warehouse=self.warehouse,
            defaults={"quantity_available": 100, "quantity_reserved": 0},
        )
        self.stock.quantity_available = 100
        self.stock.quantity_reserved = 0
        self.stock.save(update_fields=["quantity_available", "quantity_reserved"])

    def _payload(self, *, status, sold_pcs, item_id=None, dispatched_pcs=50):
        item = {
            "product": self.product.id,
            "dispatched_pcs": dispatched_pcs,
            "sold_pcs": sold_pcs,
        }
        if item_id is not None:
            item["id"] = item_id

        return {
            "transaction_type": self.transaction_type.id,
            "warehouse": self.warehouse.id,
            "handled_by": "Stock Tester",
            "status": status,
            "items": [item],
        }

    def test_reserved_keeps_stock_until_completed(self):
        create_serializer = MerchandisingSerializer(
            data=self._payload(status="Reserved", sold_pcs=0)
        )
        self.assertTrue(create_serializer.is_valid(), create_serializer.errors)
        sale = create_serializer.save()

        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 100)

        update_serializer = MerchandisingSerializer(
            sale,
            data=self._payload(
                status="Complete",
                sold_pcs=25,
                item_id=sale.items.get().id,
            ),
            partial=True,
        )
        self.assertTrue(update_serializer.is_valid(), update_serializer.errors)
        update_serializer.save()

        self.stock.refresh_from_db()
        self.assertEqual(self.stock.quantity_available, 75)
