from django.db import models
from django.contrib.auth.models import User


class Receipt(models.Model):
    PAYMENT_METHODS = [
        ('cash',     'Наличные'),
        ('card',     'Карта'),
        ('transfer', 'Перевод'),
        ('mixed',    'Смешанная'),
    ]
    DEPOSIT_METHODS = [
        ('cash',     'Наличные'),
        ('transfer', 'Перевод'),
    ]
    order          = models.ForeignKey('orders.Order', on_delete=models.CASCADE, related_name='receipts')
    shift          = models.ForeignKey('shifts.Shift', on_delete=models.CASCADE, related_name='receipts')
    number         = models.PositiveIntegerField(verbose_name='Номер чека в смене')
    table_number   = models.CharField(max_length=50, blank=True, verbose_name='Стол/зона')
    waiter         = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='receipts')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    total          = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    deposit_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Депозит (списано)')
    deposit_method = models.CharField(max_length=20, choices=DEPOSIT_METHODS, blank=True, default='', verbose_name='Способ депозита')
    refund_amount  = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Возврат депозита')
    issued_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'orders_receipt'
        ordering = ['-issued_at']
        unique_together = [('shift', 'number')]
        verbose_name = 'Чек'
        verbose_name_plural = 'Чеки'

    def __str__(self):
        return f"Чек {self.code} — {self.total}₽"

    @property
    def code(self):
        return f"{self.shift_id}-{self.number:03d}"

    @classmethod
    def next_number(cls, shift):
        # Блокируем строку смены чтобы сериализовать параллельные транзакции
        # и не допустить дублирующего номера чека (race condition на MAX+INSERT).
        from apps.shifts.models import Shift as _Shift
        _Shift.objects.select_for_update().filter(pk=shift.pk).get()
        last = cls.objects.filter(shift=shift).aggregate(m=models.Max('number'))['m'] or 0
        return last + 1
