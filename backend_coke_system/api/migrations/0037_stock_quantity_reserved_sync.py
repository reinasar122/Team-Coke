from django.db import migrations, models


def _column_exists(schema_editor, table_name, column_name):
    with schema_editor.connection.cursor() as cursor:
        columns = {
            col.name
            for col in schema_editor.connection.introspection.get_table_description(
                cursor, table_name
            )
        }
    return column_name in columns


def add_quantity_reserved_if_missing(apps, schema_editor):
    Stock = apps.get_model("api", "Stock")
    table_name = Stock._meta.db_table
    column_name = "quantity_reserved"

    if _column_exists(schema_editor, table_name, column_name):
        # Existing production DB already has this column, but without a DB default.
        # Ensure inserts that bypass ORM defaults still get 0.
        if schema_editor.connection.vendor == "mysql":
            schema_editor.execute(
                f"ALTER TABLE `{table_name}` MODIFY `{column_name}` int unsigned NOT NULL DEFAULT 0"
            )
        return

    field = models.PositiveIntegerField(default=0)
    field.set_attributes_from_name(column_name)
    schema_editor.add_field(Stock, field)


def remove_quantity_reserved_if_present(apps, schema_editor):
    Stock = apps.get_model("api", "Stock")
    table_name = Stock._meta.db_table
    column_name = "quantity_reserved"

    if not _column_exists(schema_editor, table_name, column_name):
        return

    field = models.PositiveIntegerField(default=0)
    field.set_attributes_from_name(column_name)
    schema_editor.remove_field(Stock, field)


class Migration(migrations.Migration):
    dependencies = [
        ("api", "0036_merge_20260409_0000"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(
                    add_quantity_reserved_if_missing,
                    remove_quantity_reserved_if_present,
                )
            ],
            state_operations=[
                migrations.AddField(
                    model_name="stock",
                    name="quantity_reserved",
                    field=models.PositiveIntegerField(default=0),
                )
            ],
        ),
    ]
