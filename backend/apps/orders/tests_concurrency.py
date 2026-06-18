"""
Тесты одновременной работы нескольких официантов — поиск гонок.

Две группы:
  • Логические (APITestCase) — детерминированно проигрывают «проблемный порядок»
    и проверяют инварианты. Бегут на любой БД (в т.ч. SQLite в CI/локально).
  • Потоковые (TransactionTestCase, только Postgres) — реально одновременные
    запросы из N потоков. SQLite пропускаем: там select_for_update — no-op,
    настоящих блокировок строк нет, тест был бы недостоверным. Прод — Postgres.
"""
import threading
from decimal import Decimal
from unittest import skipUnless

from django.contrib.auth.models import User
from django.db import connection
from django.test import TransactionTestCase
from rest_framework.test import APITestCase, APIClient

from apps.shifts.models import Shift
from apps.orders.models import Order, OrderItem
from apps.menu.models import Menu, MenuSection, MenuCategory, MenuItem


def make_waiter(username):
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = 'waiter'
    p.save()
    return u


def make_menu_item(price='100.00'):
    menu = Menu.objects.create(name='Меню')
    sec = MenuSection.objects.create(menu=menu, name='Бар', station_type='bar')
    cat = MenuCategory.objects.create(section=sec, name='Категория')
    return MenuItem.objects.create(category=cat, name='Пиво', price=Decimal(price))


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


# ───────────────────────────── Логические (любая БД) ─────────────────────────

class TableConflictLogicTests(APITestCase):
    """Один открытый заказ на стол: повторное открытие/пересечение → 409."""

    def setUp(self):
        self.shift = Shift.objects.create()
        self.alice = make_waiter('alice')
        self.bob = make_waiter('bob')

    def _open(self, user, table):
        return client_for(user).post(
            '/api/orders/', {'shift': self.shift.id, 'table_number': table, 'guests': 2}, format='json')

    def test_second_waiter_same_table_conflict(self):
        r1 = self._open(self.alice, '5')
        r2 = self._open(self.bob, '5')
        self.assertIn(r1.status_code, (200, 201))
        self.assertEqual(r2.status_code, 409)
        self.assertEqual(Order.objects.filter(shift=self.shift, status='open').count(), 1)

    def test_overlapping_combined_table_conflict(self):
        self._open(self.alice, '5')
        r = self._open(self.bob, '5+6')          # пересекается по сегменту «5»
        self.assertEqual(r.status_code, 409)
        self.assertEqual(Order.objects.filter(shift=self.shift, status='open').count(), 1)

    def test_distinct_tables_both_open(self):
        r1 = self._open(self.alice, '5')
        r2 = self._open(self.bob, '6')
        self.assertIn(r1.status_code, (200, 201))
        self.assertIn(r2.status_code, (200, 201))
        self.assertEqual(Order.objects.filter(shift=self.shift, status='open').count(), 2)

    def test_split_to_occupied_table_conflict(self):
        item = make_menu_item()
        a = client_for(self.alice)
        # alice открывает '5' и добавляет позицию гостю 1
        r = a.post('/api/orders/', {'shift': self.shift.id, 'table_number': '5', 'guests': 2}, format='json')
        oid = r.data['id']
        a.post(f'/api/orders/{oid}/add_item/', {'menu_item': item.id, 'quantity': 1, 'guest_no': 1}, format='json')
        # bob занимает '6'
        self._open(self.bob, '6')
        # alice пытается вынести гостя 1 на занятый '6' → 409
        r2 = a.post(f'/api/orders/{oid}/guest/split/', {'guest_no': 1, 'table_number': '6'}, format='json')
        self.assertEqual(r2.status_code, 409)


class DoubleCloseTests(APITestCase):
    """Повторное закрытие/оплата не плодит чеки."""

    def setUp(self):
        self.shift = Shift.objects.create()
        self.alice = make_waiter('alice')
        self.item = make_menu_item()
        self.order = Order.objects.create(shift=self.shift, waiter=self.alice, table_number='5', guests=1)
        OrderItem.objects.create(order=self.order, menu_item=self.item, quantity=1,
                                 unit_price=self.item.price, guest_no=1)

    def test_double_close_single_receipt(self):
        a = client_for(self.alice)
        r1 = a.post(f'/api/orders/{self.order.id}/close/', {'payment_method': 'cash'}, format='json')
        r2 = a.post(f'/api/orders/{self.order.id}/close/', {'payment_method': 'cash'}, format='json')
        self.assertEqual(r1.status_code, 200)
        self.assertEqual(r2.status_code, 400)                 # уже закрыт / нет неоплаченных
        self.assertEqual(self.order.receipts.count(), 1)      # ровно один чек


class IdempotencySequentialTests(APITestCase):
    """Повтор мутации с тем же Idempotency-Key (ретрай офлайн-очереди) не дублирует."""

    def setUp(self):
        self.shift = Shift.objects.create()
        self.alice = make_waiter('alice')
        self.item = make_menu_item()

    def test_replayed_create_no_duplicate(self):
        a = client_for(self.alice)
        body = {'shift': self.shift.id, 'table_number': '5', 'guests': 2}
        r1 = a.post('/api/orders/', body, format='json', HTTP_IDEMPOTENCY_KEY='k-create')
        r2 = a.post('/api/orders/', body, format='json', HTTP_IDEMPOTENCY_KEY='k-create')
        self.assertIn(r1.status_code, (200, 201))
        self.assertEqual(r2.status_code, r1.status_code)      # повтор вернул прежний ответ
        self.assertEqual(r2.get('Idempotent-Replay'), 'true')
        self.assertEqual(Order.objects.filter(shift=self.shift).count(), 1)

    def test_replayed_add_item_no_duplicate(self):
        order = Order.objects.create(shift=self.shift, waiter=self.alice, table_number='5', guests=1)
        a = client_for(self.alice)
        url = f'/api/orders/{order.id}/add_item/'
        body = {'menu_item': self.item.id, 'quantity': 1, 'guest_no': 1}
        a.post(url, body, format='json', HTTP_IDEMPOTENCY_KEY='k-add')
        a.post(url, body, format='json', HTTP_IDEMPOTENCY_KEY='k-add')   # повтор
        self.assertEqual(order.items.count(), 1)

    def test_without_key_double_submit_duplicates(self):
        """Контроль: без ключа двойная отправка add_item даёт дубль — поэтому клиент
        ОБЯЗАН слать Idempotency-Key (см. офлайн-очередь)."""
        order = Order.objects.create(shift=self.shift, waiter=self.alice, table_number='5', guests=1)
        a = client_for(self.alice)
        url = f'/api/orders/{order.id}/add_item/'
        body = {'menu_item': self.item.id, 'quantity': 1, 'guest_no': 1}
        a.post(url, body, format='json')
        a.post(url, body, format='json')
        self.assertEqual(order.items.count(), 2)


# ───────────────────────── Потоковые (только Postgres) ───────────────────────

@skipUnless(connection.vendor == 'postgresql',
            'Реальные блокировки строк есть только в Postgres (SQLite: select_for_update — no-op).')
class ConcurrentWaitersTests(TransactionTestCase):
    """Реально одновременные запросы из нескольких потоков."""

    def setUp(self):
        self.shift = Shift.objects.create()
        self.waiters = [make_waiter(f'w{i}') for i in range(3)]
        self.item = make_menu_item()

    def test_three_waiters_same_table_only_one_opens(self):
        n = 3
        results = [None] * n
        barrier = threading.Barrier(n)

        def worker(i):
            c = client_for(self.waiters[i])
            barrier.wait()                       # стартуем максимально одновременно
            r = c.post('/api/orders/', {'shift': self.shift.id, 'table_number': '7', 'guests': 2}, format='json')
            results[i] = r.status_code
            connection.close()

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
        for t in threads: t.start()
        for t in threads: t.join()

        ok = [s for s in results if s in (200, 201)]
        self.assertEqual(len(ok), 1, f'Ожидался один успех, получили {results}')
        self.assertEqual(Order.objects.filter(shift=self.shift, status='open').count(), 1)

    def test_concurrent_same_idem_key_one_order(self):
        n = 3
        results = [None] * n
        barrier = threading.Barrier(n)
        body = {'shift': self.shift.id, 'table_number': '8', 'guests': 2}

        def worker(i):
            c = client_for(self.waiters[0])      # один официант, тройная отправка
            barrier.wait()
            r = c.post('/api/orders/', body, format='json', HTTP_IDEMPOTENCY_KEY='same-key')
            results[i] = r.status_code
            connection.close()

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
        for t in threads: t.start()
        for t in threads: t.join()

        # Дублей нет независимо от исхода гонки (201 + 409-«обрабатывается»/replay).
        self.assertEqual(Order.objects.filter(shift=self.shift).count(), 1, results)

    def test_concurrent_add_items_no_loss(self):
        order = Order.objects.create(shift=self.shift, waiter=self.waiters[0], table_number='9', guests=1)
        n = 3
        barrier = threading.Barrier(n)

        def worker(i):
            c = client_for(self.waiters[0])
            barrier.wait()
            c.post(f'/api/orders/{order.id}/add_item/',
                   {'menu_item': self.item.id, 'quantity': 1, 'guest_no': 1}, format='json')
            connection.close()

        threads = [threading.Thread(target=worker, args=(i,)) for i in range(n)]
        for t in threads: t.start()
        for t in threads: t.join()

        self.assertEqual(order.items.count(), n)   # ни одна позиция не потеряна