from django.test import TestCase, RequestFactory
from django.http import JsonResponse

from apps.audit.idempotency import IdempotencyMiddleware
from apps.audit.models import IdempotencyKey


class IdempotencyMiddlewareTests(TestCase):
    def setUp(self):
        self.rf = RequestFactory()
        self.calls = 0

    def _mw(self, status=201):
        def view(request):
            self.calls += 1
            return JsonResponse({'n': self.calls}, status=status)
        return IdempotencyMiddleware(view)

    def _post(self, mw, key=None):
        extra = {'HTTP_IDEMPOTENCY_KEY': key} if key else {}
        return mw(self.rf.post('/api/orders/', **extra))

    def test_replay_runs_once_and_returns_cached(self):
        mw = self._mw()
        r1 = self._post(mw, 'k1')
        r2 = self._post(mw, 'k1')
        self.assertEqual(self.calls, 1)                       # операция выполнена ОДИН раз
        self.assertEqual(r1.content, r2.content)              # повтор вернул тот же ответ
        self.assertEqual(r2['Idempotent-Replay'], 'true')
        self.assertEqual(IdempotencyKey.objects.filter(key='k1', completed=True).count(), 1)

    def test_different_keys_each_run(self):
        mw = self._mw()
        self._post(mw, 'a')
        self._post(mw, 'b')
        self.assertEqual(self.calls, 2)

    def test_no_key_passes_through(self):
        mw = self._mw()
        self._post(mw)
        self._post(mw)
        self.assertEqual(self.calls, 2)
        self.assertEqual(IdempotencyKey.objects.count(), 0)

    def test_get_not_tracked(self):
        mw = self._mw()
        mw(self.rf.get('/api/orders/', HTTP_IDEMPOTENCY_KEY='g'))
        self.assertEqual(IdempotencyKey.objects.count(), 0)

    def test_error_not_cached_so_retry_reruns(self):
        mw = self._mw(status=400)
        self._post(mw, 'e1')                                  # 400 — клейм снимается
        self.assertEqual(IdempotencyKey.objects.filter(key='e1').count(), 0)
        self._post(mw, 'e1')                                  # повтор честно выполняется
        self.assertEqual(self.calls, 2)