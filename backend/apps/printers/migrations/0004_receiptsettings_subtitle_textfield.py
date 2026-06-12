from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('printers', '0003_remove_atol_connection'),
    ]

    operations = [
        migrations.AlterField(
            model_name='receiptsettings',
            name='subtitle',
            field=models.TextField(blank=True, default='vk.com/mydreambar', help_text='Можно несколько строк — каждая печатается на чеке отдельной строкой', verbose_name='Подзаголовок (ООО, ИНН, адрес, соцсети)'),
        ),
    ]
