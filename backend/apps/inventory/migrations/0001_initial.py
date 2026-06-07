from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True
    dependencies = [
        ('menu', '0004_alter_print_station_help_text'),
    ]
    operations = [
        migrations.CreateModel(
            name='Product',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('unit', models.CharField(
                    choices=[('мл','мл'),('л','л'),('г','г'),('кг','кг'),('шт','шт'),('уп','уп')],
                    default='шт', max_length=10)),
                ('pack_size', models.DecimalField(decimal_places=3, default=1, max_digits=10)),
                ('purchase_price', models.DecimalField(decimal_places=2, default=0, max_digits=10)),
                ('is_active', models.BooleanField(default=True)),
            ],
            options={'ordering': ['name']},
        ),
        migrations.CreateModel(
            name='MenuItemComponent',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.DecimalField(decimal_places=3, max_digits=10)),
                ('menu_item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='components', to='menu.menuitem')),
                ('product', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='menu_components', to='inventory.product')),
            ],
            options={'unique_together': {('menu_item', 'product')}},
        ),
    ]