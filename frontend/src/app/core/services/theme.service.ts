import { Injectable, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark' | 'system';
const KEY = 'dreambar.theme';

/** Тема приложения: светлая / тёмная / системная.
 * Применяется через `data-theme` на <html>, переопределяющий --color-* (см. styles.css). */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly mode = signal<ThemeMode>(this.read());

  constructor() {
    effect(() => this.apply(this.mode()));
    // Если выбрана «системная» — реагируем на смену системной темы.
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener?.('change', () => { if (this.mode() === 'system') this.apply('system'); });
  }

  set(mode: ThemeMode) {
    this.mode.set(mode);
    try { localStorage.setItem(KEY, mode); } catch {}
  }

  private read(): ThemeMode {
    const v = (() => { try { return localStorage.getItem(KEY); } catch { return null; } })();
    return v === 'dark' || v === 'light' || v === 'system' ? v : 'light';
  }

  private apply(mode: ThemeMode) {
    const dark = mode === 'dark'
      || (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }
}