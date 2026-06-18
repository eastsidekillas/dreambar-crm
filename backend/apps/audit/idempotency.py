"""
Идемпотентность мутирующих запросов.

Клиент (офлайн-очередь официанта) шлёт заголовок `Idempotency-Key` (UUID) на
каждую мутацию. Если связь оборвалась после того, как сервер уже выполнил
операцию, но ответ не дошёл — клиент повторит запрос с ТЕМ ЖЕ ключом, и сервер
вернёт сохранённый ответ вместо повторного выполнения. Так лечится, например,
дубль открытого стола при обрыве в момент отправки.

Без заголовка middleware прозрачен (обычные запросы не трогает). GET игнорируем.
Кэшируем только успешные ответы (2xx) — после ошибки клейм снимается, чтобы
повтор честно выполнился заново.
"""
from django.db import IntegrityError
from django.http import HttpResponse, JsonResponse
from django.utils import timezone

SAFE_METHODS = {'GET', 'HEAD', 'OPTIONS', 'TRACE'}
HEADER = 'HTTP_IDEMPOTENCY_KEY'
# Незавершённый claim старше этого считаем заброшенным (предыдущий запрос умер,
# не завершив) и переклеймливаем — иначе ключ навсегда отвечал бы 409. Порог
# заведомо больше любого реального запроса, чтобы не задвоить ещё живой.
STALE_CLAIM_SECONDS = 60


class IdempotencyMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        key = request.META.get(HEADER)
        if not key or request.method in SAFE_METHODS:
            return self.get_response(request)

        from .models import IdempotencyKey

        # Клейм ключа атомарно через unique-constraint: первый создаёт строку,
        # параллельный/повторный получает created=False.
        try:
            obj, created = IdempotencyKey.objects.get_or_create(
                key=key[:128],
                defaults={'method': request.method, 'path': request.path[:255]},
            )
        except IntegrityError:
            obj = IdempotencyKey.objects.filter(key=key[:128]).first()
            created = False

        if not created:
            if obj and obj.completed:
                resp = HttpResponse(
                    obj.response_body,
                    status=obj.response_status or 200,
                    content_type=obj.content_type or 'application/json',
                )
                resp['Idempotent-Replay'] = 'true'
                return resp
            stale = obj and (timezone.now() - obj.created_at).total_seconds() > STALE_CLAIM_SECONDS
            if not stale:
                # Ещё выполняется (двойная отправка почти одновременно) — повторить позже.
                return JsonResponse(
                    {'detail': 'Запрос уже обрабатывается, повторите позже.'},
                    status=409,
                )
            # Заброшенный claim (предыдущий запрос умер) — переклеймливаем и выполняем.
            IdempotencyKey.objects.filter(pk=obj.pk).update(created_at=timezone.now())

        # Первый раз (или переклейм заброшенного) — выполняем операцию.
        response = self.get_response(request)

        cacheable = (
            200 <= response.status_code < 300
            and not getattr(response, 'streaming', False)
            and hasattr(response, 'content')
        )
        if cacheable:
            IdempotencyKey.objects.filter(pk=obj.pk).update(
                completed=True,
                response_status=response.status_code,
                response_body=response.content.decode('utf-8', errors='replace'),
                content_type=response.get('Content-Type', 'application/json'),
            )
        else:
            # Ошибка/нестандартный ответ — снимаем клейм, чтобы повтор сработал.
            IdempotencyKey.objects.filter(pk=obj.pk).delete()
        return response