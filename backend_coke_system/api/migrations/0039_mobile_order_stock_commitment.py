import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("api", "0038_mobile_deliveries")]
    operations = [migrations.CreateModel(
        name="MobileOrderStockCommitment",
        fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("order_number", models.CharField(max_length=20)),
            ("quantities", models.JSONField(default=dict)),
            ("active", models.BooleanField(default=True)),
            ("confirmed_at", models.DateTimeField(auto_now_add=True)),
            ("warehouse", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, to="api.warehouse")),
            ("confirmed_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to="api.user")),
            ("merchandising", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="mobile_stock_commitment", to="api.merchandising")),
        ],
        options={
            "db_table": "mobile_order_stock_commitment",
            "constraints": [models.UniqueConstraint(fields=("warehouse", "order_number"), name="unique_mobile_stock_commitment")],
        },
    )]
