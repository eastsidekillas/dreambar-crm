"""
Шаг 1/3 переноса меню из apps.orders в apps.menu.

- Создаёт новую таблицу menu_menusection (MenuSection).
- Добавляет колонки section_id, print_station, is_active в orders_menucategory.
- Регистрирует MenuCategory и MenuItem в состоянии Django без DB-изменений
  (таблицы orders_menucategory и orders_menuitem уже существуют).
"""
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('orders', '0013_alter_printjob_kind'),
    ]

    operations = [

        # ── 1. Новая таблица MenuSection ─────────────────────────────────────
        migrations.CreateModel(
            name='MenuSection',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Название')),
                ('station_type', models.CharField(
                    choices=[('bar', 'Бар'), ('kitchen', 'Кухня'), ('hookah', 'Кальян')],
                    max_length=20, verbose_name='Станция',
                )),
                ('icon',       models.CharField(blank=True, max_length=10, verbose_name='Иконка')),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('is_active',  models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Раздел меню',
                'verbose_name_plural': 'Разделы меню',
                'ordering': ['sort_order', 'name'],
            },
        ),

        # ── 2. MenuCategory: добавляем колонки, регистрируем новую модель ───
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='MenuCategory',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name',          models.CharField(max_length=100, verbose_name='Название')),
                        ('sort_order',    models.PositiveIntegerField(default=0)),
                        ('is_active',     models.BooleanField(default=True)),
                        ('print_station', models.CharField(
                            blank=True, default='', max_length=20,
                            choices=[('bar', 'Бар'), ('kitchen', 'Кухня'), ('hookah', 'Кальян')],
                            verbose_name='Принтер (переопределение)',
                        )),
                        ('section', models.ForeignKey(
                            'menu.MenuSection', on_delete=django.db.models.deletion.CASCADE,
                            related_name='categories', null=True,
                        )),
                    ],
                    options={
                        'verbose_name': 'Категория меню',
                        'verbose_name_plural': 'Категории меню',
                        'ordering': ['sort_order', 'name'],
                        'db_table': 'orders_menucategory',
                    },
                ),
            ],
            database_operations=[
                # Добавляем section_id (nullable до data-миграции)
                migrations.RunSQL(
                    sql="ALTER TABLE orders_menucategory ADD COLUMN section_id BIGINT",
                    reverse_sql="SELECT 1",  # SQLite не поддерживает DROP COLUMN в старых версиях
                ),
                # Добавляем print_station
                migrations.RunSQL(
                    sql="ALTER TABLE orders_menucategory ADD COLUMN print_station VARCHAR(20) NOT NULL DEFAULT ''",
                    reverse_sql="SELECT 1",
                ),
                # Добавляем is_active
                migrations.RunSQL(
                    sql="ALTER TABLE orders_menucategory ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1",
                    reverse_sql="SELECT 1",
                ),
            ],
        ),

        # ── 3. MenuItem: только регистрируем в новом app, таблица не меняется
        migrations.SeparateDatabaseAndState(
            state_operations=[
                migrations.CreateModel(
                    name='MenuItem',
                    fields=[
                        ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                        ('name',            models.CharField(max_length=200, verbose_name='Название')),
                        ('volume',          models.CharField(blank=True, max_length=50, verbose_name='Объём/вес')),
                        ('description',     models.CharField(blank=True, max_length=300, verbose_name='Состав')),
                        ('price',           models.DecimalField(decimal_places=2, max_digits=10, verbose_name='Цена')),
                        ('cost_price',      models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Себестоимость')),
                        ('is_active',       models.BooleanField(default=True)),
                        ('is_out_of_stock', models.BooleanField(default=False, verbose_name='Закончилось')),
                        ('sort_order',      models.PositiveIntegerField(default=0)),
                        ('print_station',   models.CharField(
                            blank=True, default='', max_length=20,
                            choices=[('bar', 'Бар'), ('kitchen', 'Кухня'), ('hookah', 'Кальян')],
                            verbose_name='Принтер (переопределение)',
                        )),
                        ('category', models.ForeignKey(
                            'menu.MenuCategory', on_delete=django.db.models.deletion.CASCADE,
                            related_name='items',
                        )),
                    ],
                    options={
                        'verbose_name': 'Позиция меню',
                        'verbose_name_plural': 'Позиции меню',
                        'ordering': ['sort_order', 'name'],
                        'db_table': 'orders_menuitem',
                    },
                ),
            ],
            database_operations=[],
        ),
    ]