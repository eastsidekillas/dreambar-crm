from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone


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


class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('draft',    'Черновик'),
        ('ordered',  'Заказано'),
        ('received', 'Получено'),
    ]
    status      = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', verbose_name='Статус')
    store       = models.CharField(max_length=120, blank=True, default='', verbose_name='Магазин')
    created_by  = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                    related_name='purchase_orders')
    created_at  = models.DateTimeField(auto_now_add=True)
    received_at = models.DateTimeField(null=True, blank=True)
    notes       = models.TextField(blank=True, verbose_name='Заметки')

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Заказ на закупку'
        verbose_name_plural = 'Заказы на закупку'

    def __str__(self):
        return f"Закупка #{self.pk} ({self.get_status_display()}) {self.created_at:%d.%m.%Y}"

    @property
    def total(self):
        return sum(i.qty_received * i.unit_price for i in self.items.all())


class PurchaseOrderItem(models.Model):
    order        = models.ForeignKey(PurchaseOrder, on_delete=models.CASCADE, related_name='items')
    product      = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='purchase_items')
    qty_ordered  = models.DecimalField(max_digits=10, decimal_places=3, verbose_name='Заказано')
    qty_received = models.DecimalField(max_digits=10, decimal_places=3, default=0, verbose_name='Получено')
    unit_price   = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Цена')

    class Meta:
        unique_together = [('order', 'product')]
        verbose_name = 'Позиция заказа'
        verbose_name_plural = 'Позиции заказа'

    def __str__(self):
        return f"{self.product.name} × {self.qty_ordered}{self.product.unit}"

class ReceiptImport(models.Model):
    """Загруженный кассовый чек из магазина (через сервис code-qr.ru).

    Жизненный цикл: wait/process (сервис проверяет чек у ФНС) → done
    (получен состав) → applied (создана закупка, остатки оприходованы).
    """
    STATUS_CHOICES = [
        ('wait',    'В очереди'),
        ('process', 'Проверяется'),
        ('done',    'Готов к оприходованию'),
        ('error',   'Ошибка'),
        ('applied', 'Оприходован'),
    ]
    qr           = models.TextField(blank=True, verbose_name='Строка QR-кода')
    hash         = models.CharField(max_length=64, blank=True, verbose_name='Hash в сервисе проверки')
    status       = models.CharField(max_length=20, choices=STATUS_CHOICES, default='wait')
    error        = models.TextField(blank=True)
    store        = models.CharField(max_length=200, blank=True, verbose_name='Магазин')
    total        = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    purchased_at = models.CharField(max_length=30, blank=True, verbose_name='Дата чека')
    result       = models.JSONField(null=True, blank=True, verbose_name='Состав чека')
    purchase     = models.ForeignKey(PurchaseOrder, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='receipt_imports')
    created_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Импорт чека'
        verbose_name_plural = 'Импорты чеков'

    def __str__(self):
        return f"Чек {self.store or self.hash[:8]} ({self.get_status_display()})"


class ReceiptItemMapping(models.Model):
    """Самообучаемое сопоставление: название позиции в чеке магазина → товар на складе."""
    receipt_name = models.CharField(max_length=300, unique=True, verbose_name='Название в чеке')
    product      = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='receipt_mappings')
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Сопоставление чека'
        verbose_name_plural = 'Сопоставления чеков'

    def __str__(self):
        return f"{self.receipt_name} → {self.product.name}"
