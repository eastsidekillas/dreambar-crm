import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Shift } from '../../../core/models';
import { LucideCalendarDays, LucideCircleCheck } from '@lucide/angular';

@Component({
  selector: 'app-shifts-day',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideCalendarDays, LucideCircleCheck],
  template: `
<div class="space-y-4">

  <div>
    <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideCalendarDays [size]="20"></svg> Итоги дня</h1>
    <p class="text-xs mt-0.5" style="color:var(--color-muted)">
      Сводка выручки за учётный день
    </p>
  </div>

  <div class="card">
    <!-- Date selector -->
    <div class="flex items-center gap-3 flex-wrap mb-5">
      <label class="section-title">Учётный день</label>
      <select [ngModel]="selectedDate()" (ngModelChange)="selectedDate.set($event)" class="field" style="width:240px">
        @for (d of availableDates(); track d.value) {
          <option [value]="d.value">{{ d.label }}</option>
        }
      </select>
      @if (dayShifts().length > 0) {
        <span class="badge"
              [style]="dayShifts().some(s => s.is_open)
                ? 'background:#dcfce7;color:#166534'
                : 'background:var(--color-surface2);color:var(--color-muted)'">
          {{ dayShifts().some(s => s.is_open) ? 'Смена открыта' : 'День завершён' }}
        </span>
      }
    </div>

    @if (dayShifts().length) {
      <!-- Summary chips -->
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <div class="rounded-xl p-4 text-center"
             style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
          <p class="font-bold text-2xl leading-none" style="color:var(--color-gold-hover)">
            {{ dayRevenue() | number:'1.0-0' }} ₽
          </p>
          <p class="text-xs section-title mt-1">Выручка за день</p>
        </div>
        <div class="rounded-xl p-4 text-center" style="background:var(--color-surface2)">
          <p class="font-bold text-2xl leading-none">{{ dayOrders() }}</p>
          <p class="text-xs section-title mt-1">Заказов</p>
        </div>
        <div class="rounded-xl p-4 text-center" style="background:var(--color-surface2)">
          <p class="font-bold text-2xl leading-none">{{ dayTickets() }}</p>
          <p class="text-xs section-title mt-1">Билетов</p>
        </div>
        <div class="rounded-xl p-4 text-center" style="background:var(--color-surface2)">
          <p class="font-bold text-2xl leading-none">{{ dayShifts().length }}</p>
          <p class="text-xs section-title mt-1">Смен</p>
        </div>
      </div>

      <!-- Shifts table -->
      <div class="overflow-x-auto rounded-xl" style="border:1px solid var(--color-border)">
        <table class="w-full text-sm">
          <thead>
            <tr style="background:var(--color-surface2)">
              <th class="text-left px-3 py-2.5 section-title font-medium">Статус</th>
              <th class="text-left px-3 py-2.5 section-title font-medium">Открыта</th>
              <th class="text-left px-3 py-2.5 section-title font-medium">Закрыта</th>
              <th class="text-left px-3 py-2.5 section-title font-medium">Кассир</th>
              <th class="text-right px-3 py-2.5 section-title font-medium">Заказы</th>
              <th class="text-right px-3 py-2.5 section-title font-medium">Выручка</th>
              <th class="px-3 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            @for (s of dayShifts(); track s.id) {
              <tr style="border-top:1px solid var(--color-border)"
                  [style.background]="s.is_open ? 'var(--color-gold-light)' : 'transparent'">
                <td class="px-3 py-2.5">
                  @if (s.is_open) {
                    <span class="badge badge-green" style="font-size:11px">
                      <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>Открыта
                    </span>
                  } @else {
                    <span class="badge badge-gray" style="font-size:11px">Закрыта</span>
                  }
                </td>
                <td class="px-3 py-2.5">{{ formatTime(s.opened_at) }}</td>
                <td class="px-3 py-2.5" style="color:var(--color-muted)">
                  {{ s.closed_at ? formatTime(s.closed_at) : '—' }}
                </td>
                <td class="px-3 py-2.5">{{ s.opened_by_name }}</td>
                <td class="px-3 py-2.5 text-right">{{ s.orders_count }}</td>
                <td class="px-3 py-2.5 text-right font-semibold" style="color:var(--color-gold-hover)">
                  {{ s.total_revenue | number:'1.0-0' }} ₽
                </td>
                <td class="px-3 py-2.5">
                  <button (click)="goToReceipts(s)" class="btn btn-ghost btn-sm"
                          style="font-size:11px">
                    Чеки →
                  </button>
                </td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr style="border-top:2px solid var(--color-border);background:var(--color-surface2)">
              <td colspan="4" class="px-3 py-2.5 font-semibold section-title">Итого за день</td>
              <td class="px-3 py-2.5 text-right font-semibold">{{ dayOrders() }}</td>
              <td class="px-3 py-2.5 text-right font-bold" style="color:var(--color-gold-hover)">
                {{ dayRevenue() | number:'1.0-0' }} ₽
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>

      @if (dayShifts().every(s => !s.is_open)) {
        <div class="mt-4 p-3 rounded-xl flex items-center gap-3"
             style="background:#dcfce7;border:1px solid #86efac">
          <svg lucideCircleCheck [size]="20" style="color:#166534;flex-shrink:0"></svg>
          <p class="text-sm font-medium" style="color:#166534">
            Все смены за {{ formatDateLabel(selectedDate()) }} закрыты. Учётный день завершён.
          </p>
        </div>
      }

    } @else {
      <p class="text-center py-10" style="color:var(--color-muted)">Смен за этот день нет</p>
    }
  </div>

</div>
  `,
})
export class ShiftsDayPage implements OnInit {
  shifts       = signal<Shift[]>([]);
  selectedDate = signal('');

  availableDates = computed(() => {
    const seen = new Set<string>();
    return this.shifts()
      .filter(s => { const ok = !seen.has(s.date); seen.add(s.date); return ok; })
      .map(s => ({ value: s.date, label: this.formatDateLabel(s.date) }));
  });

  dayShifts  = computed(() => this.shifts().filter(s => s.date === this.selectedDate()));
  dayRevenue = computed(() => this.dayShifts().reduce((a, s) => a + +s.total_revenue, 0));
  dayOrders  = computed(() => this.dayShifts().reduce((a, s) => a + s.orders_count, 0));
  dayTickets = computed(() => this.dayShifts().reduce((a, s) => a + s.tickets_count, 0));

  constructor(private api: ApiService, private router: Router) {}

  ngOnInit() {
    this.api.getShifts().subscribe(s => {
      this.shifts.set(s);
      if (s.length && !this.selectedDate()) this.selectedDate.set(s[0].date);
    });
  }

  goToReceipts(s: Shift) {
    this.router.navigate(['/admin/shifts/receipts'], { queryParams: { shift: s.id } });
  }

  formatDateLabel(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  formatTime(dt: string) {
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
}