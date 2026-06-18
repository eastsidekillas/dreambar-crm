import { Injectable, signal } from '@angular/core';

/**
 * Pull-to-refresh: связывает жест в общей оболочке (waiter-shell) с активной
 * страницей. Страница в ngOnInit регистрирует обработчик и зовёт {@link done}
 * по завершении перезагрузки; оболочка дёргает {@link trigger} по протяжке вниз.
 *
 * `loading` — сигнал для индикатора (директива {@link PullToRefreshDirective}).
 */
@Injectable({ providedIn: 'root' })
export class RefreshService {
  /** Идёт ли ручное обновление (крутим спиннер). */
  readonly loading = signal(false);

  private handler: (() => void) | null = null;

  /** Страница объявляет, как перезагружать свои данные. */
  register(fn: () => void) { this.handler = fn; }

  /** Снять обработчик при уходе со страницы (если он ещё наш). */
  unregister(fn: () => void) { if (this.handler === fn) this.handler = null; }

  /** Запустить обновление. Возвращает false, если у текущей страницы нет обработчика. */
  trigger(): boolean {
    if (!this.handler) return false;
    this.loading.set(true);
    this.handler();
    return true;
  }

  /** Перезагрузка завершена — спрятать индикатор. */
  done() { this.loading.set(false); }
}