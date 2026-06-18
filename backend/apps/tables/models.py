from django.db import models


class Zone(models.Model):
    name  = models.CharField(max_length=50, verbose_name='Название')
    color = models.CharField(max_length=7, default='#6b7280', verbose_name='Цвет (hex)')
    sort  = models.PositiveSmallIntegerField(default=0, verbose_name='Порядок')
    # VIP-зона: в ней брони берут депозит. min_deposit=0 — депозит опционален, >0 — минимум обязателен.
    requires_deposit = models.BooleanField(default=False, verbose_name='VIP-зона (берётся депозит)')
    min_deposit      = models.DecimalField(max_digits=10, decimal_places=2, default=0, verbose_name='Мин. депозит, ₽')

    class Meta:
        db_table = 'tables_zone'
        ordering = ['sort', 'name']
        verbose_name = 'Зона'
        verbose_name_plural = 'Зоны'

    def __str__(self):
        return self.name


class Table(models.Model):
    zone      = models.ForeignKey(Zone, on_delete=models.CASCADE, related_name='tables', verbose_name='Зона')
    number    = models.CharField(max_length=20, unique=True, verbose_name='Номер/название')
    seats     = models.PositiveSmallIntegerField(default=4, verbose_name='Мест')
    is_active = models.BooleanField(default=True, verbose_name='Активен')
    note      = models.CharField(max_length=200, blank=True, verbose_name='Примечание')

    class Meta:
        db_table = 'tables_table'
        ordering = ['zone__sort', 'number']
        verbose_name = 'Стол'
        verbose_name_plural = 'Столы'

    def __str__(self):
        return f"{self.zone.name} / {self.number}"
