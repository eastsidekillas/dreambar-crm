import { Injectable, signal } from '@angular/core';

/**
 * Состояние связи с сервером. Интерцептор сообщает о сетевых сбоях
 * (status 0, таймауты) и об успешных ответах; баннер в корне приложения
 * показывает «нет связи», пока сбои не прекратятся.
 *
 * Важно: баннер зажигается только после НЕСКОЛЬКИХ сбоев подряд — иначе
 * один кратковременный обрыв (роуминг между точками WiFi, когда официант
 * идёт к столу) ложно показывал «связь потеряна» при живом сигнале.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private _offline = signal(false);
  readonly offline = this._offline.asReadonly();

  /** Сколько сетевых сбоев подряд до баннера. */
  private readonly FAIL_THRESHOLD = 2;
  private fails = 0;

  /** Сетевой сбой запроса (нет связи / сервер молчит). Баннер — только после порога. */
  reportFailure() {
    this.fails++;
    if (this.fails >= this.FAIL_THRESHOLD) this._offline.set(true);
  }

  /** Любой успешный ответ — связь есть, счётчик и баннер сбрасываем. */
  reportOnline() {
    this.fails = 0;
    if (this._offline()) this._offline.set(false);
  }
}