import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, OnDestroy, signal, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { EmployeeApi } from '../../entities/employee';
import { AuthService } from '../../core/services/auth.service';
import { StaffMember } from '../../core/models';
import { LucideDynamicIcon, LucideGlassWater } from '@lucide/angular';
import { ROLE_COLOR, ROLE_ICON } from '../../shared/lib/roles';

@Component({
  selector: 'app-pin-login',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideGlassWater],
  template: `
<div class="pin-screen">

  <!-- ── Logo / clock ─────────────────────────────────────────────── -->
  <div class="pin-header">
    <div class="flex items-center gap-3">
      <div class="logo-badge"><svg lucideGlassWater [size]="18" style="color:white"></svg></div>
      <div>
        <p class="font-bold leading-none" style="color:var(--color-text);font-size:15px">BAR DREAM</p>
        <p style="color:var(--color-muted);font-size:12px">{{ timeStr() }}</p>
      </div>
    </div>
    <a href="/login" class="pwd-link">Войти по паролю →</a>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- Phase: select staff ─────────────────────────────────────────── -->
  @if (phase() === 'select') {
    <div class="pin-body">
      <p class="pin-hint">Нажмите своё имя</p>

      @if (loading()) {
        <div style="color:var(--color-muted);text-align:center;padding:3rem">Загрузка...</div>
      } @else if (staff().length === 0) {
        <div style="color:var(--color-muted);text-align:center;padding:3rem">
          Нет сотрудников с PIN.<br>
          <a href="/login" style="color:var(--color-gold-hover)">Войти по паролю</a>
        </div>
      } @else {
        <div class="staff-grid">
          @for (s of staffWithPin(); track s.id) {
            <button class="staff-card" (click)="selectStaff(s)">
              <div class="staff-avatar" [style.background]="roleColor(s.role)">
                <svg [lucideIcon]="roleIcon(s.role)" [size]="24" style="color:white"></svg>
              </div>
              <span class="staff-text">
                <span class="staff-name">{{ s.display_name }}</span>
                <span class="staff-role" [style.color]="roleColor(s.role)">{{ s.role_label }}</span>
              </span>
              <span class="staff-chevron">›</span>
            </button>
          }
        </div>
      }
    </div>
  }

  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- Phase: enter PIN ────────────────────────────────────────────── -->
  @if (phase() === 'enter') {
    <div class="pin-body pin-enter">

      <button class="back-btn" (click)="back()">← Назад</button>

      <div class="selected-person">
        <div class="staff-avatar lg" [style.background]="roleColor(selected()!.role)">
          <svg [lucideIcon]="roleIcon(selected()!.role)" [size]="30" style="color:white"></svg>
        </div>
        <p class="person-name">{{ selected()!.display_name }}</p>
        <p class="staff-role" [style.color]="roleColor(selected()!.role)">{{ selected()!.role_label }}</p>
      </div>

      <!-- PIN dots -->
      <div class="pin-dots" [class.shake]="error()">
        @for (i of [0,1,2,3]; track i) {
          <div class="pin-dot" [class.filled]="pin().length > i"
               [class.error]="error()"></div>
        }
      </div>

      <p class="pin-error">{{ error() || ' ' }}</p>

      <!-- Numpad: на мобильном прижат к низу, под большой палец -->
      <div class="numpad-wrap">
        <div class="numpad">
          @for (key of numpadKeys; track key) {
            @if (key === '⌫') {
              <button class="numpad-key action" (click)="backspace()">⌫</button>
            } @else if (key === '') {
              <div class="numpad-key empty"></div>
            } @else {
              <button class="numpad-key" (click)="pressDigit(key)"
                      [disabled]="loading()">{{ key }}</button>
            }
          }
        </div>
      </div>

    </div>
  }

</div>

<style>
.pin-screen {
  min-height: 100dvh;
  background: var(--color-bg);
  display: flex;
  flex-direction: column;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
}

.pin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: max(0.875rem, env(safe-area-inset-top)) 1rem 0.875rem;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.logo-badge {
  width: 32px; height: 32px; border-radius: 0.5rem;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-gold); flex-shrink: 0;
}

.pwd-link {
  color: var(--color-muted);
  text-decoration: none;
  font-size: 0.8rem;
  padding: 0.5rem 0.25rem; /* крупная зона нажатия */
  white-space: nowrap;
}

.pin-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.25rem 1rem max(1rem, env(safe-area-inset-bottom));
  overflow-y: auto;
  width: 100%;
}

.pin-hint {
  font-size: 1rem;
  color: var(--color-muted);
  margin-bottom: 1.25rem;
  letter-spacing: 0.05em;
}

/* ── Staff: мобильный список строк ── */
.staff-grid {
  display: flex;
  flex-direction: column;
  gap: 0.625rem;
  width: 100%;
  max-width: 480px;
}

.staff-card {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  min-height: 68px;
  padding: 0.75rem 1rem;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 1rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  cursor: pointer;
  text-align: left;
  touch-action: manipulation;
  transition: border-color 0.15s, background 0.15s;
}
.staff-card:hover, .staff-card:active {
  border-color: var(--color-gold);
  background: var(--color-gold-light);
}

.staff-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.staff-chevron {
  color: var(--color-light);
  font-size: 1.5rem;
  line-height: 1;
  flex-shrink: 0;
}

.staff-avatar {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.9;
}
.staff-avatar.lg { width: 68px; height: 68px; opacity: 1; }

.staff-name {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staff-role { font-size: 0.75rem; }

/* ── Staff: сетка карточек на широких экранах (ПК кассы) ── */
@media (min-width: 640px) {
  .staff-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
    max-width: 700px;
  }
  .staff-card {
    flex-direction: column;
    gap: 0.5rem;
    padding: 1.25rem 0.75rem;
    min-height: 0;
    text-align: center;
  }
  .staff-text { align-items: center; flex: none; }
  .staff-chevron { display: none; }
  .staff-avatar { width: 64px; height: 64px; }
  .pin-hint { font-size: 1.1rem; margin-bottom: 2rem; }
}

/* ── PIN enter ── */
.pin-enter {
  gap: 0.75rem;
  max-width: 420px;
  margin: 0 auto;
  overflow: hidden; /* всё умещается без прокрутки */
}

.back-btn {
  align-self: flex-start;
  background: none;
  border: none;
  color: var(--color-muted);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.625rem 0.75rem 0.625rem 0; /* крупная зона нажатия */
  touch-action: manipulation;
}

.selected-person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.375rem;
}

.person-name {
  font-size: 1.15rem;
  font-weight: 600;
  color: var(--color-text);
  text-align: center;
}

.pin-dots {
  display: flex;
  gap: 1.125rem;
  margin-top: 0.375rem;
}
.pin-dots.shake { animation: shake 0.4s; }
@keyframes shake {
  20%, 60% { transform: translateX(-6px); }
  40%, 80% { transform: translateX(6px); }
}

.pin-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid var(--color-border-mid);
  background: transparent;
  transition: all 0.15s;
}
.pin-dot.filled { background: var(--color-gold); border-color: var(--color-gold); }
.pin-dot.error  { background: var(--color-red); border-color: var(--color-red); }

.pin-error {
  color: var(--color-red);
  font-size: 0.875rem;
  min-height: 20px;
  text-align: center;
}

/* ── Numpad ── */
.numpad-wrap {
  margin-top: auto;     /* прижимаем к низу — на телефоне удобнее большому пальцу */
  width: 100%;
  display: flex;
  justify-content: center;
  padding-top: 0.5rem;
}

.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
  width: 100%;
  max-width: 340px;
}

.numpad-key {
  min-height: 68px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 0.875rem;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  color: var(--color-text);
  font-size: 1.6rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, border-color 0.1s;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}
.numpad-key:active { background: var(--color-gold-light); border-color: var(--color-gold); }
@media (hover: hover) {
  .numpad-key:hover { background: var(--color-surface2); border-color: var(--color-border-mid); }
}
.numpad-key.action { color: var(--color-muted); font-size: 1.3rem; }
.numpad-key.empty { background: transparent; border-color: transparent; cursor: default; }
.numpad-key:disabled { opacity: 0.4; }

/* Невысокие экраны (телефон в альбомной, маленькие телефоны) — компактнее */
@media (max-height: 640px) {
  .staff-avatar.lg { width: 52px; height: 52px; }
  .person-name { font-size: 1rem; }
  .pin-enter { gap: 0.375rem; }
  .numpad-key { min-height: 54px; font-size: 1.4rem; }
  .pin-header { padding-top: 0.625rem; padding-bottom: 0.625rem; }
}
</style>
  `,
})
export class PinLoginPage implements OnInit, OnDestroy {
  phase    = signal<'select' | 'enter'>('select');
  staff    = signal<StaffMember[]>([]);
  selected = signal<StaffMember | null>(null);
  pin      = signal<string>('');
  error    = signal<string>('');
  loading  = signal(false);
  timeStr  = signal('');

  staffWithPin = computed(() => this.staff().filter(s => s.has_pin));

  numpadKeys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  private _timer: any;

  constructor(
    private employeeApi: EmployeeApi,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.updateClock();
    this._timer = setInterval(() => this.updateClock(), 10000);
    this.loadStaff();
  }

  ngOnDestroy() { clearInterval(this._timer); }

  /** Физическая клавиатура на ПК кассы: цифры, Backspace, Esc. */
  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent) {
    if (this.phase() !== 'enter') return;
    if (/^[0-9]$/.test(e.key)) { this.pressDigit(e.key); e.preventDefault(); }
    else if (e.key === 'Backspace') { this.backspace(); e.preventDefault(); }
    else if (e.key === 'Escape')    { this.back(); e.preventDefault(); }
  }

  private updateClock() {
    const now = new Date();
    this.timeStr.set(now.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }));
  }

  loadStaff() {
    this.loading.set(true);
    this.employeeApi.getStaffList().subscribe({
      next: list => { this.staff.set(list); this.loading.set(false); },
      error: ()  => { this.loading.set(false); },
    });
  }

  selectStaff(s: StaffMember) {
    this.selected.set(s);
    this.pin.set('');
    this.error.set('');
    this.phase.set('enter');
  }

  back() {
    this.phase.set('select');
    this.selected.set(null);
    this.pin.set('');
    this.error.set('');
  }

  pressDigit(d: string) {
    if (this.loading()) return;
    const cur = this.pin();
    if (cur.length >= 4) return;
    const next = cur + d;
    this.pin.set(next);
    this.error.set('');
    if (next.length === 4) setTimeout(() => this.submit(), 120);
  }

  backspace() {
    this.error.set('');
    this.pin.set(this.pin().slice(0, -1));
  }

  submit() {
    const s = this.selected();
    if (!s || this.loading()) return;
    this.loading.set(true);

    this.employeeApi.pinLogin(s.id, this.pin()).subscribe({
      next: tokens => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        this.auth.fetchProfile().subscribe(user => {
          this.loading.set(false);
          if (user.must_change_password) {
            this.router.navigateByUrl('/welcome');
          } else if (this.auth.needsRoleSelect()) {
            this.router.navigateByUrl('/role-select');
          } else {
            this.router.navigate([this.auth.landingRoute(user.role)]);
          }
        });
      },
      error: err => {
        this.loading.set(false);
        this.pin.set('');
        this.error.set(err.error?.detail ?? 'Ошибка входа');
        setTimeout(() => this.error.set(''), 2000);
      },
    });
  }

  roleColor(role: string) { return ROLE_COLOR[role] ?? '#64748b'; }
  roleIcon(role: string): LucideIconInput  { return ROLE_ICON[role] ?? ROLE_ICON['admin']; }
}