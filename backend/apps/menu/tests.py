from decimal import Decimal

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from apps.menu.models import Menu, MenuSection, MenuCategory, MenuItem


def make_user(username, role):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    p.save()
    return u


class MenuAccessTest(APITestCase):
    """Доступ к меню: управление — только админ; пометка «стоп» — бармен и админ."""

    def setUp(self):
        self.admin    = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.waiter   = make_user('waiter',  'waiter')
        self.barman   = make_user('barman',  'bartender')
        self.kitchen  = make_user('cook',    'kitchen')
        self.menu     = Menu.objects.create(name='Основное')
        self.section  = MenuSection.objects.create(menu=self.menu, name='Бар', station_type='bar')
        self.category = MenuCategory.objects.create(section=self.section, name='Коктейли')
        self.item     = MenuItem.objects.create(category=self.category, name='Мохито', price=Decimal('450'))

    # ── Управление меню (MENU_MANAGE) — только админ ──────────────────────
    def test_create_section_denied_for_waiter(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.post('/api/menu/sections/',
                             {'menu': self.menu.id, 'name': 'Кухня', 'station_type': 'kitchen'},
                             format='json')
        self.assertEqual(r.status_code, 403)

    def test_create_section_allowed_for_admin(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post('/api/menu/sections/',
                             {'menu': self.menu.id, 'name': 'Кухня', 'station_type': 'kitchen'},
                             format='json')
        self.assertIn(r.status_code, (200, 201))

    def test_item_list_readable_by_waiter(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get('/api/menu/items/').status_code, 200)

    # ── Пометка «стоп» (MENU_TOGGLE_STOCK) — бармен и админ, не официант ──
    def test_toggle_stock_allowed_for_bartender(self):
        self.client.force_authenticate(self.barman)
        r = self.client.post(f'/api/menu/items/{self.item.id}/toggle_stock/')
        self.assertEqual(r.status_code, 200)
        self.item.refresh_from_db()
        self.assertTrue(self.item.is_out_of_stock)

    def test_toggle_stock_allowed_for_admin(self):
        self.client.force_authenticate(self.admin)
        self.assertEqual(
            self.client.post(f'/api/menu/items/{self.item.id}/toggle_stock/').status_code, 200)

    def test_toggle_stock_denied_for_waiter(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.post(f'/api/menu/items/{self.item.id}/toggle_stock/')
        self.assertEqual(r.status_code, 403)
        self.item.refresh_from_db()
        self.assertFalse(self.item.is_out_of_stock)

    def test_toggle_stock_denied_for_kitchen(self):
        self.client.force_authenticate(self.kitchen)
        self.assertEqual(
            self.client.post(f'/api/menu/items/{self.item.id}/toggle_stock/').status_code, 403)