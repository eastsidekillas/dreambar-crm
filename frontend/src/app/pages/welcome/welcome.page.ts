import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { API_BASE as BASE } from '../../shared/api';
import { LucideGlassWater, LucideLock, LucideKeyRound, LucideTriangleAlert } from '@lucide/angular';

type Step = 'password' | 'pin';

/**
 * Онбординг при первом входе: временный пароль от админа →
 * сотрудник создаёт свой пароль, затем (по желанию) ставит PIN,
 * после — выбор роли (/role-select) или сразу свой интерфейс.
 */
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, FormsModule,
    LucideGlassWater, LucideLock, LucideKeyRound, LucideTriangleAlert],
  template: `
<div class="min-h-screen flex items-center justify-center px-4" style="background:var(--color-bg)">
  <div class="w-full max-w-sm">

    <div class="text-center mb-6">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
           style="background:var(--color-gold)">
        <svg lucideGlassWater [size]="32" style="color:white"></svg>
      </div>
      <h1 class="text-xl font-bold" style="color:var(--color-text)">
        Привет, {{ userName }}!
      </h1>
      <p class="text-sm mt-1" style="color:var(--color-muted)">
        Настроим твой аккаунт — это займёт минуту
      </p>
    </div>

    <!-- Steps indicator -->
    <div class="flex items-center justify-center gap-2 mb-5">
      <span class="w-2.5 h-2.5 rounded-full"
            [style.background]="step() === 'password' ? 'var(--color-gold)' : '#22c55e'"></span>
      <span class="w-8 h-0.5" style="background:var(--color-border)"></span>
      <span class="w-2.5 h-2.5 rounded-full"
            [style.background]="step() === 'pin' ? 'var(--color-gold)' : 'var(--color-border)'"></span>
    </div>

    <!-- ── Шаг 1: свой пароль ─────────────────────────────────────── -->
    @if (step() === 'password') {
      <div class="card" style="box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div class="flex items-center gap-2 mb-4">
          <svg lucideLock [size]="18" style="color:var(--color-gold-hover)"></svg>
          <p class="font-semibold" style="color:var(--color-text)">Придумай свой пароль</p>
        </div>
        <p class="text-xs mb-4" style="color:var(--color-muted)">
          Пароль, который выдал администратор — временный. Замени его на свой.
        </p>

        <div class="mb-3">
          <label class="block text-sm font-medium mb-1.5">Временный пароль</label>
          <input type="password" [(ngModel)]="currentPassword" autocomplete="current-password"
                 class="field" style="height:44px" placeholder="Пароль от администратора"/>
        </div>
        <div class="mb-3">
          <label class="block text-sm font-medium mb-1.5">Новый пароль</label>
          <input type="password" [(ngModel)]="newPassword" autocomplete="new-password"
                 class="field" style="height:44px" placeholder="Минимум 6 символов"/>
        </div>
        <div class="mb-4">
          <label class="block text-sm font-medium mb-1.5">Повтори новый пароль</label>
          <input type="password" [(ngModel)]="newPassword2" autocomplete="new-password"
                 class="field" style="height:44px" placeholder="Ещё раз"/>
        </div>

        @if (error()) {
          <div class="mb-4 px-3 py-2.5 rounded-lg text-sm flex items-center gap-1.5"
               style="background:var(--color-red-bg);color:var(--color-red)">
            <svg lucideTriangleAlert [size]="14"></svg> {{ error() }}
          </div>
        }

        <button (click)="savePassword()" [disabled]="saving() || !passwordValid()"
                class="btn btn-primary btn-lg btn-full"
                [style.opacity]="passwordValid() ? '1' : '0.5'">
          {{ saving() ? 'Сохранение...' : 'Сохранить пароль' }}
        </button>
      </div>
    }

    <!-- ── Шаг 2: PIN (по желанию) ────────────────────────────────── -->
    @if (step() === 'pin') {
      <div class="card" style="box-shadow:0 4px 24px rgba(0,0,0,0.08)">
        <div class="flex items-center gap-2 mb-2">
          <svg lucideKeyRound [size]="18" style="color:var(--color-gold-hover)"></svg>
          <p class="font-semibold" style="color:var(--color-text)">Поставь PIN-код</p>
        </div>
        <p class="text-xs mb-4" style="color:var(--color-muted)">
          4 цифры — чтобы быстро входить в смену с общего терминала, без пароля.
          Можно пропустить и настроить позже в профиле.
        </p>

        <!-- PIN dots -->
        <div class="flex justify-center gap-3 mb-4">
          @for (i of [0,1,2,3]; track i) {
            <span class="w-4 h-4 rounded-full"
                  [style.background]="pin.length > i ? 'var(--color-gold)' : 'var(--color-border)'"></span>
          }
        </div>

        <!-- Keypad -->
        <div class="grid grid-cols-3 gap-2 mb-4 select-none">
          @for (d of ['1','2','3','4','5','6','7','8','9']; track d) {
            <button (click)="pressDigit(d)"
                    class="rounded-xl font-bold text-xl"
                    style="background:var(--color-bg);border:1px solid var(--color-border);min-height:56px">
              {{ d }}
            </button>
          }
          <span></span>
          <button (click)="pressDigit('0')"
                  class="rounded-xl font-bold text-xl"
                  style="background:var(--color-bg);border:1px solid var(--color-border);min-height:56px">0</button>
          <button (click)="pin = pin.slice(0, -1)"
                  class="rounded-xl text-xl"
                  style="background:var(--color-bg);border:1px solid var(--color-border);min-height:56px">⌫</button>
        </div>

        @if (pinRepeat !== null) {
          <p class="text-center text-sm mb-3" style="color:var(--color-muted)">Повтори PIN ещё раз</p>
        }

        @if (error()) {
          <div class="mb-4 px-3 py-2.5 rounded-lg text-sm flex items-center gap-1.5"
               style="background:var(--color-red-bg);color:var(--color-red)">
            <svg lucideTriangleAlert [size]="14"></svg> {{ error() }}
          </div>
        }

        <button (click)="finish()" class="btn btn-ghost btn-full mt-1" style="color:var(--color-muted)">
          Пропустить — настрою позже
        </button>
      </div>
    }

    <button (click)="auth.logout()" class="mt-5 w-full text-center text-sm" style="color:var(--color-muted)">
      Выйти
    </button>
  </div>
</div>
  `,
})
export class WelcomePage implements OnInit {
  readonly auth = inject(AuthService);
  private http   = inject(HttpClient);
  private router = inject(Router);
  private toast  = inject(ToastService);

  step   = signal<Step>('password');
  saving = signal(false);
  error  = signal('');

  userName = '';
  currentPassword = '';
  newPassword  = '';
  newPassword2 = '';

  pin = '';
  /** null = вводим первый раз; строка = первый ввод, ждём подтверждение */
  pinRepeat: string | null = null;

  passwordValid(): boolean {
    return this.currentPassword.length > 0
        && this.newPassword.length >= 6
        && this.newPassword === this.newPassword2;
  }

  ngOnInit() {
    const user = this.auth.user();
    if (!user) { this.router.navigateByUrl('/login'); return; }
    this.userName = user.display_name || user.username;
    // Пароль уже свой (зашёл повторно) — сразу к PIN
    if (!user.must_change_password) this.step.set('pin');
  }

  savePassword() {
    this.error.set('');
    if (this.newPassword.length < 6) { this.error.set('Новый пароль — минимум 6 символов'); return; }
    if (this.newPassword !== this.newPassword2) { this.error.set('Пароли не совпадают'); return; }
    this.saving.set(true);
    this.http.post(`${BASE}/auth/me/password/`, {
      current_password: this.currentPassword,
      new_password: this.newPassword,
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.success('Пароль сохранён');
        const u = this.auth.user();
        if (u) this.auth.user.set({ ...u, must_change_password: false });
        this.step.set('pin');
        this.error.set('');
      },
      error: err => {
        this.saving.set(false);
        this.error.set(err?.error?.detail ?? 'Не удалось сменить пароль');
      },
    });
  }

  pressDigit(d: string) {
    if (this.pin.length >= 4) return;
    this.pin += d;
    if (this.pin.length === 4) {
      if (this.pinRepeat === null) {
        // Первый ввод — просим повторить
        this.pinRepeat = this.pin;
        this.pin = '';
        this.error.set('');
      } else if (this.pin === this.pinRepeat) {
        this.savePin(this.pin);
      } else {
        this.error.set('PIN не совпал — попробуй ещё раз');
        this.pin = '';
        this.pinRepeat = null;
      }
    }
  }

  private savePin(pin: string) {
    this.http.post(`${BASE}/auth/me/pin/`, { pin }).subscribe({
      next: () => {
        this.toast.success('PIN установлен');
        const u = this.auth.user();
        if (u) this.auth.user.set({ ...u, has_pin: true });
        this.finish();
      },
      error: err => {
        this.error.set(err?.error?.detail ?? 'Не удалось сохранить PIN');
        this.pin = '';
        this.pinRepeat = null;
      },
    });
  }

  finish() {
    if (this.auth.needsRoleSelect()) {
      this.router.navigateByUrl('/role-select');
    } else {
      this.router.navigateByUrl(this.auth.landingRoute());
    }
  }
}
