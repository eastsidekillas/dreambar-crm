"""Печать чеков на термопринтере (АТОЛ RP-326-USE и совместимые, ESC/POS).

Слой не зависит от способа подключения: здесь чек превращается в готовый
пакет ESC/POS-байтов (`render_receipt`), а доставка выбирается по типу
принтера в модели `Printer`:

* `network` — Ethernet, сырой сокет на порт 9100. Backend печатает сам
  (`send_network`) сразу при создании задания.
* `agent`   — USB на отдельном кассовом ПК. Backend печатать не может, поэтому
  задание остаётся в очереди (`PrintJob`), а локальный агент забирает его и
  печатает на месте. Те же самые байты пишутся в USB-устройство напрямую.

Кириллица: принтер печатает в CP866. Текст кодируется в cp866, страница
задаётся настройкой `PRINTER_CODEPAGE_PAGE`. Пустое значение — не посылать
команду выбора страницы (принтер остаётся на своей дефолтной кодировке).
"""
from __future__ import annotations

import socket
from decimal import Decimal

from django.conf import settings

# ── ESC/POS команды ──────────────────────────────────────────────────────────
ESC = b"\x1b"
GS  = b"\x1d"
INIT        = ESC + b"@"
ALIGN_LEFT   = ESC + b"a\x00"
ALIGN_CENTER = ESC + b"a\x01"
ALIGN_RIGHT  = ESC + b"a\x02"
BOLD_ON      = ESC + b"E\x01"
BOLD_OFF     = ESC + b"E\x00"
DOUBLE_ON    = GS  + b"!\x11"
DOUBLE_OFF   = GS  + b"!\x00"
CUT          = GS  + b"V\x42\x00"
FEED         = b"\n"

CODEPAGE = "cp866"


def _codepage_select() -> bytes:
    page = getattr(settings, "PRINTER_CODEPAGE_PAGE", 17)
    if page is None:
        return b""
    return ESC + b"t" + bytes([int(page)])


def _enc(text: str) -> bytes:
    return text.encode(CODEPAGE, errors="replace")


def _money(value) -> str:
    n = int(Decimal(str(value)).quantize(Decimal("1")))
    return f"{n:,}".replace(",", " ")


def _line(left: str, right: str, width: int) -> bytes:
    right = right or ""
    space = width - len(right)
    left  = left[:max(0, space - 1)]
    pad   = width - len(left) - len(right)
    return _enc(left + " " * max(1, pad) + right) + FEED


def render_receipt(receipt, width: int = 48) -> bytes:
    from django.utils import timezone

    out = bytearray()
    out += INIT
    out += _codepage_select()

    out += ALIGN_CENTER + DOUBLE_ON + BOLD_ON
    out += _enc("BAR DREAM") + FEED
    out += DOUBLE_OFF + BOLD_OFF
    out += _enc("Предчек · не фискальный") + FEED
    out += _enc("-" * width) + FEED

    out += ALIGN_LEFT
    issued = timezone.localtime(receipt.issued_at).strftime("%d.%m.%Y %H:%M")
    out += _line("Чек №", receipt.code, width)
    out += _line("Стол", receipt.table_number or "—", width)
    waiter = ""
    if receipt.waiter_id:
        waiter = receipt.waiter.get_full_name() or receipt.waiter.username
    out += _line("Официант", waiter or "—", width)
    out += _line("Дата", issued, width)
    out += _enc("-" * width) + FEED

    for it in receipt.items.all():
        name = it.menu_item.name
        out += _enc(name[:width]) + FEED
        qty  = f"{it.quantity} x {_money(it.unit_price)}"
        out += _line("  " + qty, _money(it.subtotal), width)
    out += _enc("-" * width) + FEED

    out += BOLD_ON + DOUBLE_ON
    out += _line("ИТОГО", _money(receipt.total) + " руб", width // 2)
    out += DOUBLE_OFF + BOLD_OFF
    out += _line("Оплата", receipt.get_payment_method_display(), width)

    out += _enc("-" * width) + FEED
    out += ALIGN_CENTER + _enc("Спасибо за визит!") + FEED
    out += FEED * 3
    out += CUT
    return bytes(out)


def send_network(host: str, port: int, payload: bytes, timeout: float = 5.0) -> None:
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(payload)


def get_default_printer():
    from apps.orders.models import Printer
    return (Printer.objects.filter(is_active=True, is_default=True).first()
            or Printer.objects.filter(is_active=True).first())


def dispatch(job) -> None:
    from django.utils import timezone

    printer = job.printer
    if printer.connection != 'network':
        return

    try:
        send_network(printer.host, printer.port, bytes(job.payload))
        job.status = 'done'
        job.sent_at = timezone.now()
        job.error   = ''
    except OSError as exc:
        job.status = 'error'
        job.error  = f'{type(exc).__name__}: {exc}'
    job.save(update_fields=['status', 'sent_at', 'error'])


def build_test_page(printer) -> bytes:
    from django.utils import timezone
    w = printer.width
    out = bytearray()
    out += INIT + _codepage_select()
    out += ALIGN_CENTER + BOLD_ON + DOUBLE_ON
    out += _enc("ТЕСТ ПРИНТЕРА") + FEED
    out += DOUBLE_OFF + BOLD_OFF
    out += _enc("-" * w) + FEED
    out += ALIGN_LEFT
    out += _line("Принтер", printer.name, w)
    out += _line("Подключение", printer.get_connection_display(), w)
    if printer.connection == 'network':
        out += _line("Адрес", f"{printer.host}:{printer.port}", w)
    out += _line("Ширина", f"{w} симв.", w)
    out += _line("Время", timezone.localtime().strftime("%d.%m.%Y %H:%M:%S"), w)
    out += _enc("-" * w) + FEED
    out += ALIGN_CENTER + _enc("Принтер работает!") + FEED
    out += FEED * 3 + CUT
    return bytes(out)


def send_to_printer(printer, payload: bytes) -> None:
    if printer.connection == 'network':
        send_network(printer.host, printer.port, payload)
    else:
        raise RuntimeError('Тестовая печать через агент не поддерживается — агент сам заберёт задание из очереди.')


def print_receipt(receipt, printer=None):
    from apps.orders.models import PrintJob

    printer = printer or get_default_printer()
    if printer is None:
        raise RuntimeError('Не настроен ни один активный принтер.')

    payload = render_receipt(receipt, width=printer.width)
    job = PrintJob.objects.create(
        printer=printer, kind='receipt', receipt=receipt, payload=payload,
    )
    dispatch(job)
    return job