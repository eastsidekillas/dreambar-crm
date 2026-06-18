import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationApi } from '../../../entities/reservation';
import { TableApi, zoneOfTableId, zonePolicy } from '../../../entities/table';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TouchKeyboardDirective, TouchKeyboardService } from '../../../shared/ui';
import { Reservation, Zone } from '../../../core/models';
import { LucideCalendar, LucidePhone, LucidePencil } from '@lucide/angular';

/**
 * Вкладка «Брони»: список на день или диапазон дат + шторка создания/редактирования.
 * Самодостаточна (сама грузит данные); страница держит её живой
 * через [visible], чтобы недозаполненная форма переживала смену вкладок.
 */
@Component({
  selector: 'bar-reservations-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, TouchKeyboardDirective, LucideCalendar, LucidePhone, LucidePencil],
  host: { '[style.display]': "visible ? 'contents' : 'none'" },
  template: `
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">

      <div class="px-3 pt-3 pb-2 flex items-center gap-2 flex-wrap flex-shrink-0">
        <button (click)="setToday()" class="rounded-xl font-semibold text-sm px-4"
                [style.background]="isToday() ? '#f59e0b' : '#1e293b'"
                [style.color]="isToday() ? '#0f172a' : '#94a3b8'"
                style="min-height:44px;border:1px solid #334155">
          Сегодня
        </button>
        <button (click)="setTomorrow()" class="rounded-xl font-semibold text-sm px-4"
                [style.background]="isTomorrow() ? '#f59e0b' : '#1e293b'"
                [style.color]="isTomorrow() ? '#0f172a' : '#94a3b8'"
                style="min-height:44px;border:1px solid #334155">
          Завтра
        </button>
        <button (click)="setWeek()" class="rounded-xl font-semibold text-sm px-4"
                [style.background]="isWeek() ? '#f59e0b' : '#1e293b'"
                [style.color]="isWeek() ? '#0f172a' : '#94a3b8'"
                style="min-height:44px;border:1px solid #334155">
          Неделя
        </button>
        <div class="flex items-center gap-1.5">
          <input [ngModel]="dateFrom()" (ngModelChange)="onFromChange($event)" type="date"
                 class="rounded-xl px-2.5 text-sm"
                 style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;min-height:44px"/>
          <span style="color:#64748b">—</span>
          <input [ngModel]="dateTo()" (ngModelChange)="onToChange($event)" type="date"
                 class="rounded-xl px-2.5 text-sm"
                 style="background:#0f172a;border:1px solid #334155;color:#f1f5f9;min-height:44px"/>
        </div>
        <button (click)="openForm()"
                class="ml-auto rounded-xl font-bold flex items-center gap-2 px-5"
                style="background:#f59e0b;color:#0f172a;min-height:48px">
          + Бронь
        </button>
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-6 space-y-2">
        @if (loading()) {
          <p class="text-center py-8 text-sm" style="color:#64748b">Загрузка...</p>
        } @else if (!reservations().length) {
          <div class="text-center py-12">
            <svg lucideCalendar [size]="48" class="mb-3 mx-auto" style="color:#334155"></svg>
            <p class="font-bold mb-1">{{ isToday() ? 'На сегодня броней нет' : 'Броней нет' }}</p>
            <p class="text-sm" style="color:#64748b">Гость звонит — жми «+ Бронь»</p>
          </div>
        }
        @for (g of grouped(); track g.date) {
          @if (multiDay()) {
            <p class="font-bold text-sm pt-2 capitalize" style="color:#94a3b8">{{ g.label }}</p>
          }
          @for (r of g.items; track r.id) {
            <div class="rounded-xl px-4 py-3 cursor-pointer"
                 style="background:#1e293b;border:1px solid #334155"
                 [style.opacity]="r.status === 'cancelled' || r.status === 'completed' ? '0.45' : '1'"
                 (click)="openEdit(r)">
              <div class="flex items-center gap-3 flex-wrap">
                <span class="font-bold text-xl" style="color:#f59e0b">{{ r.time_start.slice(0,5) }}</span>
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate">
                    {{ r.name }}
                    <span class="font-normal text-sm" style="color:#64748b">· {{ r.guests_count }} чел</span>
                    @if (r.table_number) {
                      <span class="font-normal text-sm" style="color:#64748b">· {{ r.table_number }}</span>
                    }
                  </p>
                  <p class="text-xs flex items-center gap-2" style="color:#94a3b8">
                    @if (r.phone) {
                      <a [href]="'tel:' + r.phone" class="flex items-center gap-1" style="color:#94a3b8"
                         (click)="$event.stopPropagation()">
                        <svg lucidePhone [size]="11"></svg> {{ r.phone }}
                      </a>
                    }
                    @if (+r.deposit_amount > 0) {
                      <span [style.color]="r.deposit_paid ? '#4ade80' : '#f59e0b'">
                        депозит {{ r.deposit_amount | number:'1.0-0' }} ₽ {{ r.deposit_paid ? '✓' : '— не оплачен' }}
                      </span>
                    }
                  </p>
                  @if (r.wishes) {
                    <p class="text-xs mt-0.5 truncate" style="color:#64748b">{{ r.wishes }}</p>
                  }
                </div>
                <span class="text-xs px-2 py-1 rounded-full flex-shrink-0" [style]="statusStyle(r.status)">
                  {{ r.status_label }}
                </span>
                <svg lucidePencil [size]="14" class="flex-shrink-0" style="color:#64748b"></svg>
                @if (r.status === 'pending' || r.status === 'confirmed') {
                  <button (click)="arrived(r); $event.stopPropagation()"
                          class="rounded-xl font-bold flex-shrink-0"
                          style="background:#22c55e;color:#0f172a;min-height:44px;padding:0 14px;font-size:0.85rem">
                    Пришёл
                  </button>
                }
              </div>
            </div>
          }
        }
      </div>
    </div>

    <!-- Шторка: новая бронь / редактирование -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center"
           style="background:rgba(0,0,0,0.75)" (click)="closeForm()">
        <div class="w-full max-w-md rounded-t-2xl p-5 overflow-y-auto"
             style="background:#1e293b;border-top:1px solid #334155;max-height:90dvh"
             [style.margin-bottom]="kbd.active() ? '252px' : '0'"
             (click)="$event.stopPropagation()">
          <p class="font-bold text-lg mb-4">
            {{ editing() ? 'Бронь — ' + editing()!.name : 'Новая бронь' }}
          </p>

          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="col-span-2">
              <p class="text-xs mb-1" style="color:#94a3b8">Имя гостя *</p>
              <input [(ngModel)]="form.name" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     placeholder="Иван" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
            <div class="col-span-2">
              <p class="text-xs mb-1" style="color:#94a3b8">Телефон</p>
              <input [(ngModel)]="form.phone" type="tel" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     placeholder="+7..." style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Дата</p>
              <input [(ngModel)]="form.date" type="date" class="w-full px-3 py-2.5 rounded-xl"
                     style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Время *</p>
              <input [(ngModel)]="form.time_start" type="time" class="w-full px-3 py-2.5 rounded-xl"
                     style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Гостей</p>
              <input [(ngModel)]="form.guests_count" type="number" min="1" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Стол</p>
              <select [(ngModel)]="form.table" (ngModelChange)="applyDepositPolicy()" class="w-full px-3 py-2.5 rounded-xl"
                      style="background:#0f172a;border:1px solid #334155;color:#f1f5f9">
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
            @if (depositEnabled()) {
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Депозит ₽ @if (depositMin() > 0) { · мин. {{ depositMin() | number:'1.0-0' }} }</p>
              <input [(ngModel)]="form.deposit_amount" type="number" [min]="depositMin()" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     [placeholder]="depositMin() || 0" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
            @if (form.deposit_amount > 0) {
              <div>
                <p class="text-xs mb-1" style="color:#94a3b8">Депозит как</p>
                <select [(ngModel)]="form.deposit_method" class="w-full px-3 py-2.5 rounded-xl"
                        style="background:#0f172a;border:1px solid #334155;color:#f1f5f9">
                  <option value="cash">Наличные</option>
                  <option value="transfer">Перевод</option>
                </select>
              </div>
            }
            }
            <div class="col-span-2">
              <p class="text-xs mb-1" style="color:#94a3b8">Пожелания</p>
              <input [(ngModel)]="form.wishes" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     placeholder="У окна, кальян..." style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
          </div>

          @if (editing(); as r) {
            @if (+r.deposit_amount > 0 && !r.deposit_paid) {
              <button (click)="markDepositPaid(r)" [disabled]="saving()"
                      class="w-full py-3 rounded-xl font-semibold text-sm mb-2"
                      style="background:#14532d;color:#4ade80;border:1px solid #166534">
                ✓ Депозит {{ r.deposit_amount | number:'1.0-0' }} ₽ оплачен
              </button>
            }
            @if (r.status !== 'cancelled' && r.status !== 'completed') {
              @if (confirmCancel()) {
                <div class="flex gap-2 mb-2">
                  <button (click)="cancelReservation(r)" [disabled]="saving()"
                          class="flex-1 py-3 rounded-xl font-bold text-sm"
                          style="background:#ef4444;color:white;border:none">
                    Да, отменить бронь
                  </button>
                  <button (click)="confirmCancel.set(false)"
                          class="flex-1 py-3 rounded-xl font-semibold text-sm"
                          style="background:#0f172a;color:#94a3b8;border:1px solid #334155">
                    Нет
                  </button>
                </div>
              } @else {
                <button (click)="confirmCancel.set(true)"
                        class="w-full py-3 rounded-xl font-semibold text-sm mb-2"
                        style="background:#0f172a;color:#ef4444;border:1px solid #7f1d1d">
                  Отменить бронь
                </button>
              }
            }
          }

          <div class="flex gap-2">
            <button (click)="closeForm()"
                    class="flex-1 py-3 rounded-xl font-semibold text-sm"
                    style="background:#0f172a;color:#94a3b8;border:1px solid #334155">
              Закрыть
            </button>
            <button (click)="save()" [disabled]="saving() || !form.name.trim() || !form.time_start"
                    class="flex-1 py-3 rounded-xl font-bold text-sm"
                    [style.opacity]="!form.name.trim() || !form.time_start ? '0.5' : '1'"
                    style="background:#f59e0b;color:#0f172a;border:none">
              {{ saving() ? 'Сохранение...' : (editing() ? 'Сохранить изменения' : 'Сохранить бронь') }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BarReservationsTab implements OnInit, OnChanges {
  @Input() visible = false;
  /** Число активных броней на сегодня — для бейджа на кнопке вкладки */
  @Output() todayCount = new EventEmitter<number>();

  private reservationApi = inject(ReservationApi);
  private tableApi = inject(TableApi);
  private toast    = inject(ToastService);
  readonly kbd     = inject(TouchKeyboardService);

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

  /** Брони, сгруппированные по дням (для диапазона дат) */
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

  ngOnInit() { this.loadReservations(); }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['visible'] && !ch['visible'].firstChange) {
      if (this.visible) this.loadReservations();
      else this.closeForm();
    }
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

  /** Депозит — только в VIP-зоне выбранного стола (флаг зоны, без хардкода). */
  depositEnabled(): boolean { return zonePolicy(zoneOfTableId(this.zones(), this.form.table)).enabled; }
  depositMin(): number { return zonePolicy(zoneOfTableId(this.zones(), this.form.table)).min; }
  applyDepositPolicy() {
    const p = zonePolicy(zoneOfTableId(this.zones(), this.form.table));
    if (!p.enabled) this.form.deposit_amount = 0;
    else if (p.min > 0 && !this.form.deposit_amount) this.form.deposit_amount = p.min;
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

  onFromChange(v: string) {
    if (!v) return;
    this.dateFrom.set(v);
    if (this.dateTo() < v) this.dateTo.set(v);
    this.loadReservations();
  }

  onToChange(v: string) {
    if (!v) return;
    this.dateTo.set(v);
    if (this.dateFrom() > v) this.dateFrom.set(v);
    this.loadReservations();
  }

  loadReservations() {
    this.loading.set(true);
    this.reservationApi.getReservations({ date_from: this.dateFrom(), date_to: this.dateTo() }).subscribe({
      next: list => {
        this.reservations.set([...list].sort((a, b) =>
          a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start)));
        this.loading.set(false);
        this.emitCount();
      },
      error: () => this.loading.set(false),
    });
  }

  private emitCount() {
    const today = this.todayStr();
    // Бейдж показывает брони на сегодня — обновляем, только если сегодня попадает в выборку
    if (this.dateFrom() > today || this.dateTo() < today) return;
    this.todayCount.emit(
      this.reservations().filter(r =>
        r.date === today && (r.status === 'pending' || r.status === 'confirmed')).length
    );
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
      next: updated => {
        this.reservations.update(list => list.map(x => x.id === r.id ? updated : x));
        this.emitCount();
      },
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