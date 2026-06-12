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
"""
import base64
import configparser
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

    sys.exit(f'Неизвестный mode={mode!r}. Допустимо: windows, serial, usb, raw.')


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
    # лог в UTF-8: иначе русские тексты ошибок превращаются в «������»
    # в консоли Windows и в окне конфигуратора
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding='utf-8', errors='replace')
        except (AttributeError, OSError):
            pass

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
