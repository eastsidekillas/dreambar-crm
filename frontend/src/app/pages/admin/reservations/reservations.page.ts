import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Reservation, ReservationStatus } from '../../../core/models';

const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'Ожидает',      color: '#92400e', bg: '#fef3c7' },
  confirmed: { label: 'Подтверждена', color: '#1e40af', bg: '#dbeafe' },
  arrived:   { label: 'Пришли',       color: '#166534', bg: '#dcfce7' },
  completed: { label: 'Завершена',    color: '#6b7280', bg: '#f3f4f6' },
  cancelled: { label: 'Отменена',     color: '#991b1b', bg: '#fee2e2' },
};

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">

      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-xl font-bold">📅 Бронирования</h1>
        <button (click)="openCreate()" class="btn btn-primary btn-sm">+ Новая бронь</button>
      </div>

      <!-- Filters -->
      <div class="card">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="section-title block mb-1">Дата с</label>
            <input type="date" [(ngModel)]="filterDate" (ngModelChange)="load()" class="field"/>
          </div>
          <div>
            <label class="section-title block mb-1">Дата по</label>
            <input type="date" [(ngModel)]="filterDateTo" (ngModelChange)="load()" class="field"/>
          </div>
          <div>
            <label class="section-title block mb-1">Статус</label>
            <select [(ngModel)]="filterStatus" (ngModelChange)="load()" class="field">
              <option value="">Все</option>
              <option value="pending">Ожидает</option>
              <option value="confirmed">Подтверждена</option>
              <option value="arrived">Пришли</option>
              <option value="completed">Завершена</option>
              <option value="cancelled">Отменена</option>
            </select>
          </div>
          <div class="flex items-end">
            <button (click)="setToday()" class="btn btn-outline btn-sm w-full">Сегодня</button>
          </div>
        </div>
      </div>

      <!-- Summary -->
      @if (reservations().length > 0) {
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card text-center">
            <div class="text-2xl font-bold">{{ reservations().length }}</div>
            <div class="text-xs" style="color:var(--color-muted)">Всего броней</div>
          </div>
          <div class="card text-center">
            <div class="text-2xl font-bold" style="color:#92400e">{{ pendingCount() }}</div>
            <div class="text-xs" style="color:var(--color-muted)">Ожидают</div>
          </div>
          <div class="card text-center">
            <div class="text-2xl font-bold" style="color:var(--color-gold-hover)">
              {{ totalDeposit() | number:'1.0-0' }} ₽
            </div>
            <div class="text-xs" style="color:var(--color-muted)">Депозит (план)</div>
          </div>
          <div class="card text-center">
            <div class="text-2xl font-bold" style="color:#166534">
              {{ paidDeposit() | number:'1.0-0' }} ₽
            </div>
            <div class="text-xs" style="color:var(--color-muted)">Депозит (получен)</div>
          </div>
        </div>
      }

      <!-- Loading -->
      @if (loading()) {
        <div class="text-center py-10" style="color:var(--color-muted)">Загрузка...</div>
      } @else if (reservations().length === 0) {
        <div class="card text-center py-10" style="color:var(--color-muted)">Нет броней</div>
      } @else {
        <div class="space-y-3">
          @for (r of reservations(); track r.id) {
            <div class="card" [style.border-left]="'4px solid ' + statusMeta(r.status).color">
              <div class="flex items-start justify-between gap-3 flex-wrap">

                <!-- Left: guest info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap mb-1">
                    <span class="font-bold text-base">{{ r.name }}</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          [style.color]="statusMeta(r.status).color"
                          [style.background]="statusMeta(r.status).bg">
                      {{ statusMeta(r.status).label }}
                    </span>
                  </div>
                  <div class="text-sm mb-1" style="color:var(--color-muted)">
                    📞 {{ r.phone }}
                  </div>
                  <div class="flex items-center gap-3 flex-wrap text-sm">
                    <span>📅 {{ r.date }}</span>
                    <span>🕐 {{ r.time_start }}@if (r.time_end) { — {{ r.time_end }} }</span>
                    @if (r.table_number) { <span>🪑 Стол {{ r.table_number }}</span> }
                    <span>👥 {{ r.guests_count }} чел.</span>
                  </div>
                  @if (r.wishes) {
                    <div class="mt-1 text-sm italic" style="color:var(--color-muted)">
                      💬 {{ r.wishes }}
                    </div>
                  }
                </div>

                <!-- Right: deposit -->
                <div class="flex-shrink-0 text-right">
                  @if (+r.deposit_amount > 0) {
                    <div class="text-base font-bold mb-0.5"
                         [style.color]="r.deposit_paid ? '#166534' : '#92400e'">
                      {{ r.deposit_amount | number:'1.0-0' }} ₽
                    </div>
                    <div class="text-xs mb-1" style="color:var(--color-muted)">
                      {{ r.deposit_method_label || '—' }}
                    </div>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                          [style.color]="r.deposit_paid ? '#166534' : '#92400e'"
                          [style.background]="r.deposit_paid ? '#dcfce7' : '#fef3c7'">
                      {{ r.deposit_paid ? '✅ Оплачен' : '⏳ Не оплачен' }}
                    </span>
                  } @else {
                    <span class="text-xs" style="color:var(--color-muted)">Без депозита</span>
                  }
                </div>
              </div>

              <!-- Actions -->
              <div class="flex items-center gap-2 mt-3 flex-wrap"
                   style="border-top:1px solid var(--color-border);padding-top:10px">
                @if (r.status === 'pending') {
                  <button (click)="setStatus(r, 'confirmed')" class="btn btn-outline btn-sm">✓ Подтвердить</button>
                }
                @if (r.status === 'confirmed' || r.status === 'pending') {
                  <button (click)="setStatus(r, 'arrived')" class="btn btn-outline btn-sm"
                          style="color:#166534;border-color:#166534">👋 Пришли</button>
                }
                @if (r.status === 'arrived') {
                  <button (click)="setStatus(r, 'completed')" class="btn btn-outline btn-sm">✅ Завершить</button>
                }
                @if (r.status !== 'cancelled' && r.status !== 'completed') {
                  <button (click)="setStatus(r, 'cancelled')" class="btn btn-outline btn-sm"
                          style="color:var(--color-red);border-color:var(--color-red)">✗ Отменить</button>
                }
                @if (+r.deposit_amount > 0 && !r.deposit_paid) {
                  <button (click)="markDeposit(r, true)" class="btn btn-sm"
                          style="background:#dcfce7;color:#166534;border:1px solid #86efac">
                    💵 Депозит получен
                  </button>
                }
                @if (r.deposit_paid) {
                  <button (click)="markDeposit(r, false)" class="btn btn-ghost btn-sm"
                          style="color:var(--color-muted)">Отменить оплату</button>
                }
                <div class="flex-1"></div>
                <button (click)="openEdit(r)" class="btn btn-ghost btn-sm">✏️ Изменить</button>
                <button (click)="confirmDeleteItem(r)" class="btn btn-ghost btn-sm"
                        style="color:var(--color-red)">🗑</button>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Create / Edit Modal ──────────────────────────────────── -->
    @if (modal()) {
      <div class="fixed inset-0 z-50 flex items-end md:items-center justify-center"
           style="background:rgba(0,0,0,0.45)" (click)="closeModal()">
        <div class="w-full md:max-w-lg rounded-t-2xl md:rounded-2xl overflow-hidden flex flex-col"
             style="background:white;max-height:92dvh"
             (click)="$event.stopPropagation()">

          <div class="flex justify-center pt-3 pb-1 md:hidden cursor-pointer" (click)="closeModal()">
            <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
          </div>

          <div class="flex items-center justify-between px-5 py-4 flex-shrink-0"
               style="border-bottom:1px solid var(--color-border)">
            <h2 class="font-bold text-base">{{ editId() ? 'Изменить бронь' : 'Новая бронь' }}</h2>
            <button (click)="closeModal()" class="btn btn-ghost btn-sm">✕</button>
          </div>

          <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="section-title block mb-1">Имя гостя *</label>
                <input [(ngModel)]="form.name" class="field" placeholder="Иван"/>
              </div>
              <div>
                <label class="section-title block mb-1">Телефон *</label>
                <input [(ngModel)]="form.phone" class="field" placeholder="+7 999 ..."/>
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="section-title block mb-1">Дата *</label>
                <input type="date" [(ngModel)]="form.date" class="field"/>
              </div>
              <div>
                <label class="section-title block mb-1">Стол</label>
                <input [(ngModel)]="form.table_number" class="field" placeholder="VIP 1"/>
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="section-title block mb-1">Начало *</label>
                <input type="time" [(ngModel)]="form.time_start" class="field"/>
              </div>
              <div>
                <label class="section-title block mb-1">Конец</label>
                <input type="time" [(ngModel)]="form.time_end" class="field"/>
              </div>
              <div>
                <label class="section-title block mb-1">Гостей</label>
                <input type="number" [(ngModel)]="form.guests_count" class="field" min="1"/>
              </div>
            </div>

            <div>
              <label class="section-title block mb-2">Депозит</label>
              <div class="flex gap-2">
                <div class="flex-1">
                  <input type="number" [(ngModel)]="form.deposit_amount" class="field"
                         placeholder="0" min="0"/>
                </div>
                <div class="flex-1">
                  <select [(ngModel)]="form.deposit_method" class="field">
                    <option value="">— Способ —</option>
                    <option value="cash">Наличные</option>
                    <option value="transfer">Перевод</option>
                  </select>
                </div>
                <button (click)="form.deposit_paid = !form.deposit_paid"
                        class="btn btn-sm flex-shrink-0"
                        [style.background]="form.deposit_paid ? '#dcfce7' : 'white'"
                        [style.color]="form.deposit_paid ? '#166534' : 'var(--color-muted)'"
                        style="border:1.5px solid var(--color-border);min-width:90px">
                  {{ form.deposit_paid ? '✅ Оплачен' : 'Не оплачен' }}
                </button>
              </div>
            </div>

            <div>
              <label class="section-title block mb-1">Пожелания по заказу</label>
              <textarea [(ngModel)]="form.wishes" class="field" rows="2"
                        placeholder="Торт на день рождения, тихий столик..."></textarea>
            </div>

            <div>
              <label class="section-title block mb-1">Внутренние заметки</label>
              <textarea [(ngModel)]="form.notes" class="field" rows="2"
                        placeholder="Только для персонала..."></textarea>
            </div>
          </div>

          <div class="flex-shrink-0 px-5 py-4 flex gap-3"
               style="border-top:1px solid var(--color-border)">
            <button (click)="closeModal()" class="btn btn-outline" style="flex:1">Отмена</button>
            <button (click)="save()" [disabled]="saving() || !isFormValid()"
                    class="btn btn-primary" style="flex:2">
              {{ saving() ? '⏳ ...' : (editId() ? 'Сохранить' : 'Создать бронь') }}
            </button>
          </div>
        </div>
      </div>
    }

    <!-- Delete confirm -->
    @if (deleteTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center"
           style="background:rgba(0,0,0,0.45)" (click)="deleteTarget.set(null)">
        <div class="card mx-4 max-w-sm w-full" (click)="$event.stopPropagation()">
          <p class="font-bold mb-1">Удалить бронь?</p>
          <p class="text-sm mb-4" style="color:var(--color-muted)">
            {{ deleteTarget()!.name }} · {{ deleteTarget()!.date }}
          </p>
          <div class="flex gap-2">
            <button (click)="deleteTarget.set(null)" class="btn btn-outline" style="flex:1">Отмена</button>
            <button (click)="doDelete()" class="btn btn-sm"
                    style="flex:1;background:#fee2e2;color:#991b1b;border:1px solid #fca5a5">
              Удалить
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ReservationsPage implements OnInit {
  private api   = inject(ApiService);
  private toast = inject(ToastService);

  reservations = signal<Reservation[]>([]);
  loading      = signal(false);

  filterDate   = '';
  filterDateTo = '';
  filterStatus = '';

  modal        = signal(false);
  editId       = signal<number | null>(null);
  saving       = signal(false);
  deleteTarget = signal<Reservation | null>(null);

  form = this.emptyForm();

  pendingCount = computed(() =>
    this.reservations().filter(r => r.status === 'pending').length
  );

  totalDeposit = computed(() =>
    this.reservations()
      .filter(r => r.status !== 'cancelled')
      .reduce((s, r) => s + +r.deposit_amount, 0)
  );

  paidDeposit = computed(() =>
    this.reservations()
      .filter(r => r.deposit_paid && r.status !== 'cancelled')
      .reduce((s, r) => s + +r.deposit_amount, 0)
  );

  ngOnInit() {
    this.setToday();
  }

  setToday() {
    this.filterDate   = new Date().toISOString().slice(0, 10);
    this.filterDateTo = '';
    this.load();
  }

  load() {
    this.loading.set(true);
    this.api.getReservations({
      date:      this.filterDate    || undefined,
      date_to:   this.filterDateTo  || undefined,
      status:    this.filterStatus  || undefined,
    }).subscribe({
      next:  list => { this.reservations.set(list); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  statusMeta(s: string) {
    return STATUS_META[s] ?? STATUS_META['pending'];
  }

  isFormValid() {
    return this.form.name.trim() && this.form.phone.trim() && this.form.date && this.form.time_start;
  }

  openCreate() {
    this.editId.set(null);
    this.form = this.emptyForm();
    this.form.date = this.filterDate || new Date().toISOString().slice(0, 10);
    this.modal.set(true);
  }

  openEdit(r: Reservation) {
    this.editId.set(r.id);
    this.form = {
      name: r.name, phone: r.phone, date: r.date,
      time_start: r.time_start, time_end: r.time_end || '',
      table_number: r.table_number, guests_count: r.guests_count,
      wishes: r.wishes, deposit_amount: +r.deposit_amount,
      deposit_method: r.deposit_method as any,
      deposit_paid: r.deposit_paid, notes: r.notes,
    };
    this.modal.set(true);
  }

  closeModal() { this.modal.set(false); }

  save() {
    if (!this.isFormValid() || this.saving()) return;
    this.saving.set(true);
    const data: Partial<Reservation> = {
      name:           this.form.name.trim(),
      phone:          this.form.phone.trim(),
      date:           this.form.date,
      time_start:     this.form.time_start,
      time_end:       this.form.time_end || null as any,
      table_number:   this.form.table_number.trim(),
      guests_count:   this.form.guests_count || 1,
      wishes:         this.form.wishes.trim(),
      deposit_amount: this.form.deposit_amount || 0,
      deposit_method: (this.form.deposit_method || '') as any,
      deposit_paid:   this.form.deposit_paid,
      notes:          this.form.notes.trim(),
    };

    const req = this.editId()
      ? this.api.updateReservation(this.editId()!, data)
      : this.api.createReservation(data);

    req.subscribe({
      next: saved => {
        const id = this.editId();
        if (id) {
          this.reservations.update(list => list.map(r => r.id === id ? saved : r));
        } else {
          this.reservations.update(list =>
            [...list, saved].sort((a, b) =>
              a.date.localeCompare(b.date) || a.time_start.localeCompare(b.time_start)
            )
          );
        }
        this.saving.set(false);
        this.closeModal();
      },
      error: (err) => { this.saving.set(false); this.toast.apiError(err, 'Ошибка при сохранении брони'); },
    });
  }

  setStatus(r: Reservation, st: ReservationStatus) {
    this.api.setReservationStatus(r.id, st).subscribe({
      next: updated => this.reservations.update(list => list.map(x => x.id === r.id ? updated : x)),
      error: (err) => this.toast.apiError(err, 'Ошибка при смене статуса'),
    });
  }

  markDeposit(r: Reservation, paid: boolean) {
    this.api.markReservationDeposit(r.id, paid).subscribe({
      next: updated => this.reservations.update(list => list.map(x => x.id === r.id ? updated : x)),
      error: (err) => this.toast.apiError(err, 'Ошибка при обновлении депозита'),
    });
  }

  confirmDeleteItem(r: Reservation) { this.deleteTarget.set(r); }

  doDelete() {
    const r = this.deleteTarget();
    if (!r) return;
    this.api.deleteReservation(r.id).subscribe({
      next: () => {
        this.reservations.update(list => list.filter(x => x.id !== r.id));
        this.deleteTarget.set(null);
      },
      error: (err) => this.toast.apiError(err, 'Ошибка при удалении брони'),
    });
  }

  private emptyForm() {
    return {
      name: '', phone: '', date: '', time_start: '20:00', time_end: '',
      table_number: '', guests_count: 2, wishes: '',
      deposit_amount: 0, deposit_method: '' as 'cash' | 'transfer' | '',
      deposit_paid: false, notes: '',
    };
  }
}
