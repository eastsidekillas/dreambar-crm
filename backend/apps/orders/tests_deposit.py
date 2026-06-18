"""Депозит, внесённый официантом за столом: эндпоинт + учёт в чекауте."""
from decimal import Decimal

from rest_framework.test import APITestCase

from apps.shifts.models import Shift
from apps.orders.models import Order, OrderItem
from apps.orders.tests_concurrency import make_waiter, make_menu_item, client_for


class WaiterDepositTests(APITestCase):
    def setUp(self):
        self.shift = Shift.objects.create()
        self.alice = make_waiter('alice')
        self.bob = make_waiter('bob')
        self.item = make_menu_item('100.00')
        self.order = Order.objects.create(shift=self.shift, waiter=self.alice, table_number='V1', guests=2)

    def _add_item(self, qty=1):
        OrderItem.objects.create(order=self.order, menu_item=self.item, quantity=qty,
                                 unit_price=self.item.price, guest_no=1)

    def test_set_deposit(self):
        a = client_for(self.alice)
        r = a.post(f'/api/orders/{self.order.id}/deposit/', {'amount': '500', 'method': 'cash'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.order.refresh_from_db()
        self.assertEqual(self.order.deposit_amount, Decimal('500'))
        self.assertEqual(self.order.deposit_method, 'cash')

    def test_method_required_when_amount_positive(self):
        a = client_for(self.alice)
        r = a.post(f'/api/orders/{self.order.id}/deposit/', {'amount': '500'}, format='json')
        self.assertEqual(r.status_code, 400)

    def test_clear_deposit(self):
        self.order.deposit_amount = Decimal('500'); self.order.deposit_method = 'cash'; self.order.save()
        a = client_for(self.alice)
        a.post(f'/api/orders/{self.order.id}/deposit/', {'amount': '0'}, format='json')
        self.order.refresh_from_db()
        self.assertEqual(self.order.deposit_amount, Decimal('0'))
        self.assertEqual(self.order.deposit_method, '')

    def test_other_waiter_denied(self):
        b = client_for(self.bob)
        r = b.post(f'/api/orders/{self.order.id}/deposit/', {'amount': '500', 'method': 'cash'}, format='json')
        self.assertIn(r.status_code, (403, 404))

    def test_checkout_subtracts_deposit(self):
        # счёт 300, депозит 100 → списано 100, к оплате 200 (total остаётся полным)
        self._add_item(qty=3)   # 3 × 100 = 300
        self.order.deposit_amount = Decimal('100'); self.order.deposit_method = 'cash'; self.order.save()
        a = client_for(self.alice)
        r = a.post(f'/api/orders/{self.order.id}/checkout/', {'bills': [
            {'item_ids': list(self.order.items.values_list('id', flat=True)), 'payment_method': 'cash'},
        ]}, format='json')
        self.assertEqual(r.status_code, 200)
        receipt = r.data['receipts'][0]
        self.assertEqual(Decimal(str(receipt['total'])), Decimal('300'))           # полный счёт
        self.assertEqual(Decimal(str(receipt['deposit_amount'])), Decimal('100'))  # списан депозит

    def test_checkout_deposit_over_total_refund(self):
        # счёт 100, депозит 300 → списано 100, возврат 200 при полном закрытии
        self._add_item(qty=1)   # 100
        self.order.deposit_amount = Decimal('300'); self.order.deposit_method = 'cash'; self.order.save()
        a = client_for(self.alice)
        r = a.post(f'/api/orders/{self.order.id}/checkout/', {'bills': [
            {'item_ids': list(self.order.items.values_list('id', flat=True)), 'payment_method': 'cash'},
        ]}, format='json')
        self.assertEqual(r.status_code, 200)
        receipt = r.data['receipts'][0]
        self.assertEqual(Decimal(str(receipt['deposit_amount'])), Decimal('100'))  # списано не больше счёта
        self.assertEqual(Decimal(str(receipt['refund_amount'])), Decimal('200'))   # возврат остатка