import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { switchMap, tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { TokenResponse, User, Role } from '../models';

import { environment } from '../../../environments/environment';

const API = environment.apiBase;

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly user = signal<User | null>(this.loadUser());
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);
  readonly isAdmin = computed<boolean>(() => this.user()?.role === 'admin');

  constructor(private http: HttpClient, private router: Router) {}

  /** Login then fetch profile — emits the full User once role is known. */
  login(username: string, password: string): Observable<User> {
    return this.http.post<TokenResponse>(`${API}/auth/token/`, { username, password }).pipe(
      tap(tokens => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
      }),
      switchMap(() => this.fetchProfile())
    );
  }

  fetchProfile(): Observable<User> {
    return this.http.get<User>(`${API}/auth/me/`).pipe(
      tap(user => {
        localStorage.setItem('user', JSON.stringify(user));
        this.user.set(user);
      })
    );
  }

  /** Default landing route for a role. */
  landingRoute(role?: Role | null): string {
    switch (role ?? this.role()) {
      case 'admin':     return '/admin';
      case 'kitchen':   return '/kitchen';
      case 'wardrobe':  return '/waiter/tickets';
      default:          return '/waiter/order';   // waiter, bartender
    }
  }

  logout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    this.user.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null { return localStorage.getItem('access_token'); }
  isLoggedIn(): boolean { return !!this.getToken(); }

  private loadUser(): User | null {
    try {
      const s = localStorage.getItem('user');
      return s ? JSON.parse(s) : null;
    } catch { return null; }
  }
}
