from datetime import date, time

from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from apps.reservations.models import Reservation


def make_user(username, role):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    p.save()
    return u


class ReservationAccessTest(APITestCase):
    """Доступ к ReservationViewSet: чтение — официант/бармен/админ; запись — бармен/админ."""

    def setUp(self):
        self.admin   = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.waiter  = make_user('waiter',  'waiter')
        self.barman  = make_user('barman',  'bartender')
        self.kitchen = make_user('cook',    'kitchen')
        self.res = Reservation.objects.create(
            name='Гость', phone='+70000000000',
            date=date(2026, 6, 20), time_start=time(20, 0), guests_count=2,
        )

    def _payload(self):
        return {'name': 'Новый', 'phone': '+71112223344',
                'date': '2026-06-21', 'time_start': '21:00', 'guests_count': 3}

    # ── Чтение: официант/бармен/админ — да; кухня — нет ───────────────────
    def test_waiter_can_read(self):
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.get('/api/reservations/').status_code, 200)

    def test_bartender_can_read(self):
        self.client.force_authenticate(self.barman)
        self.assertEqual(self.client.get('/api/reservations/').status_code, 200)

    def test_kitchen_cannot_read(self):
        self.client.force_authenticate(self.kitchen)
        self.assertEqual(self.client.get('/api/reservations/').status_code, 403)

    # ── Создание: бармен — да; официант — нет (только чтение) ─────────────
    def test_bartender_can_create(self):
        self.client.force_authenticate(self.barman)
        r = self.client.post('/api/reservations/', self._payload(), format='json')
        self.assertIn(r.status_code, (200, 201))

    def test_waiter_cannot_create(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.post('/api/reservations/', self._payload(), format='json')
        self.assertEqual(r.status_code, 403)

    # ── Смена статуса / депозит: бармен — да; официант — нет ──────────────
    def test_bartender_can_set_status(self):
        self.client.force_authenticate(self.barman)
        r = self.client.post(f'/api/reservations/{self.res.id}/set_status/',
                             {'status': 'confirmed'}, format='json')
        self.assertEqual(r.status_code, 200)
        self.res.refresh_from_db()
        self.assertEqual(self.res.status, 'confirmed')

    def test_waiter_cannot_set_status(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.post(f'/api/reservations/{self.res.id}/set_status/',
                             {'status': 'cancelled'}, format='json')
        self.assertEqual(r.status_code, 403)
        self.res.refresh_from_db()
        self.assertEqual(self.res.status, 'pending')

    def test_waiter_cannot_mark_deposit(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.post(f'/api/reservations/{self.res.id}/mark_deposit/',
                             {'paid': True}, format='json')
        self.assertEqual(r.status_code, 403)

    # ── ДЫРА: удаление брони — официанту нельзя, бармену/админу можно ─────
    def test_waiter_cannot_delete(self):
        self.client.force_authenticate(self.waiter)
        r = self.client.delete(f'/api/reservations/{self.res.id}/')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(Reservation.objects.filter(id=self.res.id).exists())

    def test_bartender_can_delete(self):
        self.client.force_authenticate(self.barman)
        r = self.client.delete(f'/api/reservations/{self.res.id}/')
        self.assertEqual(r.status_code, 204)