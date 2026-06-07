from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0002_add_stock_tracking'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='PurchaseOrder',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('status', models.CharField(
                    choices=[('draft', 'Черновик'), ('ordered', 'Заказано'), ('received', 'Получено')],
                    default='draft', max_length=20, verbose_name='Статус')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('received_at', models.DateTimeField(blank=True, null=True)),
                ('notes', models.TextField(blank=True, verbose_name='Заметки')),
                ('created_by', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='purchase_orders',
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={
                'verbose_name': 'Заказ на закупку',
                'verbose_name_plural': 'Заказы на закупку',
                'ordering': ['-created_at'],
            },
        ),
        migrations.CreateModel(
            name='PurchaseOrderItem',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('qty_ordered', models.DecimalField(decimal_places=3, max_digits=10, verbose_name='Заказано')),
                ('qty_received', models.DecimalField(decimal_places=3, default=0, max_digits=10, verbose_name='Получено')),
                ('unit_price', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Цена')),
                ('order', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='items',
                    to='inventory.purchaseorder',
                )),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='purchase_items',
                    to='inventory.product',
                )),
            ],
            options={
                'verbose_name': 'Позиция заказа',
                'verbose_name_plural': 'Позиции заказа',
                'unique_together': {('order', 'product')},
            },
        ),
    ]