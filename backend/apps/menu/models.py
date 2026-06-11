from django.db import models


STATION_CHOICES = [
    ('bar',     'Бар'),
    ('kitchen', 'Кухня'),
    ('hookah',  'Кальян'),
]


class Menu(models.Model):
    name       = models.CharField(max_length=100, verbose_name='Название')
    is_active  = models.BooleanField(default=False, verbose_name='Активное')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Меню'
        verbose_name_plural = 'Меню'

    def __str__(self):
        return self.name

    def activate(self):
        Menu.objects.exclude(pk=self.pk).update(is_active=False)
        self.is_active = True
        self.save(update_fields=['is_active'])


class MenuSection(models.Model):
    """Верхний уровень: Крепкий алкоголь, Горячее, Кальяны…
    station_type определяет, на какой принтер уходит заказ по умолчанию.
    """
    menu         = models.ForeignKey(Menu, on_delete=models.CASCADE, related_name='sections', verbose_name='Меню')
    name         = models.CharField(max_length=100, verbose_name='Название')
    station_type = models.CharField(max_length=20, choices=STATION_CHOICES, verbose_name='Станция')
    icon         = models.CharField(max_length=10, blank=True, verbose_name='Иконка')
    sort_order   = models.PositiveIntegerField(default=0)
    is_active    = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Раздел меню'
        verbose_name_plural = 'Разделы меню'

    def __str__(self):
        return self.name


class MenuCategory(models.Model):
    """Средний уровень: Водка, Виски, Стейки…
    print_station переопределяет section.station_type для роутинга на принтер.
    """
    section       = models.ForeignKey(MenuSection, on_delete=models.CASCADE, related_name='categories')
    name          = models.CharField(max_length=100, verbose_name='Название')
    print_station = models.CharField(
        max_length=20, choices=STATION_CHOICES, blank=True, default='',
        verbose_name='Принтер (переопределение)',
        help_text='Оставьте пустым — будет использоваться принтер раздела.',
    )
    sort_order = models.PositiveIntegerField(default=0)
    is_active  = models.BooleanField(default=True)

    class Meta:
        db_table = 'orders_menucategory'
        ordering = ['sort_order', 'name']
        verbose_name = 'Категория меню'
        verbose_name_plural = 'Категории меню'

    def __str__(self):
        return f"{self.section.name} / {self.name}"

    @property
    def effective_station(self) -> str:
        return self.print_station or self.section.station_type


class MenuItem(models.Model):
    """Конкретная позиция: Царская 500мл, Рибай 200г…
    print_station переопределяет category.effective_station.
    """
    category        = models.ForeignKey(MenuCategory, on_delete=models.CASCADE, related_name='items')
    name            = models.CharField(max_length=200, verbose_name='Название')
    volume          = models.CharField(max_length=50, blank=True, verbose_name='Объём/вес')
    description     = models.CharField(max_length=300, blank=True, verbose_name='Состав')
    price           = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='Цена')
    cost_price      = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Себестоимость')
    is_active       = models.BooleanField(default=True)
    is_out_of_stock = models.BooleanField(default=False, verbose_name='Закончилось')
    sort_order      = models.PositiveIntegerField(default=0)
    print_station   = models.CharField(
        max_length=20, choices=STATION_CHOICES, blank=True, default='',
        verbose_name='Принтер (переопределение)',
        help_text='Переопределяет категорию. Оставьте пустым — будет использоваться категория.',
    )

    class Meta:
        db_table = 'orders_menuitem'
        ordering = ['sort_order', 'name']
        verbose_name = 'Позиция меню'
        verbose_name_plural = 'Позиции меню'

    def __str__(self):
        return f"{self.name} — {self.price}₽"

    @property
    def effective_station(self) -> str:
        """Итоговая станция для роутинга: позиция → категория → раздел."""
        return self.print_station or self.category.effective_station


class ModifierGroup(models.Model):
    """Группа модификаторов: «Объём льда», «Сироп», «Соус»."""
    name           = models.CharField(max_length=100, verbose_name='Название')
    is_required    = models.BooleanField(default=False, verbose_name='Обязательный')
    max_selections = models.PositiveIntegerField(default=1, verbose_name='Макс. выборов (0=без лимита)')
    sort_order     = models.PositiveIntegerField(default=0)
    is_active      = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Группа модификаторов'
        verbose_name_plural = 'Группы модификаторов'

    def __str__(self):
        return self.name


class Modifier(models.Model):
    """Конкретный модификатор: «Много льда», «Ванильный сироп +50₽»."""
    group       = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name='modifiers')
    name        = models.CharField(max_length=100, verbose_name='Название')
    price_delta = models.DecimalField(max_digits=10, decimal_places=2, default=0,
                                      verbose_name='Доп. цена (₽)')
    sort_order  = models.PositiveIntegerField(default=0)
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ['sort_order', 'name']
        verbose_name = 'Модификатор'
        verbose_name_plural = 'Модификаторы'

    def __str__(self):
        suffix = f' +{self.price_delta}₽' if self.price_delta else ''
        return f'{self.group.name} / {self.name}{suffix}'


class MenuItemModifierGroup(models.Model):
    """M2M: какие группы модификаторов доступны для позиции меню."""
    menu_item      = models.ForeignKey(MenuItem, on_delete=models.CASCADE, related_name='modifier_groups')
    modifier_group = models.ForeignKey(ModifierGroup, on_delete=models.CASCADE, related_name='menu_items')
    sort_order     = models.PositiveIntegerField(default=0)

    class Meta:
        unique_together = [('menu_item', 'modifier_group')]
        ordering = ['sort_order']
        verbose_name = 'Модификатор позиции'
        verbose_name_plural = 'Модификаторы позиций'

    def __str__(self):
        return f'{self.menu_item} ← {self.modifier_group}'