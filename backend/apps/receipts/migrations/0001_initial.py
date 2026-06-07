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
                    name='Receipt',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receipts', to='orders.order')),
                        ('shift', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='receipts', to='shifts.shift')),
                        ('number', models.PositiveIntegerField(verbose_name='Номер чека в смене')),
                        ('table_number', models.CharField(blank=True, max_length=10, verbose_name='Стол/зона')),
                        ('waiter', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='receipts', to=settings.AUTH_USER_MODEL)),
                        ('payment_method', models.CharField(choices=[('cash', 'Наличные'), ('card', 'Карта'), ('transfer', 'Перевод'), ('mixed', 'Смешанная')], default='cash', max_length=20)),
                        ('total', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                        ('issued_at', models.DateTimeField(auto_now_add=True)),
                    ],
                    options={
                        'verbose_name': 'Чек',
                        'verbose_name_plural': 'Чеки',
                        'ordering': ['-issued_at'],
                        'db_table': 'orders_receipt',
                        'unique_together': {('shift', 'number')},
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
