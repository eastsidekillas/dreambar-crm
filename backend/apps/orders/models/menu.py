from django.db import models


class MenuCategory(models.Model):
    TYPES = [
        ('bar',     'Бар'),
        ('kitchen', 'Кухня'),
        ('hookah',  'Кальян'),
    ]
    name       = models.CharField(max_length=100)
    type       = models.CharField(max_length=20, choices=TYPES)
    sort_order = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Категория меню'
        verbose_name_plural = 'Категории меню'

    def __str__(self):
        return f"{self.get_type_display()} / {self.name}"


class MenuItem(models.Model):
    category    = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name='items')
    name        = models.CharField(max_length=200)
    volume      = models.CharField(max_length=50, blank=True, verbose_name='Объём/вес')
    description = models.CharField(max_length=300, blank=True, verbose_name='Состав')
    price       = models.DecimalField(max_digits=10, decimal_places=2)
    cost_price  = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Себестоимость')
    is_active   = models.BooleanField(default=True)
    sort_order  = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Позиция меню'
        verbose_name_plural = 'Позиции меню'

    def __str__(self):
        return f"{self.name} — {self.price}₽"