import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SystemControlWidget } from '../../../widgets/system-control/system-control.widget';
import { PermissionService } from '../../../core/services/permission.service';
import { Perm } from '../../../shared/lib/permissions';

/** Страница «Состояние системы» — удалённый рубильник приложения (вынесено из дашборда). */
@Component({
  selector: 'app-system-page',
  standalone: true,
  imports: [CommonModule, SystemControlWidget],
  template: `
    @if (perm.can(Perm.SYSTEM_CONTROL)) {
      <div class="space-y-4" style="max-width:640px">
        <app-system-control />
        <p class="text-xs" style="color:var(--color-muted)">
          Остановка показывает заглушку на всех экранах (официанты, бар, кухня) и блокирует работу
          до возобновления. Используйте только при экстренной необходимости.
        </p>
      </div>
    } @else {
      <p style="color:var(--color-muted)">Недостаточно прав для управления системой.</p>
    }
  `,
})
export class SystemPage {
  readonly perm = inject(PermissionService);
  readonly Perm = Perm;
}