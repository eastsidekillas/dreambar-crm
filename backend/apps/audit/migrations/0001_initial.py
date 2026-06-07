from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('orders', '0014_move_menu_to_menu_app'),
        ('shifts', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='DeletedOrderItem',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('order', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deleted_items', to='orders.order')),
                        ('shift', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deleted_items', to='shifts.shift')),
                        ('deleted_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='deleted_order_items', to=settings.AUTH_USER_MODEL)),
                        ('deleted_at', models.DateTimeField(auto_now_add=True)),
                        ('table_number', models.CharField(blank=True, max_length=10)),
                        ('menu_item_name', models.CharField(max_length=200)),
                        ('menu_item_volume', models.CharField(blank=True, max_length=50)),
                        ('quantity', models.PositiveIntegerField()),
                        ('unit_price', models.DecimalField(decimal_places=2, max_digits=10)),
                        ('kitchen_status', models.CharField(max_length=10)),
                    ],
                    options={
                        'verbose_name': 'Удалённая позиция',
                        'verbose_name_plural': 'Удалённые позиции',
                        'ordering': ['-deleted_at'],
                        'db_table': 'orders_deletedorderitem',
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
