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
                    name='EntryTicket',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('shift', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='entry_tickets', to='shifts.shift')),
                        ('bracelet_number', models.CharField(max_length=30, verbose_name='№ браслета')),
                        ('price', models.DecimalField(decimal_places=2, default=200, max_digits=10)),
                        ('sold_at', models.DateTimeField(auto_now_add=True)),
                        ('created_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
                    ],
                    options={
                        'verbose_name': 'Входной билет',
                        'verbose_name_plural': 'Входные билеты',
                        'ordering': ['bracelet_number'],
                        'db_table': 'orders_entryticket',
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
