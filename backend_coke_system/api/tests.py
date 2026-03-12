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
    Warehouse,
)


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
