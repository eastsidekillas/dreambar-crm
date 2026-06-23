import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SystemApi } from '../../entities/system';
import { SystemStatusService } from '../../core/services/system-status.service';
import { PermissionService } from '../../core/services/permission.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Perm } from '../../shared/lib/permissions';

/**
 * Карточка «рубильника»: админ удалённо останавливает/запускает приложение.
 * Состояние читается из SystemStatusService (тот же опрос, что и заглушка),
 * после действия применяем ответ сразу, не дожидаясь следующего опроса.
 */
@Component({
  selector: 'app-system-control',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    @if (perm.can(Perm.SYSTEM_CONTROL)) {
      <div class="card" [class.stopped]="system.stopped()">
        <div class="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h3 class="font-semibold text-sm flex items-center gap-2">
              <span class="dot" [class.on]="!system.stopped()"></span>
              Состояние системы
            </h3>
            <p class="text-xs mt-1" style="color:var(--color-muted)">
              {{ system.stopped()
                  ? 'Остановлена — на всех экранах показана заглушка'
                  : 'Работает штатно' }}
            </p>
          </div>

          @if (system.stopped()) {
            <button class="btn btn-sm" style="background:#16a34a;color:#fff"
                    [disabled]="busy()" (click)="resume()">
              Возобновить работу
            </button>
          } @else {
            <button class="btn btn-sm" style="background:#dc2626;color:#fff"
                    [disabled]="busy()" (click)="stop()">
              Остановить
            </button>
          }
        </div>

        @if (!system.stopped()) {
          <input class="input mt-3" type="text" [(ngModel)]="message"
                 placeholder="Текст заглушки (необязательно)" maxlength="200" />
        }
      </div>
    }
  `,
  styles: [`
    .card.stopped { border-color: #fca5a5; background: #fef2f2; }
    .dot {
      display: inline-block; width: 9px; height: 9px; border-radius: 50%;
      background: #dc2626; flex-shrink: 0;
    }
    .dot.on { background: #22c55e; }
    .input {
      width: 100%; padding: 8px 12px; border-radius: 10px;
      border: 1px solid var(--color-border); font-size: 0.875rem;
      background: white; color: var(--color-text);
    }
  `],
})
export class SystemControlWidget {
  private api = inject(SystemApi);
  readonly system = inject(SystemStatusService);
  readonly perm = inject(PermissionService);
  private toast = inject(ToastService);
  readonly Perm = Perm;

  message = '';
  readonly busy = signal(false);

  stop() {
    if (!confirm('Остановить приложение? Все экраны покажут заглушку, работа прекратится.')) return;
    this.busy.set(true);
    this.api.stop(this.message).subscribe({
      next: s => { this.system.apply(s); this.toast.show('Система остановлена'); },
      error: err => this.toast.apiError(err, 'Не удалось остановить'),
    }).add(() => this.busy.set(false));
  }

  resume() {
    this.busy.set(true);
    this.api.resume().subscribe({
      next: s => { this.system.apply(s); this.message = ''; this.toast.show('Система снова работает'); },
      error: err => this.toast.apiError(err, 'Не удалось возобновить'),
    }).add(() => this.busy.set(false));
  }
}