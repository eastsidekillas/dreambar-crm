from django.contrib.auth.models import User
from django.test import TestCase
from django.urls import reverse

from .models import SystemState


class SystemStateAdminTest(TestCase):
    """Регрессия: changelist админки SystemState должен рендериться.

    На Python 3.14 + Django < 5.2.8 рендер падал с
    AttributeError: 'super' object has no attribute 'dicts'
    (BaseContext.__copy__). Тест проверяет, что страница отдаёт 200.
    """

    def setUp(self):
        self.admin = User.objects.create_superuser('root', 'root@example.com', 'pass')
        self.client.force_login(self.admin)

    def test_changelist_renders(self):
        SystemState.load()
        url = reverse('admin:system_systemstate_changelist')
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)

    def test_change_form_renders(self):
        obj = SystemState.load()
        url = reverse('admin:system_systemstate_change', args=[obj.pk])
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)