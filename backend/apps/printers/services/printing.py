"""Печать чеков: термопринтеры ESC/POS (АТОЛ RP-326-USE и совместимые)
и ККТ АТОЛ (20Ф и т.п.) через локальный агент с Драйвером ККТ 10.

Документ сначала собирается в промежуточное представление (список операций
`Doc.ops`), затем кодируется под конкретный принтер:

* `network`    — ESC/POS, Ethernet, сырой сокет на порт 9100.
* `agent`      — ESC/POS, USB через локальный агент (очередь PrintJob).
* `agent_atol` — JSON-операции для ККТ АТОЛ; агент исполняет их через
                 libfptr10 (нефискальный документ). ESC/POS ККТ не понимает.

Кириллица (ESC/POS): CP866, страница задаётся настройкой PRINTER_CODEPAGE_PAGE.
"""
from __future__ import annotations

import json
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


# ── Промежуточное представление документа ────────────────────────────────────

class Doc:
    """Чек как список простых операций — единый источник раскладки.

    Операции:
        {'op': 'text', 'text', 'align': left|center|right, 'bold', 'double'}
        {'op': 'qr', 'data'}
        {'op': 'feed', 'n'}
        {'op': 'cut'}
        {'op': 'drawer'}
    """

    def __init__(self, width: int):
        self.width = width
        self.ops: list[dict] = []

    def text(self, s: str = '', align: str = 'left',
             bold: bool = False, double: bool = False):
        self.ops.append({'op': 'text', 'text': s, 'align': align,
                         'bold': bold, 'double': double})

    def line(self, left: str, right: str, bold: bool = False, double: bool = False):
        """Две колонки: left слева, right прижато к правому краю."""
        # двойная ширина шрифта — в строку влезает вдвое меньше символов
        width = self.width // 2 if double else self.width
        right = right or ""
        space = width - len(right)
        left  = left[:max(0, space - 1)]
        pad   = width - len(left) - len(right)
        self.text(left + " " * max(1, pad) + right, bold=bold, double=double)

    def hr(self):
        self.text("-" * self.width)

    def qr(self, data: str):
        self.ops.append({'op': 'qr', 'data': data})

    def feed(self, n: int = 1):
        self.ops.append({'op': 'feed', 'n': n})

    def cut(self):
        self.ops.append({'op': 'cut'})

    def drawer(self):
        self.ops.append({'op': 'drawer'})


# ── Кодировщик ESC/POS ───────────────────────────────────────────────────────

def _codepage_select() -> bytes:
    page = getattr(settings, "PRINTER_CODEPAGE_PAGE", 17)
    if page is None:
        return b""
    return ESC + b"t" + bytes([int(page)])


def _enc(text: str) -> bytes:
    return text.encode(CODEPAGE, errors="replace")


def _qr_escpos(data: str, module_size: int = 6) -> bytes:
    """QR-код командами GS ( k (ESC/POS, модель 2). Печатается по центру."""
    payload = data.encode("utf-8")
    out = bytearray()
    # модель 2
    out += GS + b"(k\x04\x00\x31\x41\x32\x00"
    # размер модуля (1..16)
    out += GS + b"(k\x03\x00\x31\x43" + bytes([max(1, min(16, module_size))])
    # коррекция ошибок M
    out += GS + b"(k\x03\x00\x31\x45\x31"
    # данные: длина = len + 3
    n = len(payload) + 3
    out += GS + b"(k" + bytes([n & 0xFF, (n >> 8) & 0xFF]) + b"\x31\x50\x30" + payload
    # печать
    out += GS + b"(k\x03\x00\x31\x51\x30"
    return bytes(out)


_ESCPOS_ALIGN = {'left': ALIGN_LEFT, 'center': ALIGN_CENTER, 'right': ALIGN_RIGHT}


def encode_escpos(doc: Doc) -> bytes:
    out = bytearray()
    out += INIT + _codepage_select()
    align = 'left'
    for op in doc.ops:
        kind = op['op']
        if kind == 'text':
            if op['align'] != align:
                align = op['align']
                out += _ESCPOS_ALIGN[align]
            if op['bold']:
                out += BOLD_ON
            if op['double']:
                out += DOUBLE_ON
            out += _enc(op['text']) + FEED
            if op['double']:
                out += DOUBLE_OFF
            if op['bold']:
                out += BOLD_OFF
        elif kind == 'qr':
            if align != 'center':
                align = 'center'
                out += ALIGN_CENTER
            out += _qr_escpos(op['data'])
        elif kind == 'feed':
            out += FEED * op.get('n', 1)
        elif kind == 'cut':
            out += CUT
        elif kind == 'drawer':
            out += CASH_DRAWER
    return bytes(out)


# ── Кодировщик для ККТ АТОЛ (исполняется агентом через libfptr10) ────────────

def encode_atol(doc: Doc) -> bytes:
    payload = {'format': 'atol-ops/1', 'width': doc.width, 'ops': doc.ops}
    return json.dumps(payload, ensure_ascii=False).encode('utf-8')


def encode_for_printer(printer, doc: Doc) -> bytes:
    if printer.connection == 'agent_atol':
        return encode_atol(doc)
    return encode_escpos(doc)


# ── Рендеры документов ───────────────────────────────────────────────────────

def _money(value) -> str:
    n = int(Decimal(str(value)).quantize(Decimal("1")))
    return f"{n:,}".replace(",", " ")


def _receipt_into(doc: Doc, receipt, copy_label: str = "") -> None:
    from django.utils import timezone
    from apps.printers.models import ReceiptSettings

    rs = ReceiptSettings.get()
    doc.text(rs.title, align='center', bold=True, double=True)
    if rs.subtitle:
        doc.text(rs.subtitle, align='center')
    doc.text("-" * doc.width, align='center')

    issued = timezone.localtime(receipt.issued_at).strftime("%d.%m.%Y %H:%M")
    doc.line("Чек №", receipt.code)
    doc.line("Стол", receipt.table_number or "—")
    waiter = ""
    if receipt.waiter_id:
        waiter = receipt.waiter.get_full_name() or receipt.waiter.username
    doc.line("Официант", waiter or "—")
    doc.line("Дата", issued)
    doc.hr()

    for it in receipt.items.all():
        name   = it.menu_item.name
        volume = it.menu_item.volume or ""
        label  = f"{name} ({volume})" if volume else name
        doc.text(label[:doc.width])
        qty = f"{it.quantity} x {_money(it.unit_price)}"
        doc.line("  " + qty, _money(it.subtotal))
    doc.hr()

    doc.line("ИТОГО", _money(receipt.total) + " руб", bold=True, double=True)
    doc.line("Оплата", receipt.get_payment_method_display())
    doc.hr()
    if rs.footer:
        doc.text(rs.footer, align='center')
    if rs.qr_data and not copy_label:
        # QR только на гостевой копии — на копии «для сверки» он не нужен
        doc.feed()
        doc.qr(rs.qr_data)
        doc.feed()
        if rs.qr_label:
            doc.text(rs.qr_label, align='center')
    if copy_label:
        doc.feed()
        doc.text(copy_label, align='center', bold=True)
    doc.feed(3)
    doc.cut()


def render_receipt(receipt, width: int = 48, copy_label: str = "") -> Doc:
    doc = Doc(width)
    _receipt_into(doc, receipt, copy_label)
    return doc


def render_receipt_two_copies(receipt, width: int = 48) -> Doc:
    from apps.printers.models import ReceiptSettings

    doc = Doc(width)
    _receipt_into(doc, receipt, "")
    if ReceiptSettings.get().print_second_copy:
        _receipt_into(doc, receipt, "--- ДЛЯ СВЕРКИ ---")
    return doc


def send_network(host: str, port: int, payload: bytes, timeout: float = 2.0) -> None:
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(payload)


def get_default_printer():
    from apps.printers.models import Printer
    return (Printer.objects.filter(is_active=True, is_default=True).first()
            or Printer.objects.filter(is_active=True).first())


# роль сотрудника → назначение принтера (Printer.station)
_ROLE_STATION = {
    'bartender': 'bar',
    'waiter':    'waiter',
    'wardrobe':  'waiter',
}


def get_printer_for_user(user):
    """Принтер по роли печатающего: бармен → «Бар», официант → «Официанты».
    Нет подходящего — принтер по умолчанию."""
    from apps.printers.models import Printer

    profile = getattr(user, 'profile', None)
    station = _ROLE_STATION.get(profile.role) if profile else None
    if station:
        printer = Printer.objects.filter(is_active=True, station=station).first()
        if printer:
            return printer
    return get_default_printer()


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


def build_test_page(printer) -> Doc:
    from django.utils import timezone
    doc = Doc(printer.width)
    doc.text("ТЕСТ ПРИНТЕРА", align='center', bold=True, double=True)
    doc.text("-" * doc.width, align='center')
    doc.line("Принтер", printer.name)
    doc.line("Подключение", printer.get_connection_display())
    if printer.connection == 'network':
        doc.line("Адрес", f"{printer.host}:{printer.port}")
    doc.line("Ширина", f"{doc.width} симв.")
    doc.line("Время", timezone.localtime().strftime("%d.%m.%Y %H:%M:%S"))
    doc.hr()
    doc.text("Принтер работает!", align='center')
    doc.feed(3)
    doc.cut()
    return doc


def send_to_printer(printer, doc: Doc) -> None:
    """Сетевой принтер — печать сразу; агентский — задание в очередь
    (напечатается, когда агент его заберёт)."""
    payload = encode_for_printer(printer, doc)
    if printer.connection == 'network':
        send_network(printer.host, printer.port, payload)
    else:
        from apps.printers.models import PrintJob
        PrintJob.objects.create(printer=printer, kind='report', payload=payload)


def print_receipt(receipt, printer=None):
    from apps.printers.models import PrintJob

    printer = printer or get_default_printer()
    if printer is None:
        raise RuntimeError('Не настроен ни один активный принтер.')

    doc = render_receipt_two_copies(receipt, width=printer.width)
    if receipt.payment_method == 'cash':
        doc.ops.insert(0, {'op': 'drawer'})
    job = PrintJob.objects.create(
        printer=printer, kind='receipt', receipt=receipt,
        payload=encode_for_printer(printer, doc),
    )
    dispatch(job)
    return job


def render_shift_sales_report(shift, width: int = 48) -> Doc:
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

    doc = Doc(width)
    doc.text("БАР ДРИМ", align='center', bold=True, double=True)
    doc.text("ИТОГИ СМЕНЫ", align='center')
    doc.text("-" * width, align='center')

    doc.line("Дата", shift.date.strftime("%d.%m.%Y"))
    if shift.opened_by_id:
        name = shift.opened_by.get_full_name() or shift.opened_by.username
        doc.line("Открыл", name)
    if shift.closed_at:
        doc.line("Закрыта", timezone.localtime(shift.closed_at).strftime("%H:%M"))
    doc.hr()

    doc.text("ПРОДАЖИ ПО РАЗДЕЛАМ", bold=True)
    for cat, label in (('bar', 'Бар'), ('kitchen', 'Кухня'), ('hookah', 'Кальян')):
        val = cat_totals.get(cat, 0)
        if val:
            doc.line(f"  {label}", _money(val) + " руб")
    if ticket_total:
        doc.line("  Вход / билеты", _money(ticket_total) + " руб")
    doc.hr()

    doc.text("ПО ТИПУ ОПЛАТЫ", bold=True)
    for method, label in (
        ('cash', 'Наличные'), ('card', 'Карта'),
        ('transfer', 'Перевод'), ('mixed', 'Смешанный'),
    ):
        val = pay_totals.get(method, 0)
        if val:
            doc.line(f"  {label}", _money(val) + " руб")
    doc.hr()

    doc.line("ИТОГО", _money(grand_total) + " руб", bold=True, double=True)
    doc.hr()
    doc.line("Заказов",  str(orders_count))
    doc.line("Чеков",    str(receipts_count))
    if ticket_count:
        doc.line("Билетов", str(ticket_count))

    doc.feed(3)
    doc.cut()
    return doc


def render_shift_deletions_report(shift, width: int = 48) -> Doc:
    from django.utils import timezone
    from apps.audit.models import DeletedOrderItem

    deletions = list(
        DeletedOrderItem.objects
        .filter(shift=shift)
        .select_related('deleted_by')
        .order_by('deleted_at')
    )

    STATUS_RU = {'new': 'не начат', 'cooking': 'готовился', 'ready': 'был готов'}

    doc = Doc(width)
    doc.text("БАР ДРИМ", align='center', bold=True, double=True)
    doc.text("УДАЛЁННЫЕ ПОЗИЦИИ", align='center')
    doc.text("-" * width, align='center')

    doc.line("Смена", shift.date.strftime("%d.%m.%Y"))
    doc.hr()

    if not deletions:
        doc.text("Удалений за смену нет", align='center')
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
            doc.text(f"{time_str}  {who}  (стол {d.table_number or '—'})")
            doc.text(f"  {label[:width - 2]}")
            doc.line(f"  x{d.quantity}  {status_str}", _money(subtotal) + " руб")

        doc.hr()
        doc.line(f"Удалений: {len(deletions)} поз.", "")
        doc.line("На сумму", _money(total_sum) + " руб", bold=True)

    doc.feed(3)
    doc.cut()
    return doc


def print_shift_reports(shift) -> None:
    from apps.printers.models import PrintJob

    printer = get_default_printer()
    if printer is None:
        return

    for render_fn in (render_shift_sales_report, render_shift_deletions_report):
        doc = render_fn(shift, width=printer.width)
        job = PrintJob.objects.create(
            printer=printer, kind='report', payload=encode_for_printer(printer, doc),
        )
        dispatch(job)