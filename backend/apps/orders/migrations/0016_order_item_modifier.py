from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0015_move_remaining_models'),
        ('menu', '0005_modifiers'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderItemModifier',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('quantity', models.PositiveIntegerField(default=1)),
                ('modifier', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    to='menu.modifier',
                )),
                ('order_item', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='selected_modifiers',
                    to='orders.orderitem',
                )),
            ],
            options={
                'verbose_name': 'Модификатор позиции заказа',
                'verbose_name_plural': 'Модификаторы позиций заказа',
            },
        ),
    ]