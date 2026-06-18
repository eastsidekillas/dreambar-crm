import { Injectable, inject, signal } from '@angular/core';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs';

/**
 * Отслеживает выход новой версии PWA. SW качает обновление в фоне; когда оно
 * готово — поднимаем флаг {@link updateReady}, корень приложения показывает
 * кнопку «Обновить». Перезагрузка применяет новую версию.
 *
 * В dev (SW выключен) всё это no-op.
 */
@Injectable({ providedIn: 'root' })
export class PwaUpdateService {
  private sw = inject(SwUpdate);
  readonly updateReady = signal(false);

  init() {
    if (!this.sw.isEnabled) return;
    this.sw.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));
    // Периодически проверяем обновления (планшеты висят сутками открытыми).
    setInterval(() => this.sw.checkForUpdate().catch(() => {}), 60 * 60 * 1000);
  }

  apply() { document.location.reload(); }
}