from django.db import models
from django.contrib.auth.models import User


UNITS = [('мл', 'мл'), ('л', 'л'), ('г', 'г'), ('кг', 'кг'), ('шт', 'шт'), ('уп', 'уп')]


class Product(models.Model):
    name           = models.CharField(max_length=200)
    unit           = models.CharField(max_length=10, choices=UNITS, default='шт')
    pack_size      = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    purchase_price = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    stock_quantity = models.DecimalField(max_digits=10, decimal_places=3, default=0,
                                         verbose_name='Остаток')
    min_stock      = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True,
                                         verbose_name='Минимальный остаток',
                                         help_text='Порог предупреждения о нехватке')
    is_active      = models.BooleanField(default=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Продукт'
        verbose_name_plural = 'Продукты'

    def __str__(self):
        return f'{self.name} ({self.unit})'

    @property
    def is_low(self):
        return self.min_stock is not None and self.stock_quantity < self.min_stock


class MenuItemComponent(models.Model):
    menu_item = models.ForeignKey('menu.MenuItem', on_delete=models.CASCADE, related_name='components')
    product   = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='menu_components')
    quantity  = models.DecimalField(max_digits=10, decimal_places=3)

    class Meta:
        unique_together = [('menu_item', 'product')]
        verbose_name = 'Компонент позиции'
        verbose_name_plural = 'Компоненты позиций'

    def __str__(self):
        return f'{self.menu_item.name} → {self.quantity}{self.product.unit} {self.product.name}'


class InventoryMovement(models.Model):
    REASON_CHOICES = [
        ('sale',       'Продажа'),
        ('manual_in',  'Приход'),
        ('manual_out', 'Списание'),
        ('adjustment', 'Инвентаризация'),
    ]
    product    = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='movements')
    # positive = приход, negative = расход
    quantity   = models.DecimalField(max_digits=10, decimal_places=3)
    reason     = models.CharField(max_length=20, choices=REASON_CHOICES)
    order_item = models.ForeignKey(
        'orders.OrderItem', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inventory_movements',
    )
    shift      = models.ForeignKey(
        'shifts.Shift', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='inventory_movements',
    )
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    note       = models.TextField(blank=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Движение склада'
        verbose_name_plural = 'Движения склада'

    def __str__(self):
        sign = '+' if self.quantity >= 0 else ''
        return f"{self.created_at:%d.%m %H:%M} | {self.product.name} {sign}{self.quantity}"