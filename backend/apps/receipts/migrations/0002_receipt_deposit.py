from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('receipts', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='receipt',
            name='deposit_amount',
            field=models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Депозит'),
        ),
        migrations.AddField(
            model_name='receipt',
            name='deposit_method',
            field=models.CharField(blank=True, default='', max_length=20, verbose_name='Способ депозита'),
        ),
    ]
