from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0005_order_guests_receipt_orderitem_receipt'),
    ]

    operations = [
        migrations.AddField(
            model_name='orderitem',
            name='guest_no',
            field=models.PositiveSmallIntegerField(default=0, verbose_name='Гость'),
        ),
    ]