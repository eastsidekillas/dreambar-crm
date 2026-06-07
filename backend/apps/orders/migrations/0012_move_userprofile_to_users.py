from django.db import migrations


class Migration(migrations.Migration):
    """
    Удаляет UserProfile из состояния apps.orders.
    Модель переехала в apps.users — таблица orders_userprofile не изменяется.
    """
    dependencies = [
        ('orders', '0011_add_deleted_order_item_log'),
        ('users', '0001_initial'),
    ]
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[migrations.DeleteModel('UserProfile')],
            database_operations=[],
        ),
    ]