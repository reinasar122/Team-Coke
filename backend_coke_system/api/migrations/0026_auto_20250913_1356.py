from django.db import migrations
from django.contrib.auth.hashers import make_password

def create_default_admin(apps, schema_editor):
    User = apps.get_model('api', 'User')
    Role = apps.get_model('api', 'Role')
    Warehouse = apps.get_model('api', 'Warehouse')
    RoleAccessibility = apps.get_model('api', 'RoleAccessibility')

    # Ensure Admin role + warehouse
    admin_role, _ = Role.objects.get_or_create(name="Admin")
    default_warehouse, _ = Warehouse.objects.get_or_create(name="Main Warehouse")

    # Always ensure an admin user exists
    admin_user, created = User.objects.get_or_create(
        username="admin",
        defaults={
            "password": make_password("admin123"),
            "first_name": "System",
            "last_name": "Administrator",
            "gender": "Other",  # optional
            "email": "admin@example.com",
            "phone_number": "0000000000",
            "role": admin_role,
            "warehouse": default_warehouse,
            "is_active": True,
        }
    )
    if not created:
        # Reset password + update role/warehouse if user already exists
        admin_user.password = make_password("admin123")
        admin_user.role = admin_role
        admin_user.warehouse = default_warehouse
        admin_user.first_name = "System"
        admin_user.last_name = "Administrator"
        if not admin_user.email:
            admin_user.email = "admin@example.com"
        admin_user.is_active = True
        admin_user.save()

    # Predefined submenus
    submenus = [
        "Dashboard", "Stocks", "Product", "Returned Empties", "Sales Report",
        "Inventory Report", "User", "Roles", "Supplier", "Warehouse",
        "Van", "Receiving", "Trading", "Supplier Return", "Credit", "Expenses", "Settings",
    ]

    for submenu_name in submenus:
        RoleAccessibility.objects.update_or_create(
            role=admin_role,
            submenu=submenu_name,
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
