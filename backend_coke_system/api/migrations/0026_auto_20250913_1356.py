from django.db import migrations
from django.contrib.auth.hashers import make_password
from django.core.exceptions import ObjectDoesNotExist

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
        try:
            admin_user = User(
                username="admin",
                phone_number="09179902969",  # Assigning phone number
                role=admin_role,
                warehouse=default_warehouse,
                password=make_password("admin123")  # hashed password
            )
            admin_user.save()
            print("Default admin user created.")
        except Exception as e:
            print(f"Error creating admin user: {e}")
    
    # Assign full permissions for all submenus for the Admin role
    submenus = [
        "Dashboard", "Stocks", "Product", "Returned Empties", "Sales Report",
        "Inventory Report", "User", "Roles", "Supplier", "Warehouse",
        "Van", "Receiving", "Trading", "Supplier Return", "Credit", "Expenses", "Settings",
    ]
    
    for submenu in submenus:
        try:
            # Create or update access for the submenu
            RoleAccessibility.objects.update_or_create(
                role=admin_role,
                submenu=submenu,
                defaults={
                    "full": True,
                    "view": True,
                    "create": True,
                    "edit": True,
                    "delete": True,
                }
            )
            print(f"Permissions for {submenu} assigned to Admin role.")
        except ObjectDoesNotExist as e:
            print(f"Error assigning permissions for {submenu}: {e}")
        except Exception as e:
            print(f"Unexpected error: {e}")

class Migration(migrations.Migration):

    dependencies = [
        ('api', '0025_miscellaneousitem_created_at_and_more'),  # Update with the correct previous migration
    ]

    operations = [
        migrations.RunPython(create_default_admin),
    ]