"""
Финальный шаг: убирает Shift, Receipt, EntryTicket, Printer, PrintJob,
DeletedOrderItem из состояния apps.orders.

1. Обновляет FK Order.shift       → shifts.Shift
2. Обновляет FK OrderItem.receipt → receipts.Receipt
3. Удаляет все перенесённые модели из состояния orders (DB не трогаем).
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ('orders',   '0014_move_menu_to_menu_app'),
        ('shifts',   '0001_initial'),
        ('receipts', '0001_initial'),
        ('tickets',  '0001_initial'),
        ('printers', '0001_initial'),
        ('audit',    '0001_initial'),
    ]
    operations = [
        # Перепривязываем FK в состоянии (таблицы не меняются)
        migrations.AlterField(
            model_name='order',
            name='shift',
            field=models.ForeignKey(
                'shifts.Shift',
                on_delete=django.db.models.deletion.CASCADE,
                related_name='orders',
            ),
        ),
        migrations.AlterField(
            model_name='orderitem',
            name='receipt',
            field=models.ForeignKey(
                'receipts.Receipt',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True, blank=True,
                related_name='items',
            ),
        ),
        # Убираем перенесённые модели из состояния orders
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.DeleteModel('PrintJob'),
                migrations.DeleteModel('Printer'),
                migrations.DeleteModel('DeletedOrderItem'),
                migrations.DeleteModel('EntryTicket'),
                migrations.DeleteModel('Receipt'),
                migrations.DeleteModel('Shift'),
            ],
            database_operations=[],
        ),
    ]
