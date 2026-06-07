from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('orders', '0014_move_menu_to_menu_app'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='Shift',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('date', models.DateField(default=django.utils.timezone.localdate)),
                        ('opened_by', models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='opened_shifts', to=settings.AUTH_USER_MODEL)),
                        ('opened_at', models.DateTimeField(auto_now_add=True)),
                        ('closed_at', models.DateTimeField(blank=True, null=True)),
                        ('is_open', models.BooleanField(default=True)),
                        ('notes', models.TextField(blank=True)),
                    ],
                    options={
                        'verbose_name': 'Смена',
                        'verbose_name_plural': 'Смены',
                        'ordering': ['-date'],
                        'db_table': 'orders_shift',
                    },
                ),
            ],
            database_operations=[],
        ),
    ]
