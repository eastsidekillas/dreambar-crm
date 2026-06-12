#!/usr/bin/env python3
"""DreamBar — агент печати для принтера на кассовом ПК.

Зачем нужен: когда принтер (АТОЛ RP-326-USE) подключён к кассовому ПК, а backend
крутится на сервере, сервер не «видит» принтер напрямую. Агент запускается на ПК
с принтером, опрашивает backend, забирает задания печати своего принтера и пишет
готовый ESC/POS-пакет прямо в устройство.

Для Ethernet-принтера агент НЕ нужен — backend печатает сам.

Настройки читаются из `config.ini` рядом с программой (или .exe); любой параметр
можно переопределить переменной окружения с тем же именем в ВЕРХНЕМ регистре.

Способ печати (mode):
    windows — печать через установленный драйвер Windows-принтера (RAW), по имени
              `windows_printer`. Самый простой для Windows: ставится драйвер АТОЛ,
              принтер виден в системе — libusb/Zadig не нужны. (нужен pywin32)
    serial  — последовательный порт (USE поддерживает RS-232): `serial_port`,
              `serial_baud`. (нужен pyserial)
    usb     — прямой USB через libusb: `usb_vendor`/`usb_product` (нужен Zadig +
              pyusb + python-escpos)
    raw     — просто писать байты в файл/устройство: `raw_path`
              (Linux: /dev/usb/lp0)
    atol    — ККТ АТОЛ (20Ф, 22Ф, 30Ф...) через Драйвер ККТ 10 (ДТО 10).
              ESC/POS ККТ не понимает, поэтому в админке у принтера должен быть
              выбран тип «АТОЛ ККТ через локальный агент» — backend тогда шлёт
              JSON-операции, а агент печатает их нефискальным документом через
              libfptr10. Параметры: `atol_com_file` (пусто = USB-автопоиск),
              `atol_baud`, `atol_library` (путь к fptr10.dll, пусто = стандартный).
"""
import base64
import configparser
import json
import os
import signal
import sys
import time
from datetime import datetime

import requests

_running = True


def _base_dir():
    """Каталог рядом с программой: для .exe — папка exe, иначе — папка скрипта."""
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))


def load_config():
    """config.ini (секция [agent]) + переопределение переменными окружения."""
    cfg = configparser.ConfigParser()
    cfg.read(os.path.join(_base_dir(), 'config.ini'), encoding='utf-8')
    section = cfg['agent'] if cfg.has_section('agent') else {}

    def get(key, default=''):
        return os.environ.get(key.upper(), section.get(key, default))

    return {
        'backend_url':     get('backend_url', 'http://localhost:8000/api').rstrip('/'),
        'printer_id':      get('printer_id'),
        'agent_key':       get('agent_key'),
        'poll_seconds':    float(get('poll_seconds', '2') or '2'),
        'mode':            get('mode', 'windows').lower(),
        'windows_printer': get('windows_printer'),
        'serial_port':     get('serial_port'),
        'serial_baud':     int(get('serial_baud', '115200') or '115200'),
        'usb_vendor':      get('usb_vendor'),
        'usb_product':     get('usb_product'),
        'raw_path':        get('raw_path'),
        'atol_com_file':   get('atol_com_file'),
        'atol_baud':       int(get('atol_baud', '115200') or '115200'),
        'atol_library':    get('atol_library'),
    }


def _log(msg):
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {msg}", flush=True)


def make_writer(c):
    """Вернуть функцию write(data: bytes) по выбранному режиму печати."""
    mode = c['mode']

    if mode == 'windows':
        import win32print  # pywin32
        name = c['windows_printer'] or win32print.GetDefaultPrinter()

        def write_windows(data):
            h = win32print.OpenPrinter(name)
            try:
                win32print.StartDocPrinter(h, 1, ('DreamBar чек', None, 'RAW'))
                win32print.StartPagePrinter(h)
                win32print.WritePrinter(h, data)
                win32print.EndPagePrinter(h)
                win32print.EndDocPrinter(h)
            finally:
                win32print.ClosePrinter(h)
        return write_windows

    if mode == 'serial':
        import serial  # pyserial

        def write_serial(data):
            with serial.Serial(c['serial_port'], c['serial_baud'], timeout=5) as s:
                s.write(data)
        return write_serial

    if mode == 'usb':
        from escpos.printer import Usb
        vendor = c['usb_vendor']
        product = c['usb_product']
        if not vendor or not product:
            sys.exit('Для mode=usb нужны usb_vendor и usb_product в config.ini.')
        vid = int(vendor, 16)
        pid = int(product, 16)

        def write_usb(data):
            p = Usb(vid, pid)
            p._raw(data)
            p.close()
        return write_usb

    if mode == 'raw':
        if not c['raw_path']:
            sys.exit('Для mode=raw нужен raw_path в config.ini.')

        def write_raw(data):
            with open(c['raw_path'], 'wb') as f:
                f.write(data)
        return write_raw

    if mode == 'atol':
        return _make_atol_writer(c)

    sys.exit(f'Неизвестный mode={mode!r}. Допустимо: windows, serial, usb, raw, atol.')


def _make_atol_writer(c):
    """ККТ АТОЛ через ДТО 10 (libfptr10). Payload — JSON с операциями
    (формат atol-ops/1 из backend), печатается нефискальным документом."""
    # Обёртку libfptr10.py инсталлятор ДТО НЕ ставит — её кладут рядом с агентом
    # (берётся из дистрибутива драйвера). Ищем рядом с агентом и в каталоге
    # из atol_library; работает и из собранного .exe.
    for d in [_base_dir(),
              c['atol_library'] and (c['atol_library'] if os.path.isdir(c['atol_library'])
                                     else os.path.dirname(c['atol_library']))]:
        if d and d not in sys.path:
            sys.path.insert(0, d)
    try:
        from libfptr10 import IFptr
    except ImportError:
        sys.exit(
            'Не найден модуль libfptr10 (Python-обёртка Драйвера ККТ 10).\n'
            'Инсталлятор ДТО его НЕ устанавливает. Скачайте дистрибутив драйвера:\n'
            '  fs.atol.ru -> «Программное обеспечение» -> ДТО -> 10.x\n'
            'возьмите из него файл wrappers/python/libfptr10.py и положите рядом '
            f'с агентом, в папку:\n  {_base_dir()}\n'
            'Сам «Драйвер ККТ 10» тоже должен быть установлен (он даёт fptr10.dll).'
        )

    try:
        fptr = IFptr(c['atol_library'] or '')
    except Exception as exc:
        sys.exit(
            f'libfptr10 найден, но не удалось загрузить библиотеку драйвера (fptr10.dll): {exc}\n'
            'Проверьте: 1) установлен ли «Драйвер ККТ 10»; 2) совпадает ли разрядность '
            'Python/агента и драйвера (x86 загружает только x86, x64 — только x64).\n'
            'Можно указать путь к fptr10.dll явно: config.ini -> atol_library '
            r'(обычно C:\Program Files (x86)\ATOL\Drivers10\KKT\bin\fptr10.dll).'
        )

    settings = {IFptr.LIBFPTR_SETTING_MODEL: IFptr.LIBFPTR_MODEL_ATOL_AUTO}
    if c['atol_com_file']:
        settings[IFptr.LIBFPTR_SETTING_PORT]     = IFptr.LIBFPTR_PORT_COM
        settings[IFptr.LIBFPTR_SETTING_COM_FILE] = c['atol_com_file']
        settings[IFptr.LIBFPTR_SETTING_BAUDRATE] = c['atol_baud']
    else:
        settings[IFptr.LIBFPTR_SETTING_PORT] = IFptr.LIBFPTR_PORT_USB
    fptr.setSettings(settings)

    align_map = {'left':   IFptr.LIBFPTR_ALIGNMENT_LEFT,
                 'center': IFptr.LIBFPTR_ALIGNMENT_CENTER,
                 'right':  IFptr.LIBFPTR_ALIGNMENT_RIGHT}

    def check(result, action):
        if result != 0:
            raise RuntimeError(f'{action}: [{fptr.errorCode()}] {fptr.errorDescription()}')

    def print_text(text='', align='left', double=False):
        fptr.setParam(IFptr.LIBFPTR_PARAM_TEXT, text)
        fptr.setParam(IFptr.LIBFPTR_PARAM_ALIGNMENT,
                      align_map.get(align, IFptr.LIBFPTR_ALIGNMENT_LEFT))
        if double:
            fptr.setParam(IFptr.LIBFPTR_PARAM_FONT_DOUBLE_WIDTH, True)
            fptr.setParam(IFptr.LIBFPTR_PARAM_FONT_DOUBLE_HEIGHT, True)
        check(fptr.printText(), 'printText')

    def end_document():
        fptr.setParam(IFptr.LIBFPTR_PARAM_PRINT_FOOTER, False)
        check(fptr.endNonfiscalDocument(), 'endNonfiscalDocument')

    def write_atol(data):
        ops = json.loads(data.decode('utf-8')).get('ops', [])
        if not fptr.isOpened():
            check(fptr.open(), 'open')
        in_doc = False
        try:
            for op in ops:
                kind = op.get('op')
                if kind == 'drawer':
                    fptr.openDrawer()  # вне документа; ящик подключается к ККТ
                    continue
                if kind == 'cut':
                    if in_doc:
                        end_document()
                        in_doc = False
                    continue
                if not in_doc:
                    check(fptr.beginNonfiscalDocument(), 'beginNonfiscalDocument')
                    in_doc = True
                if kind == 'text':
                    # bold ДТО в printText не поддерживает — игнорируем флаг
                    print_text(op.get('text', ''), op.get('align', 'left'),
                               op.get('double', False))
                elif kind == 'feed':
                    for _ in range(int(op.get('n', 1))):
                        print_text('')
                elif kind == 'qr':
                    fptr.setParam(IFptr.LIBFPTR_PARAM_BARCODE, op.get('data', ''))
                    fptr.setParam(IFptr.LIBFPTR_PARAM_BARCODE_TYPE, IFptr.LIBFPTR_BT_QR)
                    fptr.setParam(IFptr.LIBFPTR_PARAM_ALIGNMENT,
                                  IFptr.LIBFPTR_ALIGNMENT_CENTER)
                    fptr.setParam(IFptr.LIBFPTR_PARAM_SCALE, 5)
                    check(fptr.printBarcode(), 'printBarcode')
            if in_doc:
                end_document()
        except Exception:
            # сбросить соединение, чтобы следующее задание началось чисто
            fptr.close()
            raise
    return write_atol


def ack(c, job_id, ok, error=''):
    """Подтвердить задание. До 3 попыток: потерянный ack означает, что сервер
    через 5 минут вернёт задание в очередь и чек напечатается второй раз."""
    url = f"{c['backend_url']}/print/agent/jobs/{job_id}/ack/"
    for attempt in range(3):
        try:
            requests.post(url, headers={'X-Agent-Key': c['agent_key']},
                          json={'printer': c['printer_id'], 'ok': ok, 'error': error},
                          timeout=10)
            return True
        except requests.RequestException as exc:
            _log(f'[ack-fail] job {job_id} (попытка {attempt + 1}/3): {exc}')
            time.sleep(2)
    return False


# id уже напечатанных заданий → время печати. Если ack так и не дошёл и сервер
# выдал задание повторно — не печатаем дубль, а заново подтверждаем.
_printed = {}
_PRINTED_TTL = 3600


def _remember_printed(job_id):
    now = time.monotonic()
    _printed[job_id] = now
    for jid, ts in list(_printed.items()):
        if now - ts > _PRINTED_TTL:
            del _printed[jid]


def poll_once(c, write):
    resp = requests.get(f"{c['backend_url']}/print/agent/jobs/",
                        headers={'X-Agent-Key': c['agent_key']},
                        params={'printer': c['printer_id']}, timeout=10)
    if resp.status_code == 403:
        sys.exit('403: неверный agent_key/printer_id или принтер не в режиме «agent».')
    resp.raise_for_status()
    for job in resp.json():
        if job['id'] in _printed:
            _log(f"[dup] job {job['id']} уже напечатан, повторяю подтверждение")
            ack(c, job['id'], True)
            continue
        data = base64.b64decode(job['payload_b64'])
        try:
            write(data)
            _remember_printed(job['id'])
            ack(c, job['id'], True)
            _log(f"[ok] job {job['id']} ({len(data)} bytes)")
        except Exception as exc:
            ack(c, job['id'], False, f'{type(exc).__name__}: {exc}')
            _log(f"[print-fail] job {job['id']}: {exc}")


def _handle_signal(sig, frame):
    global _running
    _log('Получен сигнал остановки...')
    _running = False


def main():
    signal.signal(signal.SIGTERM, _handle_signal)
    signal.signal(signal.SIGINT, _handle_signal)

    c = load_config()
    if not c['printer_id'] or not c['agent_key']:
        sys.exit('В config.ini нужны printer_id и agent_key.')
    write = make_writer(c)
    _log(f"Агент запущен. backend={c['backend_url']} printer={c['printer_id']} "
         f"mode={c['mode']} poll={c['poll_seconds']}s")
    while _running:
        try:
            poll_once(c, write)
        except requests.RequestException as exc:
            _log(f'[net] {exc}')
        # Interruptible sleep: wake up every second to check _running flag
        for _ in range(max(1, int(c['poll_seconds']))):
            if not _running:
                break
            time.sleep(1)
    _log('Агент остановлен.')


if __name__ == '__main__':
    main()
