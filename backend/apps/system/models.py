from django.db import models
from django.contrib.auth.models import User


DEFAULT_STOP_MESSAGE = 'Программа временно остановлена. Обратитесь к администратору.'


class SystemState(models.Model):
    """Глобальное состояние системы (синглтон, pk=1).

    «Рубильник»: админ удалённо включает остановку, и все экраны (официант,
    кухня, бар, гардероб) показывают полноэкранную заглушку. Состояние читается
    публичным эндпоинтом, поэтому заглушка работает и до входа в систему.
    """
    is_stopped   = models.BooleanField('Остановлена', default=False)
    message      = models.TextField('Текст заглушки', blank=True, default=DEFAULT_STOP_MESSAGE)
    updated_at   = models.DateTimeField('Обновлено', auto_now=True)
    updated_by   = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
                                     related_name='+', verbose_name='Кем изменено')

    class Meta:
        verbose_name = 'Состояние системы'
        verbose_name_plural = 'Состояние системы'

    def __str__(self):
        return 'остановлена' if self.is_stopped else 'работает'

    @classmethod
    def load(cls) -> 'SystemState':
        """Единственная запись состояния — создаётся при первом обращении."""
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def save(self, *args, **kwargs):
        # Защита от случайного появления второй записи: всегда pk=1.
        self.pk = 1
        super().save(*args, **kwargs)