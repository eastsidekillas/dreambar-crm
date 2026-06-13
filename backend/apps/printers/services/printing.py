"""Печать чеков на термопринтере (АТОЛ RP-326-USE и совместимые, ESC/POS).

* `network` — Ethernet, сырой сокет на порт 9100.
* `agent`   — USB через локальный агент (задание остаётся в очереди PrintJob).

Кириллица: CP866, страница задаётся настройкой PRINTER_CODEPAGE_PAGE.
"""
from __future__ import annotations

import socket
from decimal import Decimal

from django.conf import settings

# ── ESC/POS команды ──────────────────────────────────────────────────────────
ESC = b"\x1b"
GS  = b"\x1d"
INIT         = ESC + b"@"
ALIGN_LEFT   = ESC + b"a\x00"
ALIGN_CENTER = ESC + b"a\x01"
ALIGN_RIGHT  = ESC + b"a\x02"
BOLD_ON      = ESC + b"E\x01"
BOLD_OFF     = ESC + b"E\x00"
DOUBLE_ON    = GS  + b"!\x11"
DOUBLE_OFF   = GS  + b"!\x00"
CUT          = GS  + b"V\x42\x00"
FEED         = b"\n"
CASH_DRAWER  = ESC + b"p\x00\x19\xfa"  # ESC p, pin 2, 50 ms on, 500 ms off

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


def render_receipt(receipt, width: int = 48, copy_label: str = "") -> bytes:
    from django.utils import timezone

    out = bytearray()
    out += INIT + _codepage_select()
    out += ALIGN_CENTER + DOUBLE_ON + BOLD_ON
    out += _enc("BAR DREAM") + FEED
    out += DOUBLE_OFF + BOLD_OFF
    out += _enc("vk.com/mydreambar") + FEED
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
        name   = it.menu_item.name
        volume = it.menu_item.volume or ""
        label  = f"{name} ({volume})" if volume else name
        out += _enc(label[:width]) + FEED
        qty  = f"{it.quantity} x {_money(it.unit_price)}"
        out += _line("  " + qty, _money(it.subtotal), width)
    out += _enc("-" * width) + FEED

    out += BOLD_ON + DOUBLE_ON
    out += _line("ИТОГО", _money(receipt.total) + " руб", width // 2)
    out += DOUBLE_OFF + BOLD_OFF
    if receipt.deposit_amount and Decimal(str(receipt.deposit_amount)) > 0:
        dep_label = {"cash": "нал", "transfer": "перевод"}.get(receipt.deposit_method, "")
        out += _line("Депозит" + (f" ({dep_label})" if dep_label else ""),
                     "-" + _money(receipt.deposit_amount) + " руб", width)
        due = Decimal(str(receipt.total)) - Decimal(str(receipt.deposit_amount))
        out += BOLD_ON + DOUBLE_ON
        out += _line("К оплате", _money(max(due, Decimal(0))) + " руб", width // 2)
        out += DOUBLE_OFF + BOLD_OFF
        if due < 0:
            out += _line("Возврат", _money(-due) + " руб", width)
    out += _line("Оплата", receipt.get_payment_method_display(), width)
    out += _enc("-" * width) + FEED
    out += ALIGN_CENTER + _enc("Спасибо за визит!") + FEED
    if copy_label:
        out += FEED + BOLD_ON + _enc(copy_label) + FEED + BOLD_OFF
    out += FEED * 3 + CUT
    return bytes(out)


def render_receipt_two_copies(receipt, width: int = 48) -> bytes:
    return (
        render_receipt(receipt, width=width, copy_label="") +
        render_receipt(receipt, width=width, copy_label="--- ДЛЯ СВЕРКИ ---")
    )


def send_network(host: str, port: int, payload: bytes, timeout: float = 5.0) -> None:
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(payload)


def get_default_printer():
    from apps.printers.models import Printer
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
        raise RuntimeError('Тестовая печать через агент не поддерживается.')


def print_receipt(receipt, printer=None):
    from apps.printers.models import PrintJob

    printer = printer or get_default_printer()
    if printer is None:
        raise RuntimeError('Не настроен ни один активный принтер.')

    payload = render_receipt_two_copies(receipt, width=printer.width)
    if receipt.payment_method == 'cash':
        payload = CASH_DRAWER + payload
    job = PrintJob.objects.create(
        printer=printer, kind='receipt', receipt=receipt, payload=payload,
    )
    dispatch(job)
    return job


def render_shift_sales_report(shift, width: int = 48) -> bytes:
    from django.utils import timezone
    from apps.orders.models import OrderItem
    from apps.receipts.models import Receipt
    from apps.tickets.models import EntryTicket

    paid_items = list(
        OrderItem.objects
        .filter(receipt__shift=shift)
        .select_related('menu_item__category__section', 'receipt')
    )

    cat_totals: dict[str, int] = {}
    for item in paid_items:
        cat = item.menu_item.category.section.station_type
        cat_totals[cat] = cat_totals.get(cat, 0) + int(item.unit_price * item.quantity)

    receipts = list(Receipt.objects.filter(shift=shift))
    pay_totals: dict[str, int] = {}
    for r in receipts:
        pay_totals[r.payment_method] = pay_totals.get(r.payment_method, 0) + int(r.total)

    tickets = list(EntryTicket.objects.filter(shift=shift))
    ticket_total   = sum(int(t.price) for t in tickets)
    ticket_count   = len(tickets)
    orders_count   = shift.orders.filter(status__in=['open', 'closed']).count()
    receipts_count = len(receipts)
    grand_total    = sum(cat_totals.values()) + ticket_total

    out = bytearray()
    out += INIT + _codepage_select()
    out += ALIGN_CENTER + DOUBLE_ON + BOLD_ON
    out += _enc("БАР ДРИМ") + FEED
    out += DOUBLE_OFF + BOLD_OFF
    out += _enc("ИТОГИ СМЕНЫ") + FEED
    out += _enc("-" * width) + FEED

    out += ALIGN_LEFT
    out += _line("Дата", shift.date.strftime("%d.%m.%Y"), width)
    if shift.opened_by_id:
        name = shift.opened_by.get_full_name() or shift.opened_by.username
        out += _line("Открыл", name, width)
    if shift.closed_at:
        out += _line("Закрыта", timezone.localtime(shift.closed_at).strftime("%H:%M"), width)
    out += _enc("-" * width) + FEED

    out += BOLD_ON + _enc("ПРОДАЖИ ПО РАЗДЕЛАМ") + FEED + BOLD_OFF
    for cat, label in (('bar', 'Бар'), ('kitchen', 'Кухня'), ('hookah', 'Кальян')):
        val = cat_totals.get(cat, 0)
        if val:
            out += _line(f"  {label}", _money(val) + " руб", width)
    if ticket_total:
        out += _line("  Вход / билеты", _money(ticket_total) + " руб", width)
    out += _enc("-" * width) + FEED

    out += BOLD_ON + _enc("ПО ТИПУ ОПЛАТЫ") + FEED + BOLD_OFF
    for method, label in (
        ('cash', 'Наличные'), ('card', 'Карта'),
        ('transfer', 'Перевод'), ('mixed', 'Смешанный'),
    ):
        val = pay_totals.get(method, 0)
        if val:
            out += _line(f"  {label}", _money(val) + " руб", width)
    out += _enc("-" * width) + FEED

    out += BOLD_ON + DOUBLE_ON
    out += _line("ИТОГО", _money(grand_total) + " руб", width // 2)
    out += DOUBLE_OFF + BOLD_OFF
    out += _enc("-" * width) + FEED
    out += _line("Заказов",  str(orders_count),   width)
    out += _line("Чеков",    str(receipts_count),  width)
    if ticket_count:
        out += _line("Билетов", str(ticket_count), width)

    out += FEED * 3 + CUT
    return bytes(out)


def render_shift_deletions_report(shift, width: int = 48) -> bytes:
    from django.utils import timezone
    from apps.audit.models import DeletedOrderItem

    deletions = list(
        DeletedOrderItem.objects
        .filter(shift=shift)
        .select_related('deleted_by')
        .order_by('deleted_at')
    )

    STATUS_RU = {'new': 'не начат', 'cooking': 'готовился', 'ready': 'был готов'}

    out = bytearray()
    out += INIT + _codepage_select()
    out += ALIGN_CENTER + DOUBLE_ON + BOLD_ON
    out += _enc("БАР ДРИМ") + FEED
    out += DOUBLE_OFF + BOLD_OFF
    out += _enc("УДАЛЁННЫЕ ПОЗИЦИИ") + FEED
    out += _enc("-" * width) + FEED

    out += ALIGN_LEFT
    out += _line("Смена", shift.date.strftime("%d.%m.%Y"), width)
    out += _enc("-" * width) + FEED

    if not deletions:
        out += ALIGN_CENTER + _enc("Удалений за смену нет") + FEED
    else:
        total_sum = 0
        for d in deletions:
            time_str = timezone.localtime(d.deleted_at).strftime("%H:%M")
            who = (d.deleted_by.get_full_name() or d.deleted_by.username) if d.deleted_by else "—"
            label = d.menu_item_name
            if d.menu_item_volume:
                label += f" {d.menu_item_volume}"
            subtotal = int(d.unit_price * d.quantity)
            total_sum += subtotal
            status_str = STATUS_RU.get(d.kitchen_status, d.kitchen_status)
            out += _enc(f"{time_str}  {who}  (стол {d.table_number or '—'})") + FEED
            out += _enc(f"  {label[:width - 2]}") + FEED
            out += _line(f"  x{d.quantity}  {status_str}", _money(subtotal) + " руб", width)

        out += _enc("-" * width) + FEED
        out += _line(f"Удалений: {len(deletions)} поз.", "", width)
        out += BOLD_ON
        out += _line("На сумму", _money(total_sum) + " руб", width)
        out += BOLD_OFF

    out += FEED * 3 + CUT
    return bytes(out)


def print_shift_reports(shift) -> None:
    from apps.printers.models import PrintJob

    printer = get_default_printer()
    if printer is None:
        return

    for render_fn in (render_shift_sales_report, render_shift_deletions_report):
        payload = render_fn(shift, width=printer.width)
        job = PrintJob.objects.create(printer=printer, kind='report', payload=payload)
        dispatch(job)
