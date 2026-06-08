from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Reservation',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100, verbose_name='Имя гостя')),
                ('phone', models.CharField(max_length=20, verbose_name='Телефон')),
                ('date', models.DateField(verbose_name='Дата брони')),
                ('time_start', models.TimeField(verbose_name='Начало')),
                ('time_end', models.TimeField(blank=True, null=True, verbose_name='Конец')),
                ('table_number', models.CharField(blank=True, max_length=10, verbose_name='Стол')),
                ('guests_count', models.PositiveSmallIntegerField(default=1, verbose_name='Кол-во гостей')),
                ('wishes', models.TextField(blank=True, verbose_name='Пожелания')),
                ('deposit_amount', models.DecimalField(decimal_places=2, default=0, max_digits=10, verbose_name='Депозит')),
                ('deposit_method', models.CharField(blank=True, choices=[('cash', 'Наличные'), ('transfer', 'Перевод')], max_length=20, verbose_name='Способ оплаты депозита')),
                ('deposit_paid', models.BooleanField(default=False, verbose_name='Депозит оплачен')),
                ('status', models.CharField(choices=[('pending', 'Ожидает подтверждения'), ('confirmed', 'Подтверждена'), ('arrived', 'Гость пришёл'), ('completed', 'Завершена'), ('cancelled', 'Отменена')], default='pending', max_length=20, verbose_name='Статус')),
                ('notes', models.TextField(blank=True, verbose_name='Внутренние заметки')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('created_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='reservations', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'verbose_name': 'Бронь',
                'verbose_name_plural': 'Брони',
                'ordering': ['date', 'time_start'],
            },
        ),
    ]
