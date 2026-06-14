import { Injectable, inject, computed } from '@angular/core';
import { AuthService } from './auth.service';
import { WILDCARD } from '../../shared/lib/permissions';

/**
 * Единая точка проверки прав на фронте. Источник — поле `permissions` из /auth/me.
 *
 * ВАЖНО: это только UX-слой (скрыть кнопку, увести с роута). Настоящая защита —
 * на backend. Пока этот сервис не подключён к guard'ам/шаблонам, поведение не меняется.
 *
 * Использование:
 *   perm.can(Perm.MENU_MANAGE)     // в шаблоне: @if (perm.can(Perm.MENU_MANAGE))
 *   perm.canAny([...])             // хотя бы одно из прав
 */
@Injectable({ providedIn: 'root' })
export class PermissionService {
  private auth = inject(AuthService);

  /** Реактивный набор прав текущего пользователя. */
  readonly permissions = computed<ReadonlySet<string>>(
    () => new Set(this.auth.user()?.permissions ?? []),
  );

  /** Есть ли у пользователя данное право (с учётом джокера '*'). */
  can(perm: string): boolean {
    const p = this.permissions();
    return p.has(WILDCARD) || p.has(perm);
  }

  /** Есть ли хотя бы одно из прав. */
  canAny(perms: string[]): boolean {
    return perms.some(p => this.can(p));
  }

  /** Есть ли все перечисленные права. */
  canAll(perms: string[]): boolean {
    return perms.every(p => this.can(p));
  }
}