from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('orders', '0014_move_menu_to_menu_app'),
        ('receipts', '0001_initial'),
    ]
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Printer',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name', models.CharField(max_length=100, verbose_name='Название')),
                        ('connection', models.CharField(choices=[('network', 'Ethernet (raw, порт 9100)'), ('agent', 'USB через локальный агент')], default='network', max_length=20)),
                        ('host', models.CharField(blank=True, max_length=100, verbose_name='IP/хост (для Ethernet)')),
                        ('port', models.PositiveIntegerField(default=9100)),
                        ('agent_key', models.CharField(blank=True, max_length=64, verbose_name='Ключ агента (для USB)')),
                        ('width', models.PositiveSmallIntegerField(default=48, verbose_name='Ширина, символов')),
                        ('is_default', models.BooleanField(default=False, verbose_name='По умолчанию')),
                        ('is_active', models.BooleanField(default=True)),
                    ],
                    options={
                        'verbose_name': 'Принтер',
                        'verbose_name_plural': 'Принтеры',
                        'db_table': 'orders_printer',
                    },
                ),
                migrations.CreateModel(
                    name='PrintJob',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('printer', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='jobs', to='printers.printer')),
                        ('kind', models.CharField(choices=[('receipt', 'Чек'), ('report', 'Отчёт')], default='receipt', max_length=20)),
                        ('receipt', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='print_jobs', to='receipts.receipt')),
                        ('payload', models.BinaryField(verbose_name='ESC/POS-данные')),
                        ('status', models.CharField(choices=[('pending', 'В очереди'), ('printing', 'Печатается'), ('done', 'Напечатано'), ('error', 'Ошибка')], default='pending', max_length=20)),
                        ('error', models.TextField(blank=True)),
                        ('created_at', models.DateTimeField(auto_now_add=True)),
                        ('sent_at', models.DateTimeField(blank=True, null=True)),
                    ],
                    options={
                        'verbose_name': 'Задание печати',
                        'verbose_name_plural': 'Задания печати',
                        'ordering': ['created_at'],
                        'db_table': 'orders_printjob',
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
