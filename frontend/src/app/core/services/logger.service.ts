import { Injectable, signal } from '@angular/core';

export type LogLevel = 'info' | 'warn' | 'error';
export interface LogEntry { ts: number; level: LogLevel; msg: string; }

const KEY = 'dreambar.logs';
const MAX = 100;

/** Лёгкий буфер логов (последние 100) — для диагностики на планшетах в зале.
 * Ловит глобальные ошибки; пишется в localStorage. Показывается в «Настройках». */
@Injectable({ providedIn: 'root' })
export class LoggerService {
  readonly entries = signal<LogEntry[]>(this.read());

  constructor() {
    window.addEventListener('error', e => this.error(e.message || 'Ошибка'));
    window.addEventListener('unhandledrejection', e =>
      this.error('Promise: ' + (e.reason?.message ?? e.reason ?? 'rejection')));
  }

  info(msg: string)  { this.push('info', msg); }
  warn(msg: string)  { this.push('warn', msg); }
  error(msg: string) { this.push('error', msg); }

  clear() {
    this.entries.set([]);
    try { localStorage.removeItem(KEY); } catch {}
  }

  private push(level: LogLevel, msg: string) {
    const next = [{ ts: Date.now(), level, msg }, ...this.entries()].slice(0, MAX);
    this.entries.set(next);
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  }

  private read(): LogEntry[] {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
  }
}