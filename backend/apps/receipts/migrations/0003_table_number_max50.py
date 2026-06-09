from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('receipts', '0002_receipt_deposit'),
    ]

    operations = [
        migrations.AlterField(
            model_name='receipt',
            name='table_number',
            field=models.CharField(blank=True, max_length=50, verbose_name='Стол/зона'),
        ),
    ]
