from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('printers', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='printer',
            name='connection',
            field=models.CharField(choices=[('network', 'Ethernet (raw, порт 9100)'), ('agent', 'USB через локальный агент'), ('agent_atol', 'АТОЛ ККТ через локальный агент (ДТО 10)')], default='network', max_length=20),
        ),
    ]