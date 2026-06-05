from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver


class UserProfile(models.Model):
    ROLES = [
        ('admin',     'Администратор'),
        ('waiter',    'Официант'),
        ('bartender', 'Бармен'),
        ('kitchen',   'Кухня'),
        ('wardrobe',  'Гардероб'),
    ]
    user         = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role         = models.CharField(max_length=20, choices=ROLES, default='waiter')
    display_name = models.CharField(max_length=100, blank=True)

    class Meta:
        verbose_name = 'Профиль сотрудника'
        verbose_name_plural = 'Профили сотрудников'

    def __str__(self):
        return f"{self.get_display()} ({self.get_role_display()})"

    def get_display(self):
        return self.display_name or self.user.get_full_name() or self.user.username


@receiver(post_save, sender=User)
def create_profile(sender, instance, created, **kwargs):
    if created:
        role = 'admin' if instance.is_staff or instance.is_superuser else 'waiter'
        UserProfile.objects.get_or_create(user=instance, defaults={'role': role})


class Shift(models.Model):
    date = models.DateField(default=timezone.localdate)
    opened_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='opened_shifts')
    opened_at = models.DateTimeField(auto_now_add=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    is_open = models.BooleanField(default=True)
    notes = models.TextField(blank=True)

    class Meta:
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


class MenuCategory(models.Model):
    TYPES = [
        ('bar', 'Бар'),
        ('kitchen', 'Кухня'),
        ('hookah', 'Кальян'),
    ]
    name = models.CharField(max_length=100)
    type = models.CharField(max_length=20, choices=TYPES)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Категория меню'
        verbose_name_plural = 'Категории меню'

    def __str__(self):
        return f"{self.get_type_display()} / {self.name}"


class MenuItem(models.Model):
    category = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name='items')
    name = models.CharField(max_length=200)
    volume = models.CharField(max_length=50, blank=True, verbose_name='Объём/вес')
    description = models.CharField(max_length=300, blank=True, verbose_name='Состав')
    price = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Себестоимость')
    is_active = models.BooleanField(default=True)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Позиция меню'
        verbose_name_plural = 'Позиции меню'

    def __str__(self):
        return f"{self.name} — {self.price}₽"


class Order(models.Model):
    """Сессия за столом (посадка одной компании).

    Заказ остаётся открытым, пока гости сидят: официант может донести
    позиции в течение вечера. Когда компания уходит, заказ закрывается и по
    нему формируется один или несколько чеков (раздельный счёт). Поскольку за
    вечер за один стол садятся разные компании, каждая посадка — это отдельный
    заказ с тем же `table_number`, но со своими чеками и временем.
    """
    STATUS_CHOICES = [
        ('open', 'Открыт'),
        ('closed', 'Закрыт'),
        ('cancelled', 'Отменён'),
    ]
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='orders')
    waiter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='orders')
    table_number = models.CharField(max_length=10, blank=True, verbose_name='Стол/зона')
    guests = models.PositiveSmallIntegerField(default=0, verbose_name='Гостей')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='open')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

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
        """Все позиции привязаны к чеку — счёт закрыт полностью."""
        return self.items.exists() and not self.items.filter(receipt__isnull=True).exists()


class OrderItem(models.Model):
    KITCHEN_STATUS = [
        ('new',     'Новый'),
        ('cooking', 'Готовится'),
        ('ready',   'Готов'),
    ]
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    menu_item = models.ForeignKey(MenuItem, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    kitchen_status = models.CharField(max_length=10, choices=KITCHEN_STATUS, default='new')
    # На какой чек попала позиция при закрытии счёта. NULL — ещё не оплачена.
    # Позволяет делить счёт компании на несколько чеков (раздельный счёт).
    receipt = models.ForeignKey(
        'Receipt', on_delete=models.SET_NULL, null=True, blank=True, related_name='items',
    )

    class Meta:
        verbose_name = 'Позиция заказа'
        verbose_name_plural = 'Позиции заказа'

    def __str__(self):
        return f"{self.menu_item.name} x{self.quantity}"

    @property
    def subtotal(self):
        return self.unit_price * self.quantity


class Receipt(models.Model):
    """Чек — итоговый расчётный документ по заказу.

    У одного заказа (посадки) может быть несколько чеков, если компания делит
    счёт. Номер чека сквозной в рамках смены. Сумма и состав фиксируются в
    момент закрытия и не зависят от последующих изменений меню.
    """
    PAYMENT_METHODS = [
        ('cash',     'Наличные'),
        ('card',     'Карта'),
        ('transfer', 'Перевод'),
        ('mixed',    'Смешанная'),
    ]
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='receipts')
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='receipts')
    number = models.PositiveIntegerField(verbose_name='Номер чека в смене')
    table_number = models.CharField(max_length=10, blank=True, verbose_name='Стол/зона')
    waiter = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='receipts')
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHODS, default='cash')
    total = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    issued_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-issued_at']
        unique_together = [('shift', 'number')]
        verbose_name = 'Чек'
        verbose_name_plural = 'Чеки'

    def __str__(self):
        return f"Чек {self.code} — {self.total}₽"

    @property
    def code(self):
        """Человекочитаемый код чека: смена-номер, напр. «7-014»."""
        return f"{self.shift_id}-{self.number:03d}"

    @classmethod
    def next_number(cls, shift):
        last = cls.objects.filter(shift=shift).aggregate(m=models.Max('number'))['m'] or 0
        return last + 1


class EntryTicket(models.Model):
    shift = models.ForeignKey(Shift, on_delete=models.CASCADE, related_name='entry_tickets')
    bracelet_number = models.CharField(max_length=30, verbose_name='№ браслета')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=200)
    sold_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)

    class Meta:
        ordering = ['bracelet_number']
        verbose_name = 'Входной билет'
        verbose_name_plural = 'Входные билеты'

    def __str__(self):
        return f"Браслет {self.bracelet_number} — {self.price}₽"
