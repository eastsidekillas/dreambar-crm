from django.contrib.auth.models import User, AnonymousUser
from django.test import TestCase

from apps.users.permissions_matrix import (
    Perm, WILDCARD, permissions_for_role, permissions_for, has_perm,
)


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
        self.assertIn(Perm.SHIFT_OPEN, permissions_for_role('waiter'))
        self.assertIn(Perm.TICKET_SELL, permissions_for_role('waiter'))
        self.assertIn(Perm.RESERVATION_MANAGE, permissions_for_role('bartender'))
        # Гардероб может открыть смену (есть кнопка в UI), но не управлять меню
        self.assertIn(Perm.SHIFT_OPEN, permissions_for_role('wardrobe'))
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
        self.assertTrue(has_perm(u, Perm.SHIFT_OPEN))
        self.assertTrue(has_perm(u, Perm.ORDER_CREATE))
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