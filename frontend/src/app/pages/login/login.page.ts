import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { LucideGlassWater, LucideTriangleAlert } from '@lucide/angular';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideGlassWater, LucideTriangleAlert],
  template: `
    <div class="min-h-screen flex items-center justify-center px-4" style="background:var(--color-bg)">
      <div class="w-full max-w-sm">

        <!-- Logo -->
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style="background:var(--color-gold)">
            <svg lucideGlassWater [size]="32" style="color:white"></svg>
          </div>
          <h1 class="text-2xl font-bold" style="color:var(--color-text)">BAR DREAM</h1>
          <p class="text-sm mt-1" style="color:var(--color-muted)">Система учёта заказов</p>
        </div>

        <!-- Form card -->
        <div class="card" style="box-shadow:0 4px 24px rgba(0,0,0,0.08)">
          <form (ngSubmit)="onSubmit()">

            <div class="mb-4">
              <label class="block text-sm font-medium mb-1.5" style="color:var(--color-text)">
                Логин
              </label>
              <input type="text" [(ngModel)]="username" name="username" required
                     autocomplete="username"
                     class="field" style="height:44px;font-size:1rem"
                     placeholder="Введите логин" />
            </div>

            <div class="mb-5">
              <label class="block text-sm font-medium mb-1.5" style="color:var(--color-text)">
                Пароль
              </label>
              <input type="password" [(ngModel)]="password" name="password" required
                     autocomplete="current-password"
                     class="field" style="height:44px;font-size:1rem"
                     placeholder="Введите пароль" />
            </div>

            @if (error()) {
              <div class="mb-4 px-3 py-2.5 rounded-lg text-sm flex items-center gap-1.5" style="background:var(--color-red-bg);color:var(--color-red)">
                <svg lucideTriangleAlert [size]="14"></svg> {{ error() }}
              </div>
            }

            <button type="submit" class="btn btn-primary btn-lg btn-full" [disabled]="loading()">
              {{ loading() ? 'Вход...' : 'Войти' }}
            </button>
          </form>
        </div>

        <p class="text-center text-xs mt-4" style="color:var(--color-light)">
          BAR DREAM © 2024
        </p>
      </div>
    </div>
  `
})
export class LoginPage {
  username = '';
  password = '';
  loading  = signal(false);
  error    = signal('');

  constructor(private auth: AuthService, private router: Router) {}

  onSubmit() {
    if (!this.username || !this.password) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.username, this.password).subscribe({
      next: user => {
        this.loading.set(false);
        if (user.must_change_password) {
          this.router.navigateByUrl('/welcome');
        } else if ((user.allowed_roles ?? []).length > 1) {
          this.router.navigateByUrl('/role-select');
        } else {
          this.router.navigateByUrl(this.auth.landingRoute(user.role));
        }
      },
      error: () => { this.loading.set(false); this.error.set('Неверный логин или пароль'); }
    });
  }
}
