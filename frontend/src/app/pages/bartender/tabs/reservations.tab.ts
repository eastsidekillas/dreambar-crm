import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ReservationApi } from '../../../entities/reservation';
import { TableApi } from '../../../entities/table';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { TouchKeyboardDirective, TouchKeyboardService } from '../../../shared/ui';
import { Reservation, Zone } from '../../../core/models';
import { LucideCalendar, LucidePhone } from '@lucide/angular';

/**
 * Вкладка «Брони»: список на сегодня + шторка создания брони.
 * Самодостаточна (сама грузит данные); страница держит её живой
 * через [visible], чтобы недозаполненная форма переживала смену вкладок.
 */
@Component({
  selector: 'bar-reservations-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, TouchKeyboardDirective, LucideCalendar, LucidePhone],
  host: { '[style.display]': "visible ? 'contents' : 'none'" },
  template: `
    <div class="flex-1 min-h-0 flex flex-col overflow-hidden">

      <div class="px-3 py-3 flex items-center gap-3 flex-shrink-0">
        <p class="font-bold">Брони на сегодня</p>
        <span class="text-sm" style="color:#64748b">{{ todayLabel() }}</span>
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
            <p class="font-bold mb-1">На сегодня броней нет</p>
            <p class="text-sm" style="color:#64748b">Гость звонит — жми «+ Бронь»</p>
          </div>
        }
        @for (r of reservations(); track r.id) {
          <div class="rounded-xl px-4 py-3"
               style="background:#1e293b;border:1px solid #334155"
               [style.opacity]="r.status === 'cancelled' || r.status === 'completed' ? '0.45' : '1'">
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
                    <a [href]="'tel:' + r.phone" class="flex items-center gap-1" style="color:#94a3b8">
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
              @if (r.status === 'pending' || r.status === 'confirmed') {
                <button (click)="arrived(r)"
                        class="rounded-xl font-bold flex-shrink-0"
                        style="background:#22c55e;color:#0f172a;min-height:44px;padding:0 14px;font-size:0.85rem">
                  Пришёл
                </button>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Шторка: новая бронь -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-50 flex items-end justify-center"
           style="background:rgba(0,0,0,0.75)" (click)="formOpen.set(false)">
        <div class="w-full max-w-md rounded-t-2xl p-5 overflow-y-auto"
             style="background:#1e293b;border-top:1px solid #334155;max-height:90dvh"
             [style.margin-bottom]="kbd.active() ? '252px' : '0'"
             (click)="$event.stopPropagation()">
          <p class="font-bold text-lg mb-4">Новая бронь</p>

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
              <select [(ngModel)]="form.table" class="w-full px-3 py-2.5 rounded-xl"
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
            <div>
              <p class="text-xs mb-1" style="color:#94a3b8">Депозит ₽</p>
              <input [(ngModel)]="form.deposit_amount" type="number" min="0" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     placeholder="0" style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
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
            <div class="col-span-2">
              <p class="text-xs mb-1" style="color:#94a3b8">Пожелания</p>
              <input [(ngModel)]="form.wishes" bdKbd class="w-full px-3 py-2.5 rounded-xl"
                     placeholder="У окна, кальян..." style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
            </div>
          </div>

          <div class="flex gap-2">
            <button (click)="formOpen.set(false)"
                    class="flex-1 py-3 rounded-xl font-semibold text-sm"
                    style="background:#0f172a;color:#94a3b8;border:1px solid #334155">
              Отмена
            </button>
            <button (click)="save()" [disabled]="saving() || !form.name.trim() || !form.time_start"
                    class="flex-1 py-3 rounded-xl font-bold text-sm"
                    [style.opacity]="!form.name.trim() || !form.time_start ? '0.5' : '1'"
                    style="background:#f59e0b;color:#0f172a;border:none">
              {{ saving() ? 'Сохранение...' : 'Сохранить бронь' }}
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
  form = this.emptyForm();

  ngOnInit() { this.loadReservations(); }

  ngOnChanges(ch: SimpleChanges) {
    if (ch['visible'] && !ch['visible'].firstChange) {
      if (this.visible) this.loadReservations();
      else this.formOpen.set(false);
    }
  }

  private emptyForm() {
    return {
      name: '', phone: '',
      date: new Date().toISOString().slice(0, 10),
      time_start: '',
      guests_count: 2,
      table: null as number | null,
      deposit_amount: 0,
      deposit_method: 'cash' as 'cash' | 'transfer',
      wishes: '',
    };
  }

  todayLabel(): string {
    return new Date().toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  }

  loadReservations() {
    this.loading.set(true);
    const today = new Date().toISOString().slice(0, 10);
    this.reservationApi.getReservations({ date: today }).subscribe({
      next: list => {
        this.reservations.set([...list].sort((a, b) => a.time_start.localeCompare(b.time_start)));
        this.loading.set(false);
        this.emitCount();
      },
      error: () => this.loading.set(false),
    });
  }

  private emitCount() {
    this.todayCount.emit(
      this.reservations().filter(r => r.status === 'pending' || r.status === 'confirmed').length
    );
  }

  openForm() {
    this.form = this.emptyForm();
    this.formOpen.set(true);
    if (!this.zones().length) {
      this.tableApi.getZones().subscribe(z => this.zones.set(z));
    }
  }

  save() {
    if (!this.form.name.trim() || !this.form.time_start || this.saving()) return;
    this.saving.set(true);
    const f = this.form;
    this.reservationApi.createReservation({
      name: f.name.trim(),
      phone: f.phone.trim(),
      date: f.date,
      time_start: f.time_start,
      guests_count: f.guests_count || 1,
      table: f.table,
      wishes: f.wishes.trim(),
      deposit_amount: +f.deposit_amount || 0,
      deposit_method: +f.deposit_amount > 0 ? f.deposit_method : '',
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.toast.success('Бронь сохранена');
        this.loadReservations();
      },
      error: err => {
        this.saving.set(false);
        this.toast.apiError(err, 'Не удалось сохранить бронь');
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
