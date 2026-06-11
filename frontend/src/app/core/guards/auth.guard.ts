import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/pin']);
  // Временный пароль — сначала онбординг, дальше не пускаем
  if (auth.user()?.must_change_password) return router.createUrlTree(['/welcome']);
  return true;
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/pin']);
  if (auth.user()?.must_change_password) return router.createUrlTree(['/welcome']);
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
  if (!auth.isLoggedIn()) return router.createUrlTree(['/pin']);
  if (auth.user()?.must_change_password) return router.createUrlTree(['/welcome']);
  const role = auth.role();
  if (role === 'admin' || (role && roles.includes(role))) return true;
  return router.createUrlTree([auth.landingRoute()]);
};
