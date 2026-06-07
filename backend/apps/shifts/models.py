from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Shift(models.Model):
    date      = models.DateField(default=timezone.localdate)
    opened_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='opened_shifts')
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_open   = models.BooleanField(default=True)
    notes     = models.TextField(blank=True)

    class Meta:
        db_table = 'orders_shift'
        ordering = ['-date']
        verbose_name = 'Смена'
        verbose_name_plural = 'Смены'

    def __str__(self):
        return f"Смена {self.date} ({'открыта' if self.is_open else 'закрыта'})"

    @property
    def total_revenue(self):
        order_total = sum(o.total for o in self.orders.filter(status='closed'))
        ticket_total = self.entry_tickets.aggregate(
            total=models.Sum('price')
        )['total'] or 0
        return order_total + ticket_total

    @property
    def orders_count(self):
        return self.orders.filter(status='closed').count()

    @property
    def tickets_count(self):
        return self.entry_tickets.count()
