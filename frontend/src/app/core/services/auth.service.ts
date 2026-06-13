import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, switchMap, tap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { TokenResponse, User, Role } from '../models';

import { environment } from '../../../environments/environment';

const API = environment.apiBase;
const ACTIVE_ROLE_KEY = 'active_role';

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user        = signal<User | null>(this.loadUser());
  readonly activeRole  = signal<Role | null>(this.loadActiveRole());

  readonly role     = computed<Role | null>(() => this.activeRole() ?? this.user()?.role ?? null);
  readonly isAdmin  = computed<boolean>(() => this.role() === 'admin');

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<User> {
    return this.http.post<TokenResponse>(`${API}/auth/token/`, { username, password }).pipe(
      tap(tokens => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        // Новый вход — старый выбор роли не должен переживать авторизацию
        this.clearActiveRole();
      }),
      switchMap(() => this.fetchProfile())
    );
  }

  /** Обновляет access-токен по refresh-токену (вызывается интерцептором на 401). */
  refreshAccessToken(): Observable<string> {
    const refresh = localStorage.getItem('refresh_token');
    if (!refresh) return throwError(() => new Error('Нет refresh-токена'));
    return this.http.post<{ access: string }>(`${API}/auth/token/refresh/`, { refresh }).pipe(
      tap(r => localStorage.setItem('access_token', r.access)),
      map(r => r.access),
    );
  }

  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${API}/auth/me/`).pipe(
      tap(user => {
        localStorage.setItem('user', JSON.stringify(user));
        this.user.set(user);
        // Сбрасываем active_role если она больше не входит в allowed_roles
        const allowed = user.allowed_roles ?? [];
        const stored  = this.loadActiveRole();
        if (stored && allowed.length > 0 && !allowed.includes(stored)) {
          this.clearActiveRole();
        }
      })
    );
  }

  /** Есть ли из чего выбирать: больше одной роли или бармен (терминал + брони). */
  hasRoleChoice(): boolean {
    const allowed = this.user()?.allowed_roles ?? [];
    return allowed.length + (allowed.includes('bartender') ? 1 : 0) > 1;
  }

  /** Нужно ли показывать экран выбора роли? */
  needsRoleSelect(): boolean {
    return this.hasRoleChoice() && !this.activeRole();
  }

  /** Быстрая смена роли без выхода из аккаунта. */
  switchRole(): void {
    this.clearActiveRole();
    this.router.navigateByUrl('/role-select');
  }

  setActiveRole(role: Role): void {
    localStorage.setItem(ACTIVE_ROLE_KEY, role);
    this.activeRole.set(role);
  }

  clearActiveRole(): void {
    localStorage.removeItem(ACTIVE_ROLE_KEY);
    this.activeRole.set(null);
  }

  landingRoute(role?: Role | null): string {
    switch (role ?? this.role()) {
      case 'admin':     return '/admin';
      case 'kitchen':   return '/kitchen';
      case 'bartender': return '/bartender';
      case 'wardrobe':  return '/waiter/tickets';
      default:          return '/waiter/order';
    }
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.clearActiveRole();
    this.user.set(null);
    this.router.navigate(['/pin']);
  }

  getToken(): string | null  { return localStorage.getItem('access_token'); }
  isLoggedIn(): boolean      { return !!this.getToken(); }

  private loadUser(): User | null {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }

  private loadActiveRole(): Role | null {
    return localStorage.getItem(ACTIVE_ROLE_KEY) as Role | null;
  }
}
