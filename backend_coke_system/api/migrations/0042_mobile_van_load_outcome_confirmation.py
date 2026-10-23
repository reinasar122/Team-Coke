import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0041_mobile_van_load_batch"),
    ]

    operations = [
        migrations.AddField(
            model_name="mobilevanloadbatch",
            name="outcomes_confirmed_by",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="+",
                to="api.user",
            ),
        ),
        migrations.AddField(
            model_name="mobilevanloadbatch",
            name="outcomes_confirmed_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
