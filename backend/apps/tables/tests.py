from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from apps.tables.models import Zone, Table


def make_user(username, role):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    p.save()
    return u


class TableAccessTest(APITestCase):
    """Доступ к столам/зонам: чтение — любой залогиненный; правка — TABLE_MANAGE (админ)."""

    def setUp(self):
        self.admin  = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.waiter = make_user('waiter', 'waiter')
        self.zone   = Zone.objects.create(name='Зал', sort=1)
        Table.objects.create(zone=self.zone, number='5', seats=4)

    def test_list_readable_by_waiter(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get('/api/tables/zones/').status_code, 200)
        self.assertEqual(self.client.get('/api/tables/').status_code, 200)

    def test_create_zone_denied_for_waiter(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.post('/api/tables/zones/', {'name': 'VIP', 'sort': 2}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_create_zone_allowed_for_admin(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post('/api/tables/zones/', {'name': 'VIP', 'sort': 2}, format='json')
        self.assertIn(r.status_code, (200, 201))