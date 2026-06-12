import secrets

from django.db import models


class Printer(models.Model):
    CONNECTIONS = [
        ('network', 'Ethernet (raw, порт 9100)'),
        ('agent',   'USB через локальный агент'),
    ]
    STATIONS = [
        ('',       'Любые чеки'),
        ('bar',    'Бар'),
        ('waiter', 'Официанты'),
    ]
    name       = models.CharField(max_length=100, verbose_name='Название')
    station    = models.CharField(max_length=20, choices=STATIONS, blank=True, default='',
                                  verbose_name='Назначение',
                                  help_text='Чьи чеки печатает: бара, официантов или любые')
    connection = models.CharField(max_length=20, choices=CONNECTIONS, default='network')
    host       = models.CharField(max_length=100, blank=True, verbose_name='IP/хост (для Ethernet)')
    port       = models.PositiveIntegerField(default=9100)
    agent_key  = models.CharField(max_length=64, blank=True, verbose_name='Ключ агента (для USB)')
    width      = models.PositiveSmallIntegerField(default=48, verbose_name='Ширина, символов')
    is_default = models.BooleanField(default=False, verbose_name='По умолчанию')
    is_active  = models.BooleanField(default=True)

    class Meta:
        db_table = 'orders_printer'
        verbose_name = 'Принтер'
        verbose_name_plural = 'Принтеры'

    def save(self, *args, **kwargs):
        # агентскому принтеру ключ нужен всегда — генерируем, чтобы не вписывать руками
        if self.connection == 'agent' and not self.agent_key:
            self.agent_key = secrets.token_hex(16)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.get_connection_display()})"


class ReceiptSettings(models.Model):
    """Настройки внешнего вида чека (одна запись на заведение)."""
    title             = models.CharField(max_length=50, default='BAR DREAM', verbose_name='Заголовок')
    subtitle          = models.TextField(blank=True, default='vk.com/mydreambar',
                                         verbose_name='Подзаголовок (ООО, ИНН, адрес, соцсети)',
                                         help_text='Можно несколько строк — каждая печатается '
                                                   'на чеке отдельной строкой')
    footer            = models.CharField(max_length=100, blank=True, default='Спасибо за визит!',
                                         verbose_name='Текст внизу чека')
    qr_data           = models.CharField(max_length=200, blank=True, default='',
                                         verbose_name='QR-код (ссылка или текст)',
                                         help_text='Пусто — QR не печатается')
    qr_label          = models.CharField(max_length=100, blank=True, default='',
                                         verbose_name='Подпись под QR-кодом')
    print_second_copy = models.BooleanField(default=True, verbose_name='Печатать копию «для сверки»')

    class Meta:
        verbose_name = 'Настройки чека'
        verbose_name_plural = 'Настройки чека'

    def __str__(self):
        return f'Чек: {self.title}'

    @classmethod
    def get(cls) -> 'ReceiptSettings':
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj


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
    receipt    = models.ForeignKey('receipts.Receipt', on_delete=models.SET_NULL, null=True, blank=True,
                                   related_name='print_jobs')
    payload    = models.BinaryField(verbose_name='ESC/POS-данные')
    status     = models.CharField(max_length=20, choices=STATUSES, default='pending')
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    sent_at    = models.DateTimeField(null=True, blank=True)
    claimed_at = models.DateTimeField(null=True, blank=True, verbose_name='Забрано агентом')

    class Meta:
        db_table = 'orders_printjob'
        ordering = ['created_at']
        verbose_name = 'Задание печати'
        verbose_name_plural = 'Задания печати'

    def __str__(self):
        return f"Печать #{self.pk} → {self.printer} [{self.get_status_display()}]"
