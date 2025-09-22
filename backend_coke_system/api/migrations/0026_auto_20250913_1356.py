from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_default_admin(apps, schema_editor):
    User = apps.get_model('api', 'User')
    Role = apps.get_model('api', 'Role')
    Warehouse = apps.get_model('api', 'Warehouse')
    RoleAccessibility = apps.get_model('api', 'RoleAccessibility')

    # Create Admin role if it doesn't exist
    admin_role, _ = Role.objects.get_or_create(name="Admin")

    # Create default warehouse if it doesn't exist
    default_warehouse, _ = Warehouse.objects.get_or_create(name="Main Warehouse")

    # Create default admin user if it doesn't exist
    if not User.objects.filter(username="admin").exists():
        admin_user = User(
            username="admin",
            role=admin_role,
            warehouse=default_warehouse,
            password=make_password("admin123"),  # hashed password
        )
        admin_user.save()

    # Predefined submenus (strings)
    submenus = [
        "Dashboard", "Stocks", "Product", "Returned Empties", "Sales Report",
        "Inventory Report", "User", "Roles", "Supplier", "Warehouse",
        "Van", "Receiving", "Trading", "Supplier Return", "Credit", "Expenses", "Settings",
    ]

    # Ensure Admin has full access to all submenus
    for submenu_name in submenus:
        RoleAccessibility.objects.update_or_create(
            role=admin_role,
            submenu=submenu_name,   # 👈 string field
            defaults={
                "full": True,
                "view": True,
                "create": True,
                "edit": True,
                "delete": True,
            }
        )

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0025_miscellaneousitem_created_at_and_more'),
    ]

    operations = [
        migrations.RunPython(create_default_admin),
    ]
