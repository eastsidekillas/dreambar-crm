from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """
    Переносит UserProfile из apps.orders в apps.users.
    database_operations=[] — БД не изменяется, только состояние Django.
    Таблица orders_userprofile остаётся как есть (db_table в модели).
    """
    initial = True
    dependencies = [
        ('auth', '0012_alter_user_first_name_max_length'),
        ('orders', '0011_add_deleted_order_item_log'),
    ]
    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='UserProfile',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('role', models.CharField(
                            choices=[
                                ('admin',     'Администратор'),
                                ('waiter',    'Официант'),
                                ('bartender', 'Бармен'),
                                ('kitchen',   'Кухня'),
                                ('wardrobe',  'Гардероб'),
                            ],
                            default='waiter', max_length=20,
                        )),
                        ('display_name', models.CharField(blank=True, max_length=100)),
                        ('allowed_roles', models.JSONField(blank=True, default=list, verbose_name='Доступные роли')),
                        ('user', models.OneToOneField(
                            on_delete=django.db.models.deletion.CASCADE,
                            related_name='profile',
                            to='auth.user',
                        )),
                    ],
                    options={
                        'verbose_name': 'Профиль сотрудника',
                        'verbose_name_plural': 'Профили сотрудников',
                        'db_table': 'orders_userprofile',
                    },
                ),
            ],
            database_operations=[],
        ),
    ]