"""Клиент сервиса проверки кассовых чеков code-qr.ru.

Сервис принимает QR-код чека (или реквизиты ФД/ФН/ФП) и возвращает
состав чека из ФНС: позиции, количества, фактически уплаченные цены
(со всеми скидками). Документация: https://code-qr.ru/api
"""
import json
import urllib.error
import urllib.parse
import urllib.request

from django.conf import settings

BASE_URL = getattr(settings, 'CODE_QR_BASE_URL', 'https://code-qr.ru/api')
TIMEOUT = 20


class CodeQrError(Exception):
    """Ошибка сервиса проверки чеков (сообщение показывается пользователю)."""


def _request(method: str, path: str, params: dict) -> dict:
    url = f'{BASE_URL}{path}'
    data = None
    headers = {'Accept': 'application/json'}
    # Ключ из личного кабинета code-qr.ru, передаётся в заголовке `key`
    api_key = getattr(settings, 'CODE_QR_API_KEY', '')
    if api_key:
        headers['key'] = api_key

    if method == 'GET':
        url += '?' + urllib.parse.urlencode(params)
    else:
        data = urllib.parse.urlencode(params).encode()
        headers['Content-Type'] = 'application/x-www-form-urlencoded'

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            payload = json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode())
        except Exception:
            raise CodeQrError(f'Сервис проверки чеков недоступен (HTTP {e.code})')
    except (urllib.error.URLError, TimeoutError):
        raise CodeQrError('Сервис проверки чеков недоступен — попробуйте позже')
    except json.JSONDecodeError:
        raise CodeQrError('Сервис проверки чеков вернул некорректный ответ')

    if not payload.get('success', False):
        raise CodeQrError(payload.get('message') or 'Неизвестная ошибка сервиса проверки чеков')
    return payload


def add_qr(qr: str) -> str:
    """Отправляет строку QR-кода чека на проверку, возвращает hash."""
    return _request('POST', '/receipt/add-qr', {'qr': qr})['hash']


def add_requisites(fn: str, fd: str, fp: str, total: str, ts: str) -> str:
    """Отправляет чек по реквизитам (ФН/ФД/ФП, сумма, время), возвращает hash."""
    return _request('POST', '/receipt/add', {'fn': fn, 'i': fd, 'fp': fp, 's': total, 't': ts})['hash']


def info(hash_: str) -> dict:
    """Статус проверки и состав чека: {status, error, result: {user, items: [...]}}."""
    return _request('GET', '/receipt/info', {'hash': hash_})