from django.contrib.auth.models import User, AnonymousUser
from django.contrib.auth.hashers import make_password, check_password
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APITestCase

from apps.users.permissions_matrix import (
    Perm, WILDCARD, permissions_for_role, permissions_for, has_perm,
)


def set_pin(user, pin):
    p = user.profile
    p.pin_hash = make_password(pin)
    p.save(update_fields=['pin_hash'])


def check_pin(user, pin):
    user.profile.refresh_from_db()
    return check_password(pin, user.profile.pin_hash)


def make_user(username, role, allowed=None):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    if allowed is not None:
        p.allowed_roles = allowed
    p.save()
    return u


class PermissionsMatrixTest(TestCase):
    """Фиксирует матрицу ролей — страховка от регрессий при enforcement и переходе A→B."""

    def test_role_permission_sets(self):
        self.assertEqual(permissions_for_role('kitchen'),
                         {Perm.KITCHEN_VIEW, Perm.KITCHEN_UPDATE})
        self.assertNotIn(Perm.SHIFT_OPEN, permissions_for_role('waiter'))   # официант не открывает смену
        self.assertIn(Perm.TICKET_SELL, permissions_for_role('waiter'))
        self.assertIn(Perm.RESERVATION_MANAGE, permissions_for_role('bartender'))
        self.assertIn(Perm.SHIFT_OPEN, permissions_for_role('bartender'))
        # Смену открывают только бармен/админ — гардероб продаёт билеты, но смену не открывает
        self.assertNotIn(Perm.SHIFT_OPEN, permissions_for_role('wardrobe'))
        self.assertIn(Perm.TICKET_SELL, permissions_for_role('wardrobe'))
        self.assertNotIn(Perm.MENU_MANAGE, permissions_for_role('wardrobe'))
        # Неизвестная роль — пустой набор, не падаем
        self.assertEqual(permissions_for_role('does_not_exist'), set())

    def test_admin_has_wildcard(self):
        admin = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.assertEqual(permissions_for(admin), {WILDCARD})
        self.assertTrue(has_perm(admin, Perm.PRINTER_MANAGE))
        self.assertTrue(has_perm(admin, Perm.SHIFT_REOPEN))

    def test_waiter_is_scoped(self):
        u = make_user('w', 'waiter')
        self.assertTrue(has_perm(u, Perm.ORDER_CREATE))
        self.assertTrue(has_perm(u, Perm.TICKET_SELL))
        self.assertFalse(has_perm(u, Perm.SHIFT_OPEN))     # смену официант не открывает
        self.assertFalse(has_perm(u, Perm.SHIFT_CLOSE))    # и не закрывает
        self.assertFalse(has_perm(u, Perm.MENU_MANAGE))
        self.assertFalse(has_perm(u, Perm.SHIFT_REOPEN))   # переоткрытие — только админ
        self.assertFalse(has_perm(u, Perm.ORDER_EDIT_ANY)) # чужие заказы — только админ

    def test_kitchen_cannot_open_shift(self):
        u = make_user('k', 'kitchen')
        self.assertTrue(has_perm(u, Perm.KITCHEN_VIEW))
        self.assertFalse(has_perm(u, Perm.SHIFT_OPEN))

    def test_allowed_roles_union(self):
        # Мультироль: эффективные права = объединение всех ролей
        u = make_user('m', 'wardrobe', allowed=['wardrobe', 'kitchen'])
        self.assertTrue(has_perm(u, Perm.TICKET_SELL))   # от wardrobe
        self.assertTrue(has_perm(u, Perm.KITCHEN_VIEW))  # от kitchen
        self.assertFalse(has_perm(u, Perm.MENU_MANAGE))

    def test_unauthenticated_has_nothing(self):
        self.assertEqual(permissions_for(AnonymousUser()), set())
        self.assertFalse(has_perm(AnonymousUser(), Perm.ORDER_CREATE))


class PinAuthTest(APITestCase):
    """Вход по чистому PIN (без user_id) и уникальность PIN."""

    def setUp(self):
        cache.clear()   # сбрасываем историю троттлинга между тестами
        self.alice = make_user('alice', 'waiter');    set_pin(self.alice, '1111')
        self.bob   = make_user('bob',   'bartender'); set_pin(self.bob,   '2222')

    def test_pure_pin_login_identifies_user(self):
        r = self.client.post('/api/auth/pin/', {'pin': '2222'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.assertIn('access', r.data)
        # Токен принадлежит именно Бобу
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + r.data['access'])
        me = self.client.get('/api/auth/me/')
        self.assertEqual(me.data['username'], 'bob')

    def test_pure_pin_login_wrong_pin(self):
        r = self.client.post('/api/auth/pin/', {'pin': '9999'}, format='json')
        self.assertEqual(r.status_code, 401)

    def test_duplicate_pin_login_rejected(self):
        # Легаси-дубль (uniqueness не enforced задним числом) — вход неоднозначен → 401
        carol = make_user('carol', 'waiter'); set_pin(carol, '2222')
        r = self.client.post('/api/auth/pin/', {'pin': '2222'}, format='json')
        self.assertEqual(r.status_code, 401)

    def test_pin_must_be_unique(self):
        # Боб пытается занять PIN Алисы
        self.client.force_authenticate(self.bob)
        r = self.client.post('/api/auth/me/pin/',
                             {'pin': '1111', 'current_pin': '2222'}, format='json')
        self.assertEqual(r.status_code, 400)
        self.bob.profile.refresh_from_db()
        self.assertTrue(check_pin(self.bob, '2222'))   # PIN не изменился

    def test_pin_change_to_free_value_then_login(self):
        self.client.force_authenticate(self.bob)
        r = self.client.post('/api/auth/me/pin/',
                             {'pin': '3333', 'current_pin': '2222'}, format='json')
        self.assertEqual(r.status_code, 200)
        # Вход по новому PIN опознаёт Боба
        self.client.force_authenticate(user=None)
        login = self.client.post('/api/auth/pin/', {'pin': '3333'}, format='json')
        self.assertEqual(login.status_code, 200)