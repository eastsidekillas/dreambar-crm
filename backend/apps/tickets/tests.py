from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from apps.shifts.models import Shift
from apps.tickets.models import EntryTicket


def make_user(username, role):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    p.save()
    return u


class EntryTicketAccessTest(APITestCase):
    """Доступ к EntryTicketViewSet: продажа — официант/гардероб, правка/удаление — только админ."""

    def setUp(self):
        self.admin    = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.waiter   = make_user('waiter',   'waiter')
        self.wardrobe = make_user('wardrobe', 'wardrobe')
        self.barman   = make_user('barman',   'bartender')
        self.kitchen  = make_user('cook',     'kitchen')
        self.shift    = Shift.objects.create()
        self.ticket   = EntryTicket.objects.create(
            shift=self.shift, bracelet_number='000001', price=200, created_by=self.wardrobe)

    def _sell(self, num):
        return self.client.post('/api/tickets/',
                                {'shift': self.shift.id, 'bracelet_number': num, 'price': 200},
                                format='json')

    # ── Продажа и просмотр: гардероб/официант — да; бармен/кухня — нет ─────
    def test_wardrobe_can_sell(self):
        self.client.force_authenticate(self.wardrobe)
        self.assertIn(self._sell('000010').status_code, (200, 201))

    def test_waiter_can_sell(self):
        self.client.force_authenticate(self.waiter)
        self.assertIn(self._sell('000011').status_code, (200, 201))

    def test_bartender_cannot_sell(self):
        self.client.force_authenticate(self.barman)
        self.assertEqual(self._sell('000012').status_code, 403)

    def test_kitchen_cannot_list(self):
        self.client.force_authenticate(self.kitchen)
        self.assertEqual(self.client.get('/api/tickets/').status_code, 403)

    def test_wardrobe_can_list(self):
        self.client.force_authenticate(self.wardrobe)
        self.assertEqual(self.client.get('/api/tickets/').status_code, 200)

    # ── bulk_create — тоже продажа (TICKET_SELL) ──────────────────────────
    def test_wardrobe_bulk_create(self):
        self.client.force_authenticate(self.wardrobe)
        r = self.client.post('/api/tickets/bulk_create/',
                             {'shift': self.shift.id, 'start': 100, 'end': 105, 'price': 200},
                             format='json')
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['created'], 6)

    def test_bartender_cannot_bulk_create(self):
        self.client.force_authenticate(self.barman)
        r = self.client.post('/api/tickets/bulk_create/',
                             {'shift': self.shift.id, 'start': 100, 'end': 105},
                             format='json')
        self.assertEqual(r.status_code, 403)

    # ── ДЫРА: правка/удаление билета — только админ ───────────────────────
    def test_waiter_cannot_delete_ticket(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.delete(f'/api/tickets/{self.ticket.id}/')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(EntryTicket.objects.filter(id=self.ticket.id).exists())

    def test_waiter_cannot_edit_ticket(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.patch(f'/api/tickets/{self.ticket.id}/', {'price': 1}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_admin_can_delete_ticket(self):
        self.client.force_authenticate(self.admin)
        r = self.client.delete(f'/api/tickets/{self.ticket.id}/')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(EntryTicket.objects.filter(id=self.ticket.id).exists())