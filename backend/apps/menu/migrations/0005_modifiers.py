from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('menu', '0004_alter_print_station_help_text'),
    ]

    operations = [
        migrations.CreateModel(
            name='ModifierGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Название')),
                ('is_required', models.BooleanField(default=False, verbose_name='Обязательный')),
                ('max_selections', models.PositiveIntegerField(default=1, verbose_name='Макс. выборов (0=без лимита)')),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={
                'verbose_name': 'Группа модификаторов',
                'verbose_name_plural': 'Группы модификаторов',
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='Modifier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Название')),
                ('price_delta', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Доп. цена (₽)')),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('is_active', models.BooleanField(default=True)),
                ('group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='modifiers',
                    to='menu.modifiergroup',
                )),
            ],
            options={
                'verbose_name': 'Модификатор',
                'verbose_name_plural': 'Модификаторы',
                'ordering': ['sort_order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='MenuItemModifierGroup',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('sort_order', models.PositiveIntegerField(default=0)),
                ('menu_item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='modifier_groups',
                    to='menu.menuitem',
                )),
                ('modifier_group', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='menu_items',
                    to='menu.modifiergroup',
                )),
            ],
            options={
                'verbose_name': 'Модификатор позиции',
                'verbose_name_plural': 'Модификаторы позиций',
                'ordering': ['sort_order'],
                'unique_together': {('menu_item', 'modifier_group')},
            },
        ),
    ]