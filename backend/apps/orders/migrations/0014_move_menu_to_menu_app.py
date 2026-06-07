"""
Убирает MenuCategory и MenuItem из состояния apps.orders.
1. Обновляет OrderItem.menu_item → ссылается на menu.MenuItem.
2. Удаляет MenuCategory и MenuItem из состояния orders (без DB-изменений).
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0013_alter_printjob_kind'),
        ('menu', '0001_initial'),
    ]
    operations = [
        # Перепривязываем FK в состоянии Django (таблица не меняется)
        migrations.AlterField(
            model_name='orderitem',
            name='menu_item',
            field=models.ForeignKey(
                'menu.MenuItem',
                on_delete=django.db.models.deletion.PROTECT,
            ),
        ),
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel('MenuCategory'),
                migrations.DeleteModel('MenuItem'),
            ],
            database_operations=[],
        ),
    ]