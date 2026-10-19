import django.db.models.deletion
import uuid
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("api", "0037_stock_quantity_reserved_sync")]

    operations = [
        migrations.CreateModel(
            name="MobileDeliveryAddress",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("address", models.CharField(max_length=255)),
                ("address_key", models.CharField(editable=False, max_length=64)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("warehouse", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.warehouse")),
            ],
            options={
                "db_table": "mobile_delivery_address", "ordering": ["address", "id"],
                "constraints": [models.UniqueConstraint(fields=("warehouse", "address_key"), name="unique_mobile_delivery_address")],
            },
        ),
        migrations.CreateModel(
            name="MobileDelivery",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("address", models.CharField(max_length=255)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to="api.user")),
                ("destination", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.mobiledeliveryaddress")),
                ("warehouse", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.warehouse")),
            ],
            options={"db_table": "mobile_delivery", "ordering": ["-created_at", "id"]},
        ),
        migrations.CreateModel(
            name="MobileDeliveryOrder",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("order_number", models.CharField(max_length=20)),
                ("delivery", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="orders", to="api.mobiledelivery")),
                ("warehouse", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.warehouse")),
            ],
            options={
                "db_table": "mobile_delivery_order", "ordering": ["order_number"],
                "constraints": [models.UniqueConstraint(fields=("warehouse", "order_number"), name="unique_mobile_delivery_order")],
            },
        ),
    ]
