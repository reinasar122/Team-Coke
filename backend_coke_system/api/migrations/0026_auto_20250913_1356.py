from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_default_admin(apps, schema_editor):
    User = apps.get_model('api', 'User')
    Role = apps.get_model('api', 'Role')
    Warehouse = apps.get_model('api', 'Warehouse')

    # Get or create Admin role and default warehouse
    admin_role = Role.objects.get_or_create(name="Admin")[0]
    default_warehouse = Warehouse.objects.get_or_create(name="Main Warehouse")[0]

    # Create default admin if it doesn't exist
    if not User.objects.filter(username="admin").exists():
        admin_user = User(
            username="admin",
            role=admin_role,
            warehouse=default_warehouse,
            password=make_password("admin123")  # hash the password
        )
        admin_user.save()

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0025_miscellaneousitem_created_at_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_admin),
    ]
