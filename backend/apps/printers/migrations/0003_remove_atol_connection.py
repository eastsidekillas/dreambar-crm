from django.db import migrations, models


def atol_to_agent(apps, schema_editor):
    Printer = apps.get_model('printers', 'Printer')
    Printer.objects.filter(connection='agent_atol').update(connection='agent')


class Migration(migrations.Migration):

    dependencies = [
        ('printers', '0002_alter_printer_connection'),
    ]

    operations = [
        migrations.RunPython(atol_to_agent, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='printer',
            name='connection',
            field=models.CharField(choices=[('network', 'Ethernet (raw, порт 9100)'), ('agent', 'USB через локальный агент')], default='network', max_length=20),
        ),
    ]
