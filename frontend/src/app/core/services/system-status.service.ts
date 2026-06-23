import { Injectable, inject, signal } from '@angular/core';
import { timer, switchMap, catchError, of, EMPTY } from 'rxjs';
import { SystemApi } from '../../entities/system';
import { SystemStatus } from '../models';

/**
 * Опрос «рубильника» остановки. Раз в POLL_MS дёргает публичный /system/status/
 * и, если система остановлена, в корне приложения показывается полноэкранная
 * заглушка — на всех экранах (официант, кухня, бар, гардероб, вход).
 *
 * Fail-open: ошибка сети НЕ считается остановкой (иначе обрыв связи выглядел бы
 * как «программа остановлена»). Заглушку поднимает только явный is_stopped: true.
 */
@Injectable({ providedIn: 'root' })
export class SystemStatusService {
  private api = inject(SystemApi);

  private _stopped = signal(false);
  private _message = signal('');
  readonly stopped = this._stopped.asReadonly();
  readonly message = this._message.asReadonly();

  /** Интервал опроса. Бар маленький — 15 c достаточно, нагрузки не создаёт. */
  private readonly POLL_MS = 15_000;
  private started = false;

  /** Запускается один раз из App. Повторные вызовы игнорируются. */
  start() {
    if (this.started) return;
    this.started = true;
    timer(0, this.POLL_MS).pipe(
      switchMap(() => this.api.getStatus().pipe(
        // Сбой запроса не трогает состояние — оставляем как было (fail-open).
        catchError(() => EMPTY),
      )),
    ).subscribe(status => this.apply(status));
  }

  /** Применить только что полученный статус (используется и после ручной остановки). */
  apply(status: SystemStatus) {
    this._stopped.set(!!status.is_stopped);
    this._message.set(status.message || '');
  }
}