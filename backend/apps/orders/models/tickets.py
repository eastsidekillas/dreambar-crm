from django.db import models
from django.contrib.auth.models import User


class EntryTicket(models.Model):
    shift           = models.ForeignKey('Shift', on_delete=models.CASCADE, related_name='entry_tickets')
    bracelet_number = models.CharField(max_length=30, verbose_name='№ браслета')
    price           = models.DecimalField(max_digits=10, decimal_places=2, default=200)
    sold_at         = models.DateTimeField(auto_now_add=True)
    created_by      = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['bracelet_number']
        verbose_name = 'Входной билет'
        verbose_name_plural = 'Входные билеты'

    def __str__(self):
        return f"Браслет {self.bracelet_number} — {self.price}₽"