from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


class Order(models.Model):
    STATUS_CHOICES = [
        ('open',      'Открыт'),
        ('closed',    'Закрыт'),
        ('cancelled', 'Отменён'),
    ]
    shift        = models.ForeignKey('shifts.Shift', on_delete=models.CASCADE, related_name='orders')
    waiter       = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='orders')
    table_number = models.CharField(max_length=10, blank=True, verbose_name='Стол/зона')
    guests       = models.PositiveSmallIntegerField(default=0, verbose_name='Гостей')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    closed_at    = models.DateTimeField(null=True, blank=True)
    notes        = models.TextField(blank=True)
    reservation  = models.ForeignKey(
        'reservations.Reservation', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='orders', verbose_name='Бронь',
    )

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Заказ'
        verbose_name_plural = 'Заказы'

    def __str__(self):
        return f"Заказ #{self.pk} стол {self.table_number or '—'} ({self.get_status_display()})"

    @property
    def total(self):
        return sum(item.subtotal for item in self.items.all())

    @property
    def is_paid(self):
        return self.items.exists() and not self.items.filter(receipt__isnull=True).exists()


class OrderItem(models.Model):
    KITCHEN_STATUS = [
        ('new',     'Новый'),
        ('cooking', 'Готовится'),
        ('ready',   'Готов'),
    ]
    order          = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item      = models.ForeignKey('menu.MenuItem', on_delete=models.PROTECT)
    quantity       = models.PositiveIntegerField(default=1)
    unit_price     = models.DecimalField(max_digits=10, decimal_places=2)
    kitchen_status = models.CharField(max_length=10, choices=KITCHEN_STATUS, default='new')
    guest_no       = models.PositiveSmallIntegerField(default=0, verbose_name='Гость')
    receipt        = models.ForeignKey(
        'receipts.Receipt', on_delete=models.SET_NULL, null=True, blank=True, related_name='items',
    )

    class Meta:
        verbose_name = 'Позиция заказа'
        verbose_name_plural = 'Позиции заказа'

    def __str__(self):
        return f"{self.menu_item.name} x{self.quantity}"

    @property
    def subtotal(self):
        return self.unit_price * self.quantity


class OrderItemModifier(models.Model):
    """Выбранный модификатор к позиции заказа."""
    order_item = models.ForeignKey(OrderItem, on_delete=models.CASCADE, related_name='selected_modifiers')
    modifier   = models.ForeignKey('menu.Modifier', on_delete=models.PROTECT)
    quantity   = models.PositiveIntegerField(default=1)

    class Meta:
        verbose_name = 'Модификатор позиции заказа'
        verbose_name_plural = 'Модификаторы позиций заказа'

    def __str__(self):
        return f"{self.order_item} — {self.modifier.name}"