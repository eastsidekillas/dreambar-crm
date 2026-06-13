import { Injectable, signal } from '@angular/core';

/**
 * Отслеживает доступность сети/сервера.
 *
 * `navigator.onLine` ловит только наличие сетевого интерфейса, поэтому
 * фактический статус уточняется по результату реальных HTTP-запросов
 * (см. networkInterceptor): любой ответ сервера → online, сетевая ошибка
 * (status 0) → offline.
 */
@Injectable({ providedIn: 'root' })
export class NetworkService {
  private readonly _online = signal<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  readonly online = this._online.asReadonly();

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this._online.set(true));
      window.addEventListener('offline', () => this._online.set(false));
    }
  }

  /** Вызывается HTTP-слоем для отражения реальной доступности сервера. */
  setOnline(value: boolean): void {
    if (this._online() !== value) this._online.set(value);
  }
}