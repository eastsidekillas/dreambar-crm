from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('reservations', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='reservation',
            name='table_number',
            field=models.CharField(blank=True, max_length=50, verbose_name='Стол'),
        ),
    ]
