from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0017_order_reservation'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='table_number',
            field=models.CharField(blank=True, max_length=50, verbose_name='Стол/зона'),
        ),
    ]
