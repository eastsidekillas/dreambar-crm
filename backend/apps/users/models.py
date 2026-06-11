from django.db import models
from django.contrib.auth.models import User
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
    user          = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role          = models.CharField(max_length=20, choices=ROLES, default='waiter')
    display_name  = models.CharField(max_length=100, blank=True)
    allowed_roles = models.JSONField(default=list, blank=True, verbose_name='Доступные роли')
    pin_hash      = models.CharField(max_length=128, blank=True, default='', verbose_name='PIN (хэш)')
    # True = пароль временный (выдан админом) — при входе требуем сменить
    must_change_password = models.BooleanField(default=False, verbose_name='Сменить пароль при входе')

    class Meta:
        db_table = 'orders_userprofile'  # сохраняем имя таблицы — данные не трогаем
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