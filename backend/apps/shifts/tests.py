from django.contrib.auth.models import User
from rest_framework.test import APITestCase

from apps.shifts.models import Shift


def make_user(username, role):
    """Пользователь с профилем нужной роли (профиль создаётся сигналом post_save)."""
    u = User.objects.create_user(username, password='p')
    p = u.profile
    p.role = role
    p.save()
    return u


class ShiftPermissionsTest(APITestCase):
    """Контроль доступа ShiftViewSet по матрице ролей (закрытие дыры без явных permissions)."""

    def setUp(self):
        self.admin    = User.objects.create_superuser('admin', 'a@a.ru', 'p')
        self.waiter   = make_user('waiter',   'waiter')
        self.wardrobe = make_user('wardrobe', 'wardrobe')
        self.kitchen  = make_user('kitchen',  'kitchen')

    # ── Чтение доступно всем залогиненным ──────────────────────────────────
    def test_current_shift_readable_by_kitchen(self):
        Shift.objects.create()  # is_open=True по умолчанию
        self.client.force_authenticate(self.kitchen)
        r = self.client.get('/api/shifts/current/')
        self.assertEqual(r.status_code, 200)

    # ── Открытие смены: floor-роли могут, кухня — нет ──────────────────────
    def test_open_allowed_for_waiter_and_wardrobe(self):
        for user in (self.waiter, self.wardrobe):
            Shift.objects.all().delete()
            self.client.force_authenticate(user)
            r = self.client.post('/api/shifts/', {}, format='json')
            self.assertIn(r.status_code, (200, 201), msg=f'{user.username}: {r.status_code}')

    def test_open_denied_for_kitchen(self):
        Shift.objects.all().delete()
        self.client.force_authenticate(self.kitchen)
        r = self.client.post('/api/shifts/', {}, format='json')
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Shift.objects.exists())

    # ── Закрытие смены: официант может, кухня — нет ────────────────────────
    def test_close_allowed_for_waiter(self):
        s = Shift.objects.create()
        self.client.force_authenticate(self.waiter)
        r = self.client.post(f'/api/shifts/{s.id}/close/')
        self.assertEqual(r.status_code, 200)
        s.refresh_from_db()
        self.assertFalse(s.is_open)

    def test_close_denied_for_kitchen(self):
        s = Shift.objects.create()
        self.client.force_authenticate(self.kitchen)
        r = self.client.post(f'/api/shifts/{s.id}/close/')
        self.assertEqual(r.status_code, 403)
        s.refresh_from_db()
        self.assertTrue(s.is_open)

    # ── Переоткрытие: только админ ─────────────────────────────────────────
    def test_reopen_admin_only(self):
        s = Shift.objects.create(is_open=False)
        self.client.force_authenticate(self.waiter)
        self.assertEqual(self.client.post(f'/api/shifts/{s.id}/reopen/').status_code, 403)
        self.client.force_authenticate(self.admin)
        r = self.client.post(f'/api/shifts/{s.id}/reopen/')
        self.assertEqual(r.status_code, 200)
        s.refresh_from_db()
        self.assertTrue(s.is_open)

    # ── ДЫРА, которую закрываем: удаление смены — только админ ─────────────
    def test_destroy_denied_for_waiter_allowed_for_admin(self):
        s = Shift.objects.create()
        self.client.force_authenticate(self.waiter)
        r = self.client.delete(f'/api/shifts/{s.id}/')
        self.assertEqual(r.status_code, 403)
        self.assertTrue(Shift.objects.filter(id=s.id).exists())  # не удалилась

        self.client.force_authenticate(self.admin)
        r = self.client.delete(f'/api/shifts/{s.id}/')
        self.assertEqual(r.status_code, 204)
        self.assertFalse(Shift.objects.filter(id=s.id).exists())

    # ── ДЫРА: правка смены (PATCH) — только админ ──────────────────────────
    def test_update_denied_for_waiter(self):
        s = Shift.objects.create(notes='')
        self.client.force_authenticate(self.waiter)
        r = self.client.patch(f'/api/shifts/{s.id}/', {'notes': 'hacked'}, format='json')
        self.assertEqual(r.status_code, 403)
        s.refresh_from_db()
        self.assertEqual(s.notes, '')