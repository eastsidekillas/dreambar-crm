from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('audit', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='deletedorderitem',
            name='table_number',
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
