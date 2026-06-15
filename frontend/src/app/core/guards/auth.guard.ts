import { inject } from '@angular/core';
import { CanActivateFn, Router, UrlTree } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models';

/**
 * Общий шлюз доступа. Возвращает UrlTree-редирект или null (можно пускать дальше).
 * Порядок: нет сессии → PIN/пароль; временный пароль → онбординг; заблокировано → PIN.
 */
function authGate(auth: AuthService, router: Router): UrlTree | null {
  if (!auth.isLoggedIn()) return router.createUrlTree([auth.entryRoute()]);
  if (auth.user()?.must_change_password) return router.createUrlTree(['/welcome']);
  // Блокировка: приложение свернули/закрыли/перезапустили — требуем PIN
  if (!auth.isUnlocked()) return router.createUrlTree(['/pin']);
  return null;
}

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return authGate(auth, router) ?? true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const gate = authGate(auth, router);
  if (gate) return gate;
  if (auth.isAdmin()) return true;
  return router.createUrlTree([auth.landingRoute()]);
};

/**
 * Изоляция интерфейсов: пускает только перечисленные роли (админ — везде).
 * Чужая роль уводится на свой интерфейс.
 */
export const roleGuard = (...roles: Role[]): CanActivateFn => () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const gate = authGate(auth, router);
  if (gate) return gate;
  const role = auth.role();
  if (role === 'admin' || (role && roles.includes(role))) return true;
  return router.createUrlTree([auth.landingRoute()]);
};
