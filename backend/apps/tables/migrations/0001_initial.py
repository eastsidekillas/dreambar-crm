from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Zone',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name',  models.CharField(max_length=50, verbose_name='Название')),
                ('color', models.CharField(default='#6b7280', max_length=7, verbose_name='Цвет (hex)')),
                ('sort',  models.PositiveSmallIntegerField(default=0, verbose_name='Порядок')),
            ],
            options={
                'verbose_name': 'Зона',
                'verbose_name_plural': 'Зоны',
                'db_table': 'tables_zone',
                'ordering': ['sort', 'name'],
            },
        ),
        migrations.CreateModel(
            name='Table',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('number',    models.CharField(max_length=20, unique=True, verbose_name='Номер/название')),
                ('seats',     models.PositiveSmallIntegerField(default=4, verbose_name='Мест')),
                ('is_active', models.BooleanField(default=True, verbose_name='Активен')),
                ('note',      models.CharField(blank=True, max_length=200, verbose_name='Примечание')),
                ('zone', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='tables',
                    to='tables.zone',
                    verbose_name='Зона',
                )),
            ],
            options={
                'verbose_name': 'Стол',
                'verbose_name_plural': 'Столы',
                'db_table': 'tables_table',
                'ordering': ['zone__sort', 'number'],
            },
        ),
    ]
