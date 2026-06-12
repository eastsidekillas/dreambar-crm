from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from .models import Product, ReceiptImport, ReceiptItemMapping

SAMPLE_INFO = {
    'success': True,
    'status': 'done',
    'error': '',
    's': '5 803.00',
    't': '20.03.2019 23:03',
    'result': {
        'user': 'ООО "Лента"',
        'items': [
            {'name': 'Пиво BUD св 0.45 ст/б', 'quantity': 12, 'price': 67.99, 'sum': 815.88},
            {'name': 'Водка TUNDRA 0.5л', 'quantity': 2, 'price': 379.49, 'sum': 758.98},
            {'name': 'Пакет ЛЕНТА средний майка 12кг', 'quantity': 1, 'price': 6.45, 'sum': 6.45},
        ],
    },
}


class ReceiptImportFlowTest(APITestCase):
    """Полный цикл импорта чека: отправка QR → poll → сопоставление → apply."""

    def setUp(self):
        self.admin = User.objects.create_superuser('admin', 'a@a.ru', 'pass')
        self.client.force_authenticate(self.admin)
        self.beer  = Product.objects.create(name='Bud', unit='шт', pack_size=1, stock_quantity=5)
        self.vodka = Product.objects.create(name='Водка Tundra', unit='мл', pack_size=500,
                                            stock_quantity=1000, purchase_price=400)
        # Пиво уже сопоставлялось раньше — должно подставиться автоматически
        ReceiptItemMapping.objects.create(receipt_name='Пиво BUD св 0.45 ст/б', product=self.beer)

    @patch('apps.inventory.views.codeqr.add_qr', return_value='abc123')
    def test_create(self, _):
        r = self.client.post('/api/inventory/receipt-imports/', {'qr': 't=...&s=...'})
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['hash'], 'abc123')
        # Повторная загрузка того же чека отбивается
        r2 = self.client.post('/api/inventory/receipt-imports/', {'qr': 't=...&s=...'})
        self.assertEqual(r2.status_code, 409)

    @patch('apps.inventory.views.codeqr.info', return_value=SAMPLE_INFO)
    def test_poll_and_apply(self, _):
        imp = ReceiptImport.objects.create(hash='abc123', created_by=self.admin)

        r = self.client.post(f'/api/inventory/receipt-imports/{imp.pk}/poll/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['status'], 'done')
        self.assertEqual(r.data['store'], 'ООО Лента')
        lines = r.data['lines']
        self.assertEqual(len(lines), 3)
        # Пиво сопоставилось из словаря, остальное — нет
        self.assertEqual(lines[0]['product'], self.beer.pk)
        self.assertIsNone(lines[1]['product'])

        # Оприходуем пиво и водку, пакет пропускаем; водку запоминаем
        payload = {'lines': [
            {**lines[0], 'remember': True},
            {**lines[1], 'product': self.vodka.pk, 'remember': True},
            lines[2],
        ]}
        r = self.client.post(f'/api/inventory/receipt-imports/{imp.pk}/apply/', payload, format='json')
        self.assertEqual(r.status_code, 200)

        self.beer.refresh_from_db()
        self.vodka.refresh_from_db()
        self.assertEqual(self.beer.stock_quantity, Decimal('17'))          # 5 + 12 шт
        self.assertEqual(self.vodka.stock_quantity, Decimal('2000'))       # 1000 + 2×500 мл
        self.assertEqual(self.vodka.purchase_price, Decimal('379.49'))     # цена со скидкой из чека
        self.assertTrue(ReceiptItemMapping.objects.filter(
            receipt_name='Водка TUNDRA 0.5л', product=self.vodka).exists())

        imp.refresh_from_db()
        self.assertEqual(imp.status, 'applied')
        self.assertIsNotNone(imp.purchase)
        self.assertEqual(imp.purchase.store, 'ООО Лента')
        # Закупка: 2 позиции (пакет пропущен)
        self.assertEqual(imp.purchase.items.count(), 2)

        # Повторное оприходование запрещено
        r = self.client.post(f'/api/inventory/receipt-imports/{imp.pk}/apply/', payload, format='json')
        self.assertEqual(r.status_code, 400)