from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0016_order_item_modifier'),
        ('reservations', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='order',
            name='reservation',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='orders',
                to='reservations.reservation',
                verbose_name='Бронь',
            ),
        ),
    ]
