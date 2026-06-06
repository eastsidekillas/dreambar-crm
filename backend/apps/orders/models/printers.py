from django.db import models


class Printer(models.Model):
    CONNECTIONS = [
        ('network', 'Ethernet (raw, порт 9100)'),
        ('agent',   'USB через локальный агент'),
    ]
    name       = models.CharField(max_length=100, verbose_name='Название')
    connection = models.CharField(max_length=20, choices=CONNECTIONS, default='network')
    host       = models.CharField(max_length=100, blank=True, verbose_name='IP/хост (для Ethernet)')
    port       = models.PositiveIntegerField(default=9100)
    agent_key  = models.CharField(max_length=64, blank=True, verbose_name='Ключ агента (для USB)')
    width      = models.PositiveSmallIntegerField(default=48, verbose_name='Ширина, символов')
    is_default = models.BooleanField(default=False, verbose_name='По умолчанию')
    is_active  = models.BooleanField(default=True)

    class Meta:
        verbose_name = 'Принтер'
        verbose_name_plural = 'Принтеры'

    def __str__(self):
        return f"{self.name} ({self.get_connection_display()})"


class PrintJob(models.Model):
    KINDS = [
        ('receipt', 'Чек'),
        ('report',  'Отчёт'),
    ]
    STATUSES = [
        ('pending',  'В очереди'),
        ('printing', 'Печатается'),
        ('done',     'Напечатано'),
        ('error',    'Ошибка'),
    ]
    printer    = models.ForeignKey(Printer, on_delete=models.CASCADE, related_name='jobs')
    kind       = models.CharField(max_length=20, choices=KINDS, default='receipt')
    receipt    = models.ForeignKey('Receipt', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='print_jobs')
    payload    = models.BinaryField(verbose_name='ESC/POS-данные')
    status     = models.CharField(max_length=20, choices=STATUSES, default='pending')
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at    = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['created_at']
        verbose_name = 'Задание печати'
        verbose_name_plural = 'Задания печати'

    def __str__(self):
        return f"Печать #{self.pk} → {self.printer} [{self.get_status_display()}]"