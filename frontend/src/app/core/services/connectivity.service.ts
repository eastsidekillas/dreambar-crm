import { Injectable, signal } from '@angular/core';

/**
 * Состояние связи с сервером. Интерцептор сообщает о сетевых сбоях
 * (status 0, таймауты) и об успешных ответах; баннер в корне приложения
 * показывает «нет связи», пока сбои не прекратятся.
 */
@Injectable({ providedIn: 'root' })
export class ConnectivityService {
  private _offline = signal(false);
  readonly offline = this._offline.asReadonly();

  reportOffline() { this._offline.set(true); }
  reportOnline()  { if (this._offline()) this._offline.set(false); }
}