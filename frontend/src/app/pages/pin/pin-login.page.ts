import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { StaffMember } from '../../core/models';
import {
  LucideDynamicIcon,
  LucideCrown, LucideGlassWater, LucideBell, LucideChefHat, LucideWind, LucideShirt,
} from '@lucide/angular';

const ROLE_COLOR: Record<string, string> = {
  admin:     '#f59e0b',
  bartender: '#3b82f6',
  waiter:    '#10b981',
  kitchen:   '#ef4444',
  hookah:    '#8b5cf6',
  wardrobe:  '#64748b',
};

const ROLE_ICON: Record<string, LucideIconInput> = {
  admin:     LucideCrown,
  bartender: LucideGlassWater,
  waiter:    LucideBell,
  kitchen:   LucideChefHat,
  hookah:    LucideWind,
  wardrobe:  LucideShirt,
};

@Component({
  selector: 'app-pin-login',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideGlassWater],
  template: `
<div class="pin-screen" (click)="onScreenClick()">

  <!-- ── Logo / clock ─────────────────────────────────────────────── -->
  <div class="pin-header">
    <div class="flex items-center gap-3">
      <svg lucideGlassWater [size]="32" style="color:#f1f5f9"></svg>
      <div>
        <p class="font-bold text-lg leading-none" style="color:#f1f5f9">BAR DREAM</p>
        <p style="color:#64748b;font-size:13px">{{ timeStr() }}</p>
      </div>
    </div>
    <a href="/login" class="text-sm" style="color:#475569;text-decoration:none">Войти по паролю →</a>
  </div>

  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- Phase: select staff ─────────────────────────────────────────── -->
  @if (phase() === 'select') {
    <div class="pin-body">
      <p class="pin-hint">Нажмите своё имя</p>

      @if (loading()) {
        <div style="color:#475569;text-align:center;padding:3rem">Загрузка...</div>
      } @else if (staff().length === 0) {
        <div style="color:#475569;text-align:center;padding:3rem">
          Нет сотрудников с PIN.<br>
          <a href="/login" style="color:#3b82f6">Войти по паролю</a>
        </div>
      } @else {
        <div class="staff-grid">
          @for (s of staffWithPin(); track s.id) {
            <button class="staff-card" (click)="selectStaff(s); $event.stopPropagation()">
              <div class="staff-avatar" [style.background]="roleColor(s.role)">
                <svg [lucideIcon]="roleIcon(s.role)" [size]="26" style="color:white"></svg>
              </div>
              <span class="staff-name">{{ s.display_name }}</span>
              <span class="staff-role" [style.color]="roleColor(s.role)">{{ s.role_label }}</span>
            </button>
          }
        </div>

        @if (staffNoPinCount() > 0) {
          <p style="color:#334155;font-size:12px;text-align:center;margin-top:2rem">
            {{ staffNoPinCount() }} сотрудник(ов) без PIN —
            <a href="/login" style="color:#3b82f6">войти по паролю</a>
          </p>
        }
      }
    </div>
  }

  <!-- ═══════════════════════════════════════════════════════════════ -->
  <!-- Phase: enter PIN ────────────────────────────────────────────── -->
  @if (phase() === 'enter') {
    <div class="pin-body pin-enter">

      <!-- Who -->
      <button class="back-btn" (click)="back()">← Назад</button>

      <div class="selected-person">
        <div class="staff-avatar lg" [style.background]="roleColor(selected()!.role)">
          <svg [lucideIcon]="roleIcon(selected()!.role)" [size]="36" style="color:white"></svg>
        </div>
        <p class="staff-name lg">{{ selected()!.display_name }}</p>
        <p class="staff-role" [style.color]="roleColor(selected()!.role)">{{ selected()!.role_label }}</p>
      </div>

      <!-- PIN dots -->
      <div class="pin-dots">
        @for (i of [0,1,2,3]; track i) {
          <div class="pin-dot" [class.filled]="pin().length > i"
               [class.error]="error()"></div>
        }
      </div>

      @if (error()) {
        <p class="pin-error">{{ error() }}</p>
      } @else {
        <p style="color:#475569;font-size:13px;height:20px">&nbsp;</p>
      }

      <!-- Numpad -->
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
  }

</div>

<style>
.pin-screen {
  min-height: 100dvh;
  background: #0a0f1e;
  display: flex;
  flex-direction: column;
  user-select: none;
}

.pin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid #1e293b;
}

.pin-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1rem;
  overflow-y: auto;
}

.pin-hint {
  font-size: 1.1rem;
  color: #64748b;
  margin-bottom: 2rem;
  letter-spacing: 0.05em;
}

/* ── Staff grid ── */
.staff-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1rem;
  width: 100%;
  max-width: 700px;
}

.staff-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.25rem 0.75rem;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 1rem;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}
.staff-card:hover, .staff-card:active {
  border-color: #334155;
  background: #172033;
}

.staff-avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  opacity: 0.85;
}
.staff-avatar.lg { width: 80px; height: 80px; opacity: 1; }

.staff-icon {
  font-size: 1.6rem;
  line-height: 1;
}
.staff-icon.lg { font-size: 2rem; }

.staff-initials {
  display: none; /* shown via JS if icon fails */
  font-size: 1.2rem;
  font-weight: 700;
  color: white;
}

.staff-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #e2e8f0;
  text-align: center;
}
.staff-name.lg { font-size: 1.1rem; }

.staff-role {
  font-size: 0.75rem;
}

/* ── PIN enter ── */
.pin-enter { gap: 1.25rem; }

.back-btn {
  align-self: flex-start;
  background: none;
  border: none;
  color: #475569;
  font-size: 0.875rem;
  cursor: pointer;
  padding: 0.25rem 0;
}

.selected-person {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.pin-dots {
  display: flex;
  gap: 1rem;
  margin: 0.5rem 0;
}

.pin-dot {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 2px solid #334155;
  background: transparent;
  transition: all 0.15s;
}
.pin-dot.filled {
  background: #3b82f6;
  border-color: #3b82f6;
}
.pin-dot.error {
  background: #ef4444;
  border-color: #ef4444;
}

.pin-error {
  color: #f87171;
  font-size: 0.875rem;
  height: 20px;
  text-align: center;
}

/* ── Numpad ── */
.numpad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.625rem;
  width: 100%;
  max-width: 320px;
}

.numpad-key {
  aspect-ratio: 1.3;
  min-height: 64px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 0.75rem;
  color: #e2e8f0;
  font-size: 1.5rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.1s, border-color 0.1s;
  -webkit-tap-highlight-color: transparent;
}
.numpad-key:hover, .numpad-key:active {
  background: #172033;
  border-color: #334155;
}
.numpad-key.action {
  color: #94a3b8;
  font-size: 1.25rem;
}
.numpad-key.empty {
  background: transparent;
  border-color: transparent;
  cursor: default;
}
.numpad-key:disabled {
  opacity: 0.4;
}
</style>
  `,
})
export class PinLoginPage implements OnInit {
  phase    = signal<'select' | 'enter'>('select');
  staff    = signal<StaffMember[]>([]);
  selected = signal<StaffMember | null>(null);
  pin      = signal<string>('');
  error    = signal<string>('');
  loading  = signal(false);
  timeStr  = signal('');

  staffWithPin  = computed(() => this.staff().filter(s => s.has_pin));
  staffNoPinCount = computed(() => this.staff().filter(s => !s.has_pin).length);

  numpadKeys = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

  private _timer: any;

  constructor(
    private api: ApiService,
    private auth: AuthService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.updateClock();
    this._timer = setInterval(() => this.updateClock(), 10000);
    this.loadStaff();
  }

  ngOnDestroy() { clearInterval(this._timer); }

  private updateClock() {
    const now = new Date();
    this.timeStr.set(now.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }));
  }

  loadStaff() {
    this.loading.set(true);
    this.api.getStaffList().subscribe({
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

  onScreenClick() { /* prevent bubbling issues */ }

  submit() {
    const s = this.selected();
    if (!s || this.loading()) return;
    this.loading.set(true);

    this.api.pinLogin(s.id, this.pin()).subscribe({
      next: tokens => {
        localStorage.setItem('access_token', tokens.access);
        localStorage.setItem('refresh_token', tokens.refresh);
        this.auth.fetchProfile().subscribe(user => {
          this.loading.set(false);
          this.router.navigate([this.auth.landingRoute(user.role)]);
        });
      },
      error: err => {
        this.loading.set(false);
        this.pin.set('');
        this.error.set(err.error?.detail ?? 'Ошибка входа');
        // Shake animation — сброс через 600ms
        setTimeout(() => this.error.set(''), 2000);
      },
    });
  }

  roleColor(role: string) { return ROLE_COLOR[role] ?? '#64748b'; }
  roleIcon(role: string): LucideIconInput  { return ROLE_ICON[role] ?? LucideCrown; }

  initials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  }
}