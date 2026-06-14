from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from apps.shifts.models import Shift
from apps.orders.models import Order


def make_user(username, role):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    p.save()
    return u


class OrderAccessTest(APITestCase):
    """Доступ к OrderViewSet: матрица (кто вообще ведёт заказы) + object-level (свой/чужой)."""

    def setUp(self):
        self.admin   = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.alice   = make_user('alice',  'waiter')      # владелец заказа
        self.bob     = make_user('bob',    'waiter')      # другой официант
        self.barman  = make_user('barman', 'bartender')
        self.kitchen = make_user('cook',   'kitchen')
        self.shift   = Shift.objects.create()
        self.order   = Order.objects.create(shift=self.shift, waiter=self.alice, table_number='5')

    # ── Матрица: кто вообще допущен к заказам ──────────────────────────────
    def test_kitchen_cannot_list_orders(self):
        self.client.force_authenticate(self.kitchen)
        self.assertEqual(self.client.get('/api/orders/').status_code, 403)

    def test_kitchen_cannot_create_order(self):
        self.client.force_authenticate(self.kitchen)
        r = self.client.post('/api/orders/', {'shift': self.shift.id, 'guests': 2}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_waiter_can_create_order(self):
        self.client.force_authenticate(self.bob)
        r = self.client.post('/api/orders/', {'shift': self.shift.id, 'table_number': '1', 'guests': 2},
                             format='json')
        self.assertIn(r.status_code, (200, 201))
        # Создатель проставляется сервером
        self.assertEqual(Order.objects.latest('id').waiter_id, self.bob.id)

    # ── Object-level: cancel (самое чистое действие, без позиций) ──────────
    def test_cancel_own_order(self):
        self.client.force_authenticate(self.alice)
        r = self.client.post(f'/api/orders/{self.order.id}/cancel/')
        self.assertEqual(r.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'cancelled')

    def test_cancel_other_order_denied_for_waiter(self):
        self.client.force_authenticate(self.bob)
        r = self.client.post(f'/api/orders/{self.order.id}/cancel/')
        self.assertEqual(r.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.status, 'open')   # не тронут

    def test_cancel_other_order_denied_for_bartender(self):
        self.client.force_authenticate(self.barman)
        self.assertEqual(self.client.post(f'/api/orders/{self.order.id}/cancel/').status_code, 403)

    def test_cancel_other_order_allowed_for_admin(self):
        self.client.force_authenticate(self.admin)
        r = self.client.post(f'/api/orders/{self.order.id}/cancel/')
        self.assertEqual(r.status_code, 200)

    # ── Object-level проверяется ДО тела действия (403, а не 400/404) ──────
    def test_checkout_other_order_denied(self):
        self.client.force_authenticate(self.bob)
        r = self.client.post(f'/api/orders/{self.order.id}/checkout/', {}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_move_table_other_order_denied(self):
        self.client.force_authenticate(self.bob)
        r = self.client.post(f'/api/orders/{self.order.id}/move_table/', {'table_number': '9'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.order.refresh_from_db()
        self.assertEqual(self.order.table_number, '5')

    def test_remove_item_other_order_denied(self):
        self.client.force_authenticate(self.bob)
        r = self.client.delete(f'/api/orders/{self.order.id}/remove_item/999/')
        self.assertEqual(r.status_code, 403)

    # ── ДЫРА: стандартные retrieve/destroy чужого заказа — через queryset 404
    def test_retrieve_other_order_404(self):
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.get(f'/api/orders/{self.order.id}/').status_code, 404)

    def test_retrieve_own_order_ok(self):
        self.client.force_authenticate(self.alice)
        self.assertEqual(self.client.get(f'/api/orders/{self.order.id}/').status_code, 200)

    def test_destroy_other_order_denied(self):
        self.client.force_authenticate(self.bob)
        self.assertEqual(self.client.delete(f'/api/orders/{self.order.id}/').status_code, 404)
        self.assertTrue(Order.objects.filter(id=self.order.id).exists())

    def test_list_filtered_to_own(self):
        Order.objects.create(shift=self.shift, waiter=self.bob, table_number='7')
        self.client.force_authenticate(self.alice)
        r = self.client.get('/api/orders/')
        self.assertEqual(r.status_code, 200)
        data = r.data['results'] if isinstance(r.data, dict) else r.data
        ids = [o['id'] for o in data]
        self.assertEqual(ids, [self.order.id])   # только свой

    def test_admin_sees_all_orders(self):
        Order.objects.create(shift=self.shift, waiter=self.bob, table_number='7')
        self.client.force_authenticate(self.admin)
        r = self.client.get('/api/orders/')
        data = r.data['results'] if isinstance(r.data, dict) else r.data
        self.assertEqual(len(data), 2)

    # ── active отдаёт ВСЕ открытые заказы смены (нужно для занятости столов) ─
    def test_active_returns_all_open_orders(self):
        Order.objects.create(shift=self.shift, waiter=self.bob, table_number='7')
        self.client.force_authenticate(self.alice)
        r = self.client.get('/api/orders/active/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)   # видит и чужой стол как занятый

    def test_active_denied_for_kitchen(self):
        self.client.force_authenticate(self.kitchen)
        self.assertEqual(self.client.get('/api/orders/active/').status_code, 403)


class KitchenAccessTest(APITestCase):
    """Экран кухни (KITCHEN_VIEW): кухня и бармен — да; официант/гардероб — нет."""

    def setUp(self):
        self.kitchen  = make_user('cook',     'kitchen')
        self.barman   = make_user('barman',   'bartender')
        self.waiter   = make_user('waiter',   'waiter')
        self.wardrobe = make_user('wardrobe', 'wardrobe')

    def test_kitchen_role_allowed(self):
        self.client.force_authenticate(self.kitchen)
        self.assertEqual(self.client.get('/api/kitchen/orders/').status_code, 200)

    def test_bartender_allowed(self):
        self.client.force_authenticate(self.barman)
        self.assertEqual(self.client.get('/api/kitchen/orders/').status_code, 200)

    def test_waiter_denied(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get('/api/kitchen/orders/').status_code, 403)

    def test_wardrobe_denied(self):
        self.client.force_authenticate(self.wardrobe)
        self.assertEqual(self.client.get('/api/kitchen/orders/').status_code, 403)