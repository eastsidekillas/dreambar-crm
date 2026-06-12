import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationApi } from '../../entities/reservation';
import { TableApi } from '../../entities/table';
import { AuthService } from '../../core/services/auth.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Reservation, Zone } from '../../core/models';
import { LucideCalendar, LucidePhone, LucidePlus, LucideX, LucideUsers, LucidePencil, LucideArrowLeftRight } from '@lucide/angular';

const REFRESH_MS = 60_000;

/**
 * Мобильный интерфейс броней для бармена: телефон в руке, гость на линии.
 * В отличие от вкладки в барном терминале — нативная клавиатура телефона
 * (без bdKbd), полноэкранная форма и крупные элементы под палец.
 */
@Component({
  selector: 'app-bartender-reservations-mobile',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideCalendar, LucidePhone, LucidePlus, LucideX, LucideUsers, LucidePencil, LucideArrowLeftRight],
  template: `
    <div class="flex flex-col" style="height:100dvh;background:#0f172a;color:#f1f5f9">

      <!-- ── Шапка ─────────────────────────────────────────────────── -->
      <header class="flex-shrink-0 px-4 py-3 flex items-center justify-between"
              style="background:#0a0f1e;border-bottom:1px solid #1e293b">
        <div class="flex items-center gap-2.5">
          <svg lucideCalendar [size]="22" style="color:#f59e0b"></svg>
          <div class="leading-tight">
            <p class="font-bold">Брони</p>
            <p class="text-xs" style="color:#94a3b8">{{ auth.user()?.display_name }}</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          @if (auth.hasRoleChoice()) {
            <button (click)="auth.switchRole()" title="Сменить роль / интерфейс"
                    class="flex items-center justify-center rounded-xl"
                    style="background:#1e293b;min-width:40px;min-height:40px">
              <svg lucideArrowLeftRight [size]="18" style="color:#94a3b8"></svg>
            </button>
          }
          <button (click)="auth.logout()" class="text-sm px-3 rounded-xl"
                  style="background:#1e293b;color:#94a3b8;min-height:40px">
            Выйти
          </button>
        </div>
      </header>

      <!-- ── Период ────────────────────────────────────────────────── -->
      <div class="flex-shrink-0 px-3 pt-3 pb-2 flex items-center gap-2 overflow-x-auto">
        <button (click)="setToday()" class="rounded-xl font-semibold text-sm px-4 flex-shrink-0"
                [style.background]="isToday() ? '#f59e0b' : '#1e293b'"
                [style.color]="isToday() ? '#0f172a' : '#94a3b8'"
                style="min-height:44px;border:1px solid #334155">
          Сегодня
        </button>
        <button (click)="setTomorrow()" class="rounded-xl font-semibold text-sm px-4 flex-shrink-0"
                [style.background]="isTomorrow() ? '#f59e0b' : '#1e293b'"
                [style.color]="isTomorrow() ? '#0f172a' : '#94a3b8'"
                style="min-height:44px;border:1px solid #334155">
          Завтра
        </button>
        <button (click)="setWeek()" class="rounded-xl font-semibold text-sm px-4 flex-shrink-0"
                [style.background]="isWeek() ? '#f59e0b' : '#1e293b'"
                [style.color]="isWeek() ? '#0f172a' : '#94a3b8'"
                style="min-height:44px;border:1px solid #334155">
          Неделя
        </button>
        <input [ngModel]="dateFrom()" (ngModelChange)="onFromChange($event)" type="date"
               class="rounded-xl px-2.5 text-sm flex-shrink-0"
               style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;min-height:44px"/>
      </div>

      <!-- ── Список ────────────────────────────────────────────────── -->
      <div class="flex-1 min-h-0 overflow-y-auto px-3 space-y-2" style="padding-bottom:96px">
        @if (loading() && !reservations().length) {
          <p class="text-center py-8 text-sm" style="color:#64748b">Загрузка...</p>
        } @else if (!reservations().length) {
          <div class="text-center py-14">
            <svg lucideCalendar [size]="48" class="mb-3 mx-auto" style="color:#334155"></svg>
            <p class="font-bold mb-1">{{ isToday() ? 'На сегодня броней нет' : 'Броней нет' }}</p>
            <p class="text-sm" style="color:#64748b">Гость звонит — жми «Новая бронь»</p>
          </div>
        }
        @for (g of grouped(); track g.date) {
          @if (multiDay()) {
            <p class="font-bold text-sm pt-2 capitalize" style="color:#94a3b8">{{ g.label }}</p>
          }
          @for (r of g.items; track r.id) {
            <div class="rounded-xl overflow-hidden"
                 style="background:#1e293b;border:1px solid #334155"
                 [style.opacity]="r.status === 'cancelled' || r.status === 'completed' ? '0.45' : '1'">
              <div class="px-4 py-3" (click)="openEdit(r)">
                <div class="flex items-center gap-3">
                  <span class="font-bold text-2xl" style="color:#f59e0b">{{ r.time_start.slice(0,5) }}</span>
                  <p class="font-semibold flex-1 min-w-0 truncate">{{ r.name }}</p>
                  <span class="text-xs px-2 py-1 rounded-full flex-shrink-0" [style]="statusStyle(r.status)">
                    {{ r.status_label }}
                  </span>
                  <svg lucidePencil [size]="14" class="flex-shrink-0" style="color:#64748b"></svg>
                </div>
                <div class="flex items-center gap-3 mt-1 text-sm flex-wrap" style="color:#94a3b8">
                  <span class="flex items-center gap-1"><svg lucideUsers [size]="13"></svg> {{ r.guests_count }}</span>
                  @if (r.table_number) {
                    <span>стол {{ r.table_number }}</span>
                  }
                  @if (r.phone) {
                    <a [href]="'tel:' + r.phone" class="flex items-center gap-1" style="color:#60a5fa"
                       (click)="$event.stopPropagation()">
                      <svg lucidePhone [size]="13"></svg> {{ r.phone }}
                    </a>
                  }
                  @if (+r.deposit_amount > 0) {
                    <span [style.color]="r.deposit_paid ? '#4ade80' : '#f59e0b'">
                      депозит {{ r.deposit_amount | number:'1.0-0' }} ₽ {{ r.deposit_paid ? '✓' : '— не оплачен' }}
                    </span>
                  }
                </div>
                @if (r.wishes) {
                  <p class="text-xs mt-1 truncate" style="color:#64748b">{{ r.wishes }}</p>
                }
              </div>
              @if (r.status === 'pending' || r.status === 'confirmed') {
                <button (click)="arrived(r)"
                        class="w-full font-bold text-sm"
                        style="background:#14532d;color:#4ade80;min-height:44px;border-top:1px solid #166534">
                  Гость пришёл
                </button>
              }
            </div>
          }
        }
      </div>

      <!-- ── Новая бронь ───────────────────────────────────────────── -->
      <div class="fixed bottom-0 left-0 right-0 z-30 px-3 pb-3 pt-2 safe-bottom"
           style="background:linear-gradient(transparent,#0f172a 40%)">
        <button (click)="openForm()"
                class="w-full rounded-xl font-bold flex items-center justify-center gap-2"
                style="background:#f59e0b;color:#0f172a;min-height:54px;box-shadow:0 4px 16px rgba(245,158,11,0.35)">
          <svg lucidePlus [size]="20"></svg> Новая бронь
        </button>
      </div>
    </div>

    <!-- ── Форма: на весь экран ─────────────────────────────────────── -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-50 flex flex-col" style="background:#0f172a;color:#f1f5f9">
        <header class="flex-shrink-0 px-4 py-3 flex items-center justify-between"
                style="background:#0a0f1e;border-bottom:1px solid #1e293b">
          <p class="font-bold text-lg truncate">
            {{ editing() ? 'Бронь — ' + editing()!.name : 'Новая бронь' }}
          </p>
          <button (click)="closeForm()" class="flex items-center justify-center rounded-xl flex-shrink-0"
                  style="background:#1e293b;min-width:44px;min-height:44px">
            <svg lucideX [size]="20" style="color:#94a3b8"></svg>
          </button>
        </header>

        <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
          <div>
            <p class="text-xs mb-1" style="color:#94a3b8">Имя гостя *</p>
            <input [(ngModel)]="form.name" class="w-full px-3 rounded-xl"
                   placeholder="Иван"
                   style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px"/>
          </div>
          <div>
            <p class="text-xs mb-1" style="color:#94a3b8">Телефон</p>
            <input [(ngModel)]="form.phone" type="tel" inputmode="tel" class="w-full px-3 rounded-xl"
                   placeholder="+7..."
                   style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px"/>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Дата</p>
              <input [(ngModel)]="form.date" type="date" class="w-full px-3 rounded-xl"
                     style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px"/>
            </div>
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Время *</p>
              <input [(ngModel)]="form.time_start" type="time" class="w-full px-3 rounded-xl"
                     style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px"/>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Гостей</p>
              <div class="flex items-center rounded-xl overflow-hidden"
                   style="border:1px solid #334155;background:#1e293b">
                <button (click)="stepGuests(-1)" class="font-bold text-xl"
                        style="min-width:48px;min-height:48px;color:#94a3b8">−</button>
                <span class="flex-1 text-center font-bold text-lg">{{ form.guests_count }}</span>
                <button (click)="stepGuests(1)" class="font-bold text-xl"
                        style="min-width:48px;min-height:48px;color:#94a3b8">+</button>
              </div>
            </div>
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Стол</p>
              <select [(ngModel)]="form.table" class="w-full px-3 rounded-xl"
                      style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px">
                <option [ngValue]="null">Не выбран</option>
                @for (z of zones(); track z.id) {
                  <optgroup [label]="z.name">
                    @for (t of z.tables; track t.id) {
                      <option [ngValue]="t.id">{{ t.number }} ({{ t.seats }} мест)</option>
                    }
                  </optgroup>
                }
              </select>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Депозит ₽</p>
              <input [(ngModel)]="form.deposit_amount" type="number" min="0" inputmode="numeric"
                     placeholder="0" class="w-full px-3 rounded-xl"
                     style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px"/>
            </div>
            @if (form.deposit_amount > 0) {
              <div>
                <p class="text-xs mb-1" style="color:#94a3b8">Депозит как</p>
                <select [(ngModel)]="form.deposit_method" class="w-full px-3 rounded-xl"
                        style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px">
                  <option value="cash">Наличные</option>
                  <option value="transfer">Перевод</option>
                </select>
              </div>
            }
          </div>
          <div>
            <p class="text-xs mb-1" style="color:#94a3b8">Пожелания</p>
            <input [(ngModel)]="form.wishes" class="w-full px-3 rounded-xl"
                   placeholder="У окна, кальян..."
                   style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;min-height:48px"/>
          </div>

          @if (editing(); as r) {
            @if (+r.deposit_amount > 0 && !r.deposit_paid) {
              <button (click)="markDepositPaid(r)" [disabled]="saving()"
                      class="w-full rounded-xl font-semibold text-sm"
                      style="background:#14532d;color:#4ade80;border:1px solid #166534;min-height:48px">
                ✓ Депозит {{ r.deposit_amount | number:'1.0-0' }} ₽ оплачен
              </button>
            }
            @if (r.status !== 'cancelled' && r.status !== 'completed') {
              @if (confirmCancel()) {
                <div class="flex gap-2">
                  <button (click)="cancelReservation(r)" [disabled]="saving()"
                          class="flex-1 rounded-xl font-bold text-sm"
                          style="background:#ef4444;color:white;min-height:48px">
                    Да, отменить бронь
                  </button>
                  <button (click)="confirmCancel.set(false)"
                          class="flex-1 rounded-xl font-semibold text-sm"
                          style="background:#1e293b;color:#94a3b8;border:1px solid #334155;min-height:48px">
                    Нет
                  </button>
                </div>
              } @else {
                <button (click)="confirmCancel.set(true)"
                        class="w-full rounded-xl font-semibold text-sm"
                        style="background:#1e293b;color:#ef4444;border:1px solid #7f1d1d;min-height:48px">
                  Отменить бронь
                </button>
              }
            }
          }
        </div>

        <div class="flex-shrink-0 p-3 safe-bottom" style="background:#0a0f1e;border-top:1px solid #1e293b">
          <button (click)="save()" [disabled]="saving() || !form.name.trim() || !form.time_start"
                  class="w-full rounded-xl font-bold"
                  [style.opacity]="!form.name.trim() || !form.time_start ? '0.5' : '1'"
                  style="background:#f59e0b;color:#0f172a;min-height:54px">
            {{ saving() ? 'Сохранение...' : (editing() ? 'Сохранить изменения' : 'Сохранить бронь') }}
          </button>
        </div>
      </div>
    }
  `,
})
export class BartenderReservationsMobilePage implements OnInit, OnDestroy {
  readonly auth = inject(AuthService);
  private reservationApi = inject(ReservationApi);
  private tableApi = inject(TableApi);
  private toast = inject(ToastService);

  reservations = signal<Reservation[]>([]);
  loading  = signal(false);
  formOpen = signal(false);
  saving   = signal(false);
  zones    = signal<Zone[]>([]);
  editing  = signal<Reservation | null>(null);
  confirmCancel = signal(false);
  dateFrom = signal(this.todayStr());
  dateTo   = signal(this.todayStr());
  form = this.emptyForm();

  private timer?: ReturnType<typeof setInterval>;

  grouped = computed(() => {
    const groups = new Map<string, Reservation[]>();
    for (const r of this.reservations()) {
      (groups.get(r.date) ?? groups.set(r.date, []).get(r.date)!).push(r);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({ date, label: this.dateLabel(date), items }));
  });

  multiDay = computed(() => this.dateFrom() !== this.dateTo());

  ngOnInit() {
    this.loadReservations();
    this.timer = setInterval(() => { if (!this.formOpen()) this.loadReservations(); }, REFRESH_MS);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private todayStr(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private plusDays(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  }

  private emptyForm() {
    return {
      name: '', phone: '',
      date: this.dateFrom(),
      time_start: '',
      guests_count: 2,
      table: null as number | null,
      deposit_amount: 0,
      deposit_method: 'cash' as 'cash' | 'transfer',
      wishes: '',
    };
  }

  dateLabel(date: string): string {
    return new Date(date + 'T00:00:00')
      .toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  }

  isToday(): boolean {
    const t = this.todayStr();
    return this.dateFrom() === t && this.dateTo() === t;
  }

  isTomorrow(): boolean {
    const t = this.plusDays(1);
    return this.dateFrom() === t && this.dateTo() === t;
  }

  isWeek(): boolean {
    return this.dateFrom() === this.todayStr() && this.dateTo() === this.plusDays(6);
  }

  setToday()    { this.setRange(this.todayStr(), this.todayStr()); }
  setTomorrow() { this.setRange(this.plusDays(1), this.plusDays(1)); }
  setWeek()     { this.setRange(this.todayStr(), this.plusDays(6)); }

  private setRange(from: string, to: string) {
    this.dateFrom.set(from);
    this.dateTo.set(to);
    this.loadReservations();
  }

  /** Одиночный date-input в шапке: показываем выбранный день */
  onFromChange(v: string) {
    if (!v) return;
    this.setRange(v, v);
  }

  stepGuests(d: number) {
    this.form.guests_count = Math.max(1, (this.form.guests_count || 1) + d);
  }

  loadReservations() {
    this.loading.set(true);
    this.reservationApi.getReservations({ date_from: this.dateFrom(), date_to: this.dateTo() }).subscribe({
      next: list => {
        this.reservations.set([...list].sort((a, b) =>
          a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openForm() {
    this.editing.set(null);
    this.form = this.emptyForm();
    this.formOpen.set(true);
    this.loadZones();
  }

  openEdit(r: Reservation) {
    this.editing.set(r);
    this.confirmCancel.set(false);
    this.form = {
      name: r.name,
      phone: r.phone || '',
      date: r.date,
      time_start: r.time_start.slice(0, 5),
      guests_count: r.guests_count,
      table: r.table,
      deposit_amount: +r.deposit_amount || 0,
      deposit_method: (r.deposit_method || 'cash') as 'cash' | 'transfer',
      wishes: r.wishes || '',
    };
    this.formOpen.set(true);
    this.loadZones();
  }

  closeForm() {
    this.formOpen.set(false);
    this.editing.set(null);
    this.confirmCancel.set(false);
  }

  private loadZones() {
    if (!this.zones().length) {
      this.tableApi.getZones().subscribe(z => this.zones.set(z));
    }
  }

  save() {
    if (!this.form.name.trim() || !this.form.time_start || this.saving()) return;
    this.saving.set(true);
    const f = this.form;
    const payload = {
      name: f.name.trim(),
      phone: f.phone.trim(),
      date: f.date,
      time_start: f.time_start,
      guests_count: f.guests_count || 1,
      table: f.table,
      wishes: f.wishes.trim(),
      deposit_amount: +f.deposit_amount || 0,
      deposit_method: (+f.deposit_amount > 0 ? f.deposit_method : '') as Reservation['deposit_method'],
    };
    const editing = this.editing();
    const req = editing
      ? this.reservationApi.updateReservation(editing.id, payload)
      : this.reservationApi.createReservation(payload);
    req.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.toast.success(editing ? 'Бронь обновлена' : 'Бронь сохранена');
        this.loadReservations();
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Не удалось сохранить бронь');
      },
    });
  }

  cancelReservation(r: Reservation) {
    if (this.saving()) return;
    this.saving.set(true);
    this.reservationApi.setReservationStatus(r.id, 'cancelled').subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.toast.success('Бронь отменена');
        this.loadReservations();
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Не удалось отменить бронь');
      },
    });
  }

  markDepositPaid(r: Reservation) {
    if (this.saving()) return;
    this.saving.set(true);
    this.reservationApi.markReservationDeposit(r.id, true).subscribe({
      next: updated => {
        this.saving.set(false);
        this.editing.set(updated);
        this.reservations.update(list => list.map(x => x.id === r.id ? updated : x));
        this.toast.success('Депозит отмечен оплаченным');
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Не удалось отметить депозит');
      },
    });
  }

  arrived(r: Reservation) {
    this.reservationApi.setReservationStatus(r.id, 'arrived').subscribe({
      next: updated => this.reservations.update(list => list.map(x => x.id === r.id ? updated : x)),
      error: err => this.toast.apiError(err, 'Не удалось обновить статус'),
    });
  }

  statusStyle(status: string): string {
    if (status === 'pending')   return 'background:#f59e0b22;color:#f59e0b';
    if (status === 'confirmed') return 'background:#22c55e22;color:#4ade80';
    if (status === 'arrived')   return 'background:#3b82f622;color:#60a5fa';
    if (status === 'cancelled') return 'background:#ef444422;color:#ef4444';
    return 'background:#334155;color:#94a3b8';
  }
}