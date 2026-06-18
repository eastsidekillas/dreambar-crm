import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { EmployeeApi } from '../../../entities/employee';
import { OrderApi } from '../../../entities/order';
import { ShiftApi } from '../../../entities/shift';
import { AuthService } from '../../../core/services/auth.service';
import { ToastService } from '../../../shared/ui';
import { Shift } from '../../../core/models';
import { LucideLogOut, LucideKeyRound, LucideArrowLeftRight } from '@lucide/angular';
import { ROLE_LABEL } from '../../../shared/lib/roles';

@Component({
  selector: 'app-waiter-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideLogOut, LucideKeyRound, LucideArrowLeftRight],
  styles: [`
    .profile-avatar {
      width: 64px; height: 64px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--color-gold), var(--color-gold-hover));
      color: #fff; font-weight: 700; font-size: 1.5rem; flex-shrink: 0;
    }
    .stat-tile {
      text-align: center; padding: 0.75rem 0.5rem;
      background: var(--color-surface2); border-radius: 0.75rem;
    }
    .pin-field {
      width: 100%; padding: 12px 14px; border-radius: 0.75rem;
      border: 1.5px solid var(--color-border); background: var(--color-surface);
      font-size: 1.1rem; letter-spacing: 0.4em; text-align: center;
    }
    .pin-field:focus { border-color: var(--color-gold); outline: none; }
  `],
  template: `
    <div class="space-y-3 max-w-md mx-auto">

      <!-- ── Кто я ─────────────────────────────────────── -->
      <div class="card flex items-center gap-4">
        <div class="profile-avatar">{{ initial() }}</div>
        <div class="min-w-0">
          <p class="font-bold text-lg leading-tight truncate">{{ name() }}</p>
          <p class="text-sm" style="color:var(--color-gold-hover)">{{ roleLabel() }}</p>
          <p class="text-xs" style="color:var(--color-muted)">&#64;{{ auth.user()?.username }}</p>
        </div>
      </div>

      <!-- ── Моя смена ─────────────────────────────────── -->
      <div class="card">
        <h3 class="font-semibold text-sm mb-3">Моя смена</h3>
        @if (shift()) {
          <div class="grid grid-cols-2 gap-2">
            <div class="stat-tile">
              <p class="text-xl font-bold">{{ openTables() }}</p>
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">открытых столов</p>
            </div>
            <div class="stat-tile">
              <p class="text-xl font-bold">{{ receiptsCount() }}</p>
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">чеков пробито</p>
            </div>
          </div>
        } @else {
          <p class="text-sm text-center py-3" style="color:var(--color-muted)">
            Смена не открыта — показатели появятся после открытия
          </p>
        }
      </div>

      <!-- ── PIN ───────────────────────────────────────── -->
      <div class="card">
        <h3 class="font-semibold text-sm mb-1 flex items-center gap-1.5">
          <svg lucideKeyRound [size]="15"></svg>
          {{ hasPin() ? 'Сменить PIN-код' : 'Установить PIN-код' }}
        </h3>
        <p class="text-xs mb-3" style="color:var(--color-muted)">
          PIN из 4 цифр — для быстрого входа с общего экрана
        </p>

        <div class="space-y-2.5">
          @if (hasPin()) {
            <input class="pin-field" type="password" inputmode="numeric" maxlength="4"
                   placeholder="Текущий PIN" [(ngModel)]="currentPin" autocomplete="off">
          }
          <input class="pin-field" type="password" inputmode="numeric" maxlength="4"
                 placeholder="Новый PIN" [(ngModel)]="newPin" autocomplete="off">
          <input class="pin-field" type="password" inputmode="numeric" maxlength="4"
                 placeholder="Повторите новый PIN" [(ngModel)]="confirmPin" autocomplete="off">

          <button class="btn btn-primary btn-full" (click)="savePin()" [disabled]="saving()">
            {{ saving() ? 'Сохранение...' : (hasPin() ? 'Сменить PIN' : 'Установить PIN') }}
          </button>
        </div>
      </div>

      <!-- ── Смена роли / выход ────────────────────────── -->
      @if (auth.hasRoleChoice()) {
        <button (click)="auth.switchRole()"
                class="btn btn-full flex items-center justify-center gap-2"
                style="background:var(--color-surface);color:var(--color-text);border:1.5px solid var(--color-border);min-height:48px"
                title="Вернуться к выбору роли без выхода из аккаунта">
          <svg lucideArrowLeftRight [size]="16"></svg> Сменить роль
        </button>
      }

      <button (click)="logout()"
              class="btn btn-full flex items-center justify-center gap-2"
              style="background:var(--color-red-bg);color:var(--color-red);border:none;min-height:48px"
              title="Выйти из аккаунта — вернётесь на экран PIN-входа">
        <svg lucideLogOut [size]="16"></svg> Выйти из аккаунта
      </button>
    </div>
  `,
})
export class WaiterProfilePage implements OnInit {
  auth = inject(AuthService);

  shift         = signal<Shift | null>(null);
  openTables    = signal(0);
  receiptsCount = signal(0);
  saving        = signal(false);
  hasPin        = signal(false);

  currentPin = '';
  newPin     = '';
  confirmPin = '';

  name      = computed(() => this.auth.user()?.display_name || this.auth.user()?.username || '—');
  initial   = computed(() => (this.name()[0] || '?').toUpperCase());
  roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? ''] ?? '');

  constructor(private employeeApi: EmployeeApi, private orderApi: OrderApi, private shiftApi: ShiftApi, private toast: ToastService) {}

  ngOnInit() {
    this.hasPin.set(!!this.auth.user()?.has_pin);
    // has_pin мог не попасть в localStorage от старой сессии — обновляем профиль
    this.auth.fetchProfile().subscribe(u => this.hasPin.set(!!u.has_pin));
    this.loadStats();
  }

  private loadStats() {
    this.shiftApi.getCurrentShift().pipe(catchError(() => of(null))).subscribe(shift => {
      this.shift.set(shift);
      if (!shift) return;
      forkJoin({
        orders:   this.orderApi.getMyOrders().pipe(catchError(() => of([]))),
        receipts: this.orderApi.getReceipts(shift.id).pipe(catchError(() => of([]))),
      }).subscribe(({ orders, receipts }) => {
        const me = this.auth.user()?.id;
        const mine = receipts.filter(r => r.waiter === me);
        this.openTables.set(orders.filter(o => o.status === 'open').length);
        this.receiptsCount.set(mine.length);
      });
    });
  }

  savePin() {
    const pin = this.newPin.trim();
    if (!/^\d{4}$/.test(pin)) { this.toast.error('PIN должен состоять из 4 цифр'); return; }
    if (pin !== this.confirmPin.trim()) { this.toast.error('PIN-коды не совпадают'); return; }
    if (this.hasPin() && !this.currentPin.trim()) { this.toast.error('Введите текущий PIN'); return; }

    this.saving.set(true);
    this.employeeApi.setMyPin(pin, this.hasPin() ? this.currentPin.trim() : undefined).subscribe({
      next: () => {
        this.saving.set(false);
        this.hasPin.set(true);
        this.currentPin = this.newPin = this.confirmPin = '';
        this.toast.success('PIN обновлён');
      },
      error: err => {
        this.saving.set(false);
        this.toast.error(err.error?.detail ?? 'Не удалось обновить PIN');
      },
    });
  }

  logout() { this.auth.logout(); }
}
