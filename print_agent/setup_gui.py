#!/usr/bin/env python3
"""Простой графический конфигуратор агента DreamBar.

Запуск: python setup_gui.py  (или двойной клик по setup_gui.exe)
Редактирует config.ini рядом с программой и позволяет запустить/остановить агент.
"""
import configparser
import os
import subprocess
import sys
import threading
import tkinter as tk
from tkinter import font as tkfont
from tkinter import messagebox, ttk

# ── пути ────────────────────────────────────────────────────────────────────

def _base_dir():
    if getattr(sys, 'frozen', False):
        return os.path.dirname(sys.executable)
    return os.path.dirname(os.path.abspath(__file__))

BASE     = _base_dir()
CFG_PATH = os.path.join(BASE, 'config.ini')
AGENT    = os.path.join(BASE, 'dreambar-print-agent.exe' if sys.platform == 'win32' else 'agent.py')

# ── конфиг ───────────────────────────────────────────────────────────────────

DEFAULTS = {
    'backend_url':     'http://192.168.1.10:8000/api',
    'printer_id':      '',
    'agent_key':       '',
    'poll_seconds':    '2',
    'mode':            'windows',
    'windows_printer': '',
    'serial_port':     '',
    'serial_baud':     '115200',
    'usb_vendor':      '',
    'usb_product':     '',
    'raw_path':        '',
    'atol_com_file':   '',
    'atol_baud':       '115200',
    'atol_library':    '',
}


def read_config() -> dict:
    cfg = configparser.ConfigParser()
    cfg.read(CFG_PATH, encoding='utf-8')
    section = cfg['agent'] if cfg.has_section('agent') else {}
    return {k: section.get(k, v) for k, v in DEFAULTS.items()}


def write_config(values: dict):
    cfg = configparser.ConfigParser()
    cfg['agent'] = values
    with open(CFG_PATH, 'w', encoding='utf-8') as f:
        cfg.write(f)


# ── GUI ──────────────────────────────────────────────────────────────────────

class App(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('DreamBar Print Agent — Настройка')
        self.resizable(False, False)
        self._agent_proc: subprocess.Popen | None = None
        self._build_ui()
        self._load()
        self._refresh_status()

    # ── построение интерфейса ────────────────────────────────────────────────

    def _build_ui(self):
        PAD = dict(padx=12, pady=6)

        # ── Соединение с backend ─────────────────────────────────────────────
        frm_conn = ttk.LabelFrame(self, text='Backend', padding=8)
        frm_conn.grid(row=0, column=0, columnspan=2, sticky='ew', **PAD)

        ttk.Label(frm_conn, text='URL backend:').grid(row=0, column=0, sticky='w')
        self.v_url = tk.StringVar()
        ttk.Entry(frm_conn, textvariable=self.v_url, width=42).grid(row=0, column=1, sticky='ew', padx=(6, 0))

        ttk.Label(frm_conn, text='ID принтера:').grid(row=1, column=0, sticky='w', pady=(4, 0))
        self.v_pid = tk.StringVar()
        ttk.Entry(frm_conn, textvariable=self.v_pid, width=10).grid(row=1, column=1, sticky='w', padx=(6, 0), pady=(4, 0))

        ttk.Label(frm_conn, text='Ключ агента:').grid(row=2, column=0, sticky='w', pady=(4, 0))
        self.v_key = tk.StringVar()
        ttk.Entry(frm_conn, textvariable=self.v_key, width=42, show='*').grid(row=2, column=1, sticky='ew', padx=(6, 0), pady=(4, 0))

        ttk.Label(frm_conn, text='Опрос (сек):').grid(row=3, column=0, sticky='w', pady=(4, 0))
        self.v_poll = tk.StringVar()
        ttk.Entry(frm_conn, textvariable=self.v_poll, width=6).grid(row=3, column=1, sticky='w', padx=(6, 0), pady=(4, 0))

        frm_conn.columnconfigure(1, weight=1)

        # ── Режим печати ─────────────────────────────────────────────────────
        frm_mode = ttk.LabelFrame(self, text='Режим печати', padding=8)
        frm_mode.grid(row=1, column=0, columnspan=2, sticky='ew', **PAD)

        self.v_mode = tk.StringVar(value='windows')
        modes = [('Windows-принтер (рекомендуется)', 'windows'),
                 ('COM-порт (serial)',               'serial'),
                 ('USB libusb',                      'usb'),
                 ('Файл/устройство (raw)',            'raw'),
                 ('АТОЛ ККТ — Драйвер ККТ 10',        'atol')]
        for i, (label, val) in enumerate(modes):
            rb = ttk.Radiobutton(frm_mode, text=label, variable=self.v_mode,
                                 value=val, command=self._on_mode_change)
            rb.grid(row=i, column=0, sticky='w')

        # ── Параметры режима ─────────────────────────────────────────────────
        self.frm_params = ttk.Frame(self, padding=(12, 0, 12, 4))
        self.frm_params.grid(row=2, column=0, columnspan=2, sticky='ew')

        self.v_win_printer  = tk.StringVar()
        self.v_serial_port  = tk.StringVar()
        self.v_serial_baud  = tk.StringVar()
        self.v_usb_vendor   = tk.StringVar()
        self.v_usb_product  = tk.StringVar()
        self.v_raw_path     = tk.StringVar()
        self.v_atol_com     = tk.StringVar()
        self.v_atol_baud    = tk.StringVar()
        self.v_atol_lib     = tk.StringVar()

        self._mode_rows: dict[str, list[tk.Widget]] = {}

        def row(label, var, mode_keys, width=30, hint=''):
            r = self.frm_params.grid_size()[1]
            lbl = ttk.Label(self.frm_params, text=label)
            lbl.grid(row=r, column=0, sticky='w', pady=2)
            ent = ttk.Entry(self.frm_params, textvariable=var, width=width)
            ent.grid(row=r, column=1, sticky='ew', padx=(6, 0), pady=2)
            widgets = [lbl, ent]
            if hint:
                h = ttk.Label(self.frm_params, text=hint, foreground='gray')
                h.grid(row=r, column=2, sticky='w', padx=(4, 0))
                widgets.append(h)
            for k in mode_keys:
                self._mode_rows.setdefault(k, []).extend(widgets)

        row('Принтер Windows:', self.v_win_printer, ['windows'],
            hint='Имя как в «Устройства и принтеры»; пусто — по умолчанию')
        row('COM-порт:', self.v_serial_port, ['serial'], width=10, hint='напр. COM3 или /dev/ttyUSB0')
        row('Скорость (baud):', self.v_serial_baud, ['serial'], width=10)
        row('USB Vendor ID:', self.v_usb_vendor, ['usb'], width=10, hint='напр. 0x2912')
        row('USB Product ID:', self.v_usb_product, ['usb'], width=10)
        row('Путь устройства:', self.v_raw_path, ['raw'], hint='напр. /dev/usb/lp0')
        row('COM-порт ККТ:', self.v_atol_com, ['atol'], width=10,
            hint='пусто — поиск по USB (рекомендуется)')
        row('Скорость ККТ (baud):', self.v_atol_baud, ['atol'], width=10)
        row('Путь к fptr10.dll:', self.v_atol_lib, ['atol'],
            hint='пусто — стандартное расположение ДТО 10')

        self.frm_params.columnconfigure(1, weight=1)
        self._on_mode_change()

        # ── Кнопки сохранения / запуска ──────────────────────────────────────
        frm_btns = ttk.Frame(self, padding=(12, 4, 12, 8))
        frm_btns.grid(row=3, column=0, columnspan=2, sticky='ew')

        self.btn_save = ttk.Button(frm_btns, text='💾 Сохранить config.ini', command=self._save)
        self.btn_save.pack(side='left')

        self.btn_start = ttk.Button(frm_btns, text='▶ Запустить агента', command=self._start_agent)
        self.btn_start.pack(side='left', padx=(8, 0))

        self.btn_stop = ttk.Button(frm_btns, text='⏹ Остановить', command=self._stop_agent, state='disabled')
        self.btn_stop.pack(side='left', padx=(4, 0))

        self.lbl_status = ttk.Label(frm_btns, text='● Не запущен', foreground='gray')
        self.lbl_status.pack(side='left', padx=(12, 0))

        # ── Лог ──────────────────────────────────────────────────────────────
        frm_log = ttk.LabelFrame(self, text='Лог агента', padding=6)
        frm_log.grid(row=4, column=0, columnspan=2, sticky='ew', padx=12, pady=(0, 10))

        self.log_box = tk.Text(frm_log, height=10, width=62, state='disabled',
                               font=('Courier New', 9), bg='#1e1e1e', fg='#d4d4d4',
                               insertbackground='white')
        sb = ttk.Scrollbar(frm_log, command=self.log_box.yview)
        self.log_box.configure(yscrollcommand=sb.set)
        self.log_box.pack(side='left', fill='both', expand=True)
        sb.pack(side='right', fill='y')

        self.columnconfigure(0, weight=1)

    # ── переключение полей по режиму ─────────────────────────────────────────

    def _on_mode_change(self):
        current = self.v_mode.get()
        all_widgets = {w for wlist in self._mode_rows.values() for w in wlist}
        visible = set(self._mode_rows.get(current, []))
        for w in all_widgets:
            if w in visible:
                w.grid()
            else:
                w.grid_remove()

    # ── загрузка / сохранение ────────────────────────────────────────────────

    def _load(self):
        c = read_config()
        self.v_url.set(c['backend_url'])
        self.v_pid.set(c['printer_id'])
        self.v_key.set(c['agent_key'])
        self.v_poll.set(c['poll_seconds'])
        self.v_mode.set(c['mode'])
        self.v_win_printer.set(c['windows_printer'])
        self.v_serial_port.set(c['serial_port'])
        self.v_serial_baud.set(c['serial_baud'])
        self.v_usb_vendor.set(c['usb_vendor'])
        self.v_usb_product.set(c['usb_product'])
        self.v_raw_path.set(c['raw_path'])
        self.v_atol_com.set(c['atol_com_file'])
        self.v_atol_baud.set(c['atol_baud'])
        self.v_atol_lib.set(c['atol_library'])
        self._on_mode_change()

    def _save(self):
        values = {
            'backend_url':     self.v_url.get().strip().rstrip('/'),
            'printer_id':      self.v_pid.get().strip(),
            'agent_key':       self.v_key.get().strip(),
            'poll_seconds':    self.v_poll.get().strip() or '2',
            'mode':            self.v_mode.get(),
            'windows_printer': self.v_win_printer.get().strip(),
            'serial_port':     self.v_serial_port.get().strip(),
            'serial_baud':     self.v_serial_baud.get().strip() or '115200',
            'usb_vendor':      self.v_usb_vendor.get().strip(),
            'usb_product':     self.v_usb_product.get().strip(),
            'raw_path':        self.v_raw_path.get().strip(),
            'atol_com_file':   self.v_atol_com.get().strip(),
            'atol_baud':       self.v_atol_baud.get().strip() or '115200',
            'atol_library':    self.v_atol_lib.get().strip(),
        }
        write_config(values)
        messagebox.showinfo('Сохранено', f'config.ini сохранён:\n{CFG_PATH}')

    # ── запуск / остановка агента ────────────────────────────────────────────

    def _start_agent(self):
        if self._agent_proc and self._agent_proc.poll() is None:
            return
        if not os.path.exists(AGENT):
            messagebox.showerror('Ошибка', f'Не найден агент:\n{AGENT}')
            return
        cmd = ([AGENT] if AGENT.endswith('.exe')
               else [sys.executable, AGENT])
        self._agent_proc = subprocess.Popen(
            cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
            text=True, encoding='utf-8', errors='replace',
            cwd=BASE,
        )
        self._log_clear()
        threading.Thread(target=self._read_log, daemon=True).start()
        self._refresh_status()

    def _stop_agent(self):
        if self._agent_proc and self._agent_proc.poll() is None:
            self._agent_proc.terminate()
        self._refresh_status()

    def _refresh_status(self):
        running = self._agent_proc is not None and self._agent_proc.poll() is None
        self.btn_start.configure(state='disabled' if running else 'normal')
        self.btn_stop.configure(state='normal' if running else 'disabled')
        self.lbl_status.configure(
            text='● Работает' if running else '● Не запущен',
            foreground='#22c55e' if running else 'gray',
        )
        self.after(2000, self._refresh_status)

    # ── лог ─────────────────────────────────────────────────────────────────

    def _log_clear(self):
        self.log_box.configure(state='normal')
        self.log_box.delete('1.0', 'end')
        self.log_box.configure(state='disabled')

    def _log_append(self, text: str):
        self.log_box.configure(state='normal')
        self.log_box.insert('end', text)
        self.log_box.see('end')
        self.log_box.configure(state='disabled')

    def _read_log(self):
        proc = self._agent_proc
        if proc is None or proc.stdout is None:
            return
        for line in proc.stdout:
            self.after(0, self._log_append, line)


if __name__ == '__main__':
    app = App()
    app.mainloop()
