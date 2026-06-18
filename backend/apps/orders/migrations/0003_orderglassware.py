import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('orders', '0002_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='OrderGlassware',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kind', models.CharField(choices=[('glass', 'Стакан'), ('shot', 'Рюмка'), ('wine', 'Бокал')], max_length=10, verbose_name='Тип посуды')),
                ('count', models.PositiveSmallIntegerField(default=0, verbose_name='Количество')),
                ('order', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='glassware', to='orders.order')),
            ],
            options={
                'verbose_name': 'Посуда к заказу',
                'verbose_name_plural': 'Посуда к заказам',
            },
        ),
        migrations.AddConstraint(
            model_name='orderglassware',
            constraint=models.UniqueConstraint(fields=('order', 'kind'), name='uniq_order_glassware_kind'),
        ),
    ]