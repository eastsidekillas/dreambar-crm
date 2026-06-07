from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('orders', '0012_move_userprofile_to_users'),
    ]
    operations = [
        migrations.AlterField(
            model_name='printjob',
            name='kind',
            field=models.CharField(
                choices=[('receipt', 'Чек'), ('report', 'Отчёт')],
                default='receipt',
                max_length=20,
            ),
        ),
    ]