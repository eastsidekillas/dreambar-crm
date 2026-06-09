from django.db import models
from django.contrib.auth.models import User


class Reservation(models.Model):
    STATUS_CHOICES = [
        ('pending',   'Ожидает подтверждения'),
        ('confirmed', 'Подтверждена'),
        ('arrived',   'Гость пришёл'),
        ('completed', 'Завершена'),
        ('cancelled', 'Отменена'),
    ]
    DEPOSIT_METHOD_CHOICES = [
        ('cash',     'Наличные'),
        ('transfer', 'Перевод'),
    ]

    name           = models.CharField(max_length=100, verbose_name='Имя гостя')
    phone          = models.CharField(max_length=20, verbose_name='Телефон')
    date           = models.DateField(verbose_name='Дата брони')
    time_start     = models.TimeField(verbose_name='Начало')
    time_end       = models.TimeField(null=True, blank=True, verbose_name='Конец')
    table          = models.ForeignKey(
        'tables.Table',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='reservations',
        verbose_name='Стол',
    )
    guests_count   = models.PositiveSmallIntegerField(default=1, verbose_name='Кол-во гостей')
    wishes         = models.TextField(blank=True, verbose_name='Пожелания')
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Депозит')
    deposit_method = models.CharField(max_length=20, choices=DEPOSIT_METHOD_CHOICES, blank=True, verbose_name='Способ оплаты депозита')
    deposit_paid   = models.BooleanField(default=False, verbose_name='Депозит оплачен')
    status         = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='Статус')
    notes          = models.TextField(blank=True, verbose_name='Внутренние заметки')
    created_at     = models.DateTimeField(auto_now_add=True)
    created_by     = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='reservations')

    class Meta:
        ordering = ['date', 'time_start']
        verbose_name = 'Бронь'
        verbose_name_plural = 'Брони'

    def __str__(self):
        table_str = f' / {self.table.number}' if self.table_id else ''
        return f"{self.name} — {self.date} {self.time_start}{table_str}"

    @property
    def table_number(self):
        return self.table.number if self.table_id else ''
