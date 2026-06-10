import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Shift, ShiftDetail, Receipt } from '../../../core/models';
import {
  LucideDynamicIcon,
  LucideBanknote, LucideCreditCard, LucideSmartphone, LucideShuffle,
  LucideGlassWater, LucideUtensilsCrossed, LucideWind, LucideTicket,
  LucideTrash2, LucideDownload, LucideCalendar, LucideCheck, LucideCircleCheck,
} from '@lucide/angular';

type Tab = 'active' | 'day' | 'receipts';

const PAY_ICON: Record<string, LucideIconInput> = {
  cash: LucideBanknote, card: LucideCreditCard, transfer: LucideSmartphone, mixed: LucideShuffle,
};

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDynamicIcon,
    LucideTrash2, LucideDownload, LucideCalendar, LucideCircleCheck],
  template: `
<div class="space-y-4">

  <!-- ── Header ──────────────────────────────────────────────────── -->
  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideCalendar [size]="20"></svg> Кассовые смены</h1>
      <p class="text-xs mt-0.5" style="color:var(--color-muted)">
        {{ shifts().length }} смен · {{ openShifts().length }} открыто
      </p>
    </div>
    <button (click)="createShift()" class="btn btn-primary btn-sm"
            [disabled]="openShifts().length > 0">
      + Открыть смену
    </button>
  </div>

  <!-- ── Tabs ────────────────────────────────────────────────────── -->
  <div class="flex rounded-xl overflow-hidden" style="border:1px solid var(--color-border);width:fit-content">
    @for (t of tabs; track t.id) {
      <button (click)="tab.set(t.id)"
              class="px-4 py-2 text-sm font-medium transition-colors"
              [style]="tab() === t.id
                ? 'background:var(--color-gold);color:#000'
                : 'background:transparent;color:var(--color-muted)'">
        {{ t.label }}
      </button>
    }
  </div>

  <!-- ════════════════════════════════════════════════════════════ -->
  <!-- TAB 1 — Активные смены                                      -->
  <!-- ════════════════════════════════════════════════════════════ -->
  @if (tab() === 'active') {

    @if (!shifts().length) {
      <div class="card text-center py-16">
        <svg lucideCalendar [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
        <p style="color:var(--color-muted)">Смен пока нет. Нажмите «Открыть смену».</p>
      </div>
    }

    <div class="space-y-3">
      @for (shift of shifts(); track shift.id) {
        <div class="card overflow-hidden"
             [style.border-color]="shift.is_open ? 'var(--color-gold)' : 'var(--color-border)'">

          <!-- Row -->
          <div class="flex items-center gap-3 flex-wrap">

            <!-- Status + number -->
            <div class="flex items-center gap-2 min-w-[140px]">
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    [style.background]="shift.is_open ? '#22c55e' : '#94a3b8'"></span>
              <div>
                <p class="font-bold text-sm leading-none">{{ formatDate(shift.date) }}</p>
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">
                  {{ formatTime(shift.opened_at) }}
                  @if (shift.closed_at) { — {{ formatTime(shift.closed_at) }} }
                  @else { — сейчас }
                </p>
              </div>
            </div>

            <!-- Stats -->
            <div class="flex items-center gap-4 flex-1 flex-wrap ml-2">
              <div class="text-center min-w-[60px]">
                <p class="font-bold text-base leading-none">{{ shift.tickets_count }}</p>
                <p class="text-xs section-title mt-0.5">Билеты</p>
              </div>
              <div class="text-center min-w-[60px]">
                <p class="font-bold text-base leading-none">{{ shift.orders_count }}</p>
                <p class="text-xs section-title mt-0.5">Заказы</p>
              </div>
              <div class="text-center min-w-[80px]">
                <p class="font-bold text-base leading-none" style="color:var(--color-gold-hover)">
                  {{ shift.total_revenue | number:'1.0-0' }} ₽
                </p>
                <p class="text-xs section-title mt-0.5">Выручка</p>
              </div>
              <div class="flex-1"></div>
              <p class="text-xs" style="color:var(--color-muted)">
                {{ shift.opened_by_name }}
              </p>
            </div>

            <!-- Status badge -->
            <div>
              @if (shift.is_open) {
                <span class="badge badge-green">
                  <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>Открыта
                </span>
              } @else {
                <span class="badge badge-gray">Закрыта</span>
              }
            </div>

            <!-- Actions -->
            <div class="flex items-center gap-1.5 flex-shrink-0">
              @if (shift.is_open) {
                <button (click)="closeShift(shift)" class="btn btn-ghost btn-sm"
                        style="color:#dc2626;border-color:#fca5a5">Закрыть</button>
              } @else {
                <button (click)="reopenShift(shift)" class="btn btn-ghost btn-sm">Открыть</button>
              }
              <button (click)="toggleDetail(shift)" class="btn btn-ghost btn-sm">
                {{ openedId() === shift.id ? '▲' : '▼ Детали' }}
              </button>
              <button (click)="exportShift(shift)" class="btn btn-ghost btn-sm"
                      title="Экспорт в Excel"><svg lucideDownload [size]="14"></svg></button>
            </div>
          </div>

          <!-- ── Expanded detail ─────────────────────────────────── -->
          @if (openedId() === shift.id) {
            @if (detailLoading()) {
              <div class="mt-4 pt-4 text-center text-sm" style="border-top:1px solid var(--color-border);color:var(--color-muted)">
                Загрузка...
              </div>
            } @else if (detail()) {
              <div class="mt-4 pt-4 space-y-4" style="border-top:1px solid var(--color-border)">

                <!-- Summary row -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  @for (s of summaryChips(detail()!); track s.label) {
                    <div class="rounded-xl p-3 text-center" style="background:var(--color-surface2)">
                      <p class="font-bold text-lg leading-none" [style.color]="s.color ?? 'var(--color-text)'">
                        {{ s.value }}
                      </p>
                      <p class="text-xs section-title mt-1">{{ s.label }}</p>
                    </div>
                  }
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

                  <!-- By category -->
                  <div>
                    <p class="section-title mb-3">По разделам</p>
                    @for (row of categoryRows(detail()!); track row.label) {
                      <div class="mb-3">
                        <div class="flex justify-between text-sm mb-1">
                          <span class="flex items-center gap-1"><svg [lucideIcon]="row.icon" [size]="14"></svg> {{ row.label }}</span>
                          <span class="font-medium">{{ row.amount | number:'1.0-0' }} ₽
                            <span style="color:var(--color-muted)">{{ row.pct }}%</span>
                          </span>
                        </div>
                        <div class="h-1.5 rounded-full" style="background:var(--color-surface2)">
                          <div class="h-1.5 rounded-full transition-all"
                               style="background:var(--color-gold)"
                               [style.width.%]="row.pct"></div>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- By payment -->
                  <div>
                    <p class="section-title mb-3">По типу оплаты</p>
                    @for (p of detail()!.by_payment; track p.method) {
                      <div class="flex items-center justify-between text-sm py-2"
                           style="border-bottom:1px solid var(--color-border)">
                        <span class="flex items-center gap-1.5">
                          <svg [lucideIcon]="payIcon(p.method)" [size]="14"></svg> {{ p.label }}
                        </span>
                        <span class="font-semibold">{{ p.amount | number:'1.0-0' }} ₽</span>
                      </div>
                    }
                    @if (detail()!.summary.deleted_count) {
                      <div class="flex justify-between text-sm py-2 mt-1">
                        <span class="flex items-center gap-1" style="color:#ef4444"><svg lucideTrash2 [size]="14"></svg> Удалено позиций</span>
                        <span style="color:#ef4444" class="font-medium">
                          {{ detail()!.summary.deleted_count }} шт /
                          {{ detail()!.summary.deleted_amount | number:'1.0-0' }} ₽
                        </span>
                      </div>
                    }
                  </div>

                  <!-- Employees -->
                  <div>
                    <p class="section-title mb-3">Сотрудники</p>
                    @for (e of detail()!.employees; track e.user_id) {
                      <div class="flex items-center justify-between text-sm py-2"
                           style="border-bottom:1px solid var(--color-border)">
                        <span class="font-medium">{{ e.display_name }}</span>
                        <div class="flex gap-3 text-xs" style="color:var(--color-muted)">
                          <span>{{ e.orders_count }} зак.</span>
                          <span class="font-semibold" style="color:var(--color-gold-hover)">
                            {{ e.revenue | number:'1.0-0' }} ₽
                          </span>
                        </div>
                      </div>
                    }
                    @if (!detail()!.employees.length) {
                      <p class="text-sm" style="color:var(--color-muted)">Нет данных</p>
                    }
                  </div>
                </div>

                <!-- Top items -->
                @if (detail()!.top_items.length) {
                  <div>
                    <p class="section-title mb-2">Топ позиций</p>
                    <div class="overflow-x-auto rounded-xl" style="border:1px solid var(--color-border)">
                      <table class="w-full text-sm">
                        <thead>
                          <tr style="background:var(--color-surface2)">
                            <th class="text-left px-3 py-2 section-title font-medium">#</th>
                            <th class="text-left px-3 py-2 section-title font-medium">Позиция</th>
                            <th class="text-right px-3 py-2 section-title font-medium">Кол-во</th>
                            <th class="text-right px-3 py-2 section-title font-medium">Выручка</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of detail()!.top_items.slice(0, 10); track item.name; let i = $index) {
                            <tr style="border-top:1px solid var(--color-border)">
                              <td class="px-3 py-2" style="color:var(--color-muted)">{{ i + 1 }}</td>
                              <td class="px-3 py-2">
                                {{ item.name }}
                                @if (item.volume) {
                                  <span style="color:var(--color-muted)"> {{ item.volume }}</span>
                                }
                              </td>
                              <td class="px-3 py-2 text-right">{{ item.qty }}</td>
                              <td class="px-3 py-2 text-right font-semibold"
                                  style="color:var(--color-gold-hover)">
                                {{ item.revenue | number:'1.0-0' }} ₽
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                }

              </div>
            }
          }

        </div>
      }
    </div>
  }

  <!-- ════════════════════════════════════════════════════════════ -->
  <!-- TAB 2 — Итоги дня                                           -->
  <!-- ════════════════════════════════════════════════════════════ -->
  @if (tab() === 'day') {
    <!-- Date selector -->
    <div class="card">
      <div class="flex items-center gap-3 flex-wrap mb-4">
        <label class="section-title">Учётный день</label>
        <select [(ngModel)]="selectedDate" (ngModelChange)="onDateChange()"
                class="field" style="width:220px">
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

      <!-- Day summary chips -->
      @if (dayShifts().length) {
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div class="rounded-xl p-4 text-center" style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
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

        <!-- Shifts table for this day -->
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
                    <div class="flex items-center gap-1 justify-end">
                      <button (click)="goToReceipts(s)" class="btn btn-ghost btn-sm"
                              style="font-size:11px">Чеки</button>
                      <button (click)="exportShift(s)" class="btn btn-ghost btn-sm"
                              style="font-size:11px"><svg lucideDownload [size]="12"></svg></button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (dayShifts().every(s => !s.is_open)) {
          <div class="mt-4 p-3 rounded-xl flex items-center gap-3"
               style="background:#dcfce7;border:1px solid #86efac">
            <svg lucideCircleCheck [size]="20" style="color:#166534;flex-shrink:0"></svg>
            <p class="text-sm font-medium" style="color:#166534">
              Все смены за {{ selectedDate }} закрыты. Учётный день завершён.
            </p>
          </div>
        }
      } @else {
        <p class="text-center py-8" style="color:var(--color-muted)">Смен за этот день нет</p>
      }
    </div>
  }

  <!-- ════════════════════════════════════════════════════════════ -->
  <!-- TAB 3 — Детали по чекам                                     -->
  <!-- ════════════════════════════════════════════════════════════ -->
  @if (tab() === 'receipts') {
    <div class="card">
      <!-- Filters -->
      <div class="flex items-center gap-3 flex-wrap mb-4">
        <label class="section-title">Смена</label>
        <select [(ngModel)]="receiptShiftId" (ngModelChange)="loadReceipts()"
                class="field" style="width:260px">
          <option value="">Все смены</option>
          @for (s of shifts(); track s.id) {
            <option [value]="s.id">{{ formatDate(s.date) }} — {{ s.opened_by_name }}</option>
          }
        </select>
        @if (receiptsLoading()) {
          <span class="text-xs" style="color:var(--color-muted)">Загрузка...</span>
        } @else {
          <span class="text-xs" style="color:var(--color-muted)">
            {{ receipts().length }} чеков · {{ receiptsTotal() | number:'1.0-0' }} ₽
          </span>
        }
      </div>

      <!-- Receipts table -->
      @if (receipts().length) {
        <div class="overflow-x-auto rounded-xl" style="border:1px solid var(--color-border)">
          <table class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-surface2)">
                <th class="text-left px-3 py-2.5 section-title font-medium">Чек</th>
                <th class="text-left px-3 py-2.5 section-title font-medium">Дата / время</th>
                <th class="text-left px-3 py-2.5 section-title font-medium">Стол</th>
                <th class="text-left px-3 py-2.5 section-title font-medium">Кассир</th>
                <th class="text-left px-3 py-2.5 section-title font-medium">Оплата</th>
                <th class="text-right px-3 py-2.5 section-title font-medium">Сумма</th>
                <th class="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              @for (r of receipts(); track r.id) {
                <tr style="border-top:1px solid var(--color-border)">
                  <td class="px-3 py-2.5">
                    <span class="font-mono text-xs px-2 py-0.5 rounded"
                          style="background:var(--color-surface2)">
                      #{{ r.number }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5" style="color:var(--color-muted)">
                    {{ formatDateTime(r.issued_at) }}
                  </td>
                  <td class="px-3 py-2.5 font-medium">{{ r.table_number || '—' }}</td>
                  <td class="px-3 py-2.5">{{ r.waiter_name }}</td>
                  <td class="px-3 py-2.5">
                    <span class="flex items-center gap-1">
                      <svg [lucideIcon]="payIcon(r.payment_method)" [size]="14"></svg> {{ r.payment_label }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 text-right font-semibold"
                      style="color:var(--color-gold-hover)">
                    {{ r.total | number:'1.0-0' }} ₽
                  </td>
                  <td class="px-3 py-2.5">
                    <button (click)="toggleReceipt(r.id)"
                            class="btn btn-ghost btn-sm" style="font-size:11px">
                      {{ openedReceiptId() === r.id ? '▲' : '▼' }}
                    </button>
                  </td>
                </tr>

                <!-- Receipt detail rows -->
                @if (openedReceiptId() === r.id) {
                  <tr style="border-top:1px solid var(--color-border)">
                    <td colspan="7" class="px-4 py-3" style="background:var(--color-surface2)">
                      <p class="section-title mb-2">Состав чека #{{ r.number }}</p>
                      <table class="w-full text-xs">
                        <thead>
                          <tr>
                            <th class="text-left py-1 section-title">Позиция</th>
                            <th class="text-right py-1 section-title">Кол-во</th>
                            <th class="text-right py-1 section-title">Цена</th>
                            <th class="text-right py-1 section-title">Сумма</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of r.items; track item.id) {
                            <tr style="border-top:1px solid var(--color-border)">
                              <td class="py-1.5">
                                {{ item.menu_item_name }}
                                @if (item.menu_item_volume) {
                                  <span style="color:var(--color-muted)"> {{ item.menu_item_volume }}</span>
                                }
                              </td>
                              <td class="py-1.5 text-right">{{ item.quantity }}</td>
                              <td class="py-1.5 text-right" style="color:var(--color-muted)">
                                {{ item.unit_price | number:'1.0-0' }} ₽
                              </td>
                              <td class="py-1.5 text-right font-medium">{{ item.subtotal | number:'1.0-0' }} ₽</td>
                            </tr>
                          }
                        </tbody>
                        <tfoot>
                          <tr style="border-top:2px solid var(--color-border)">
                            <td colspan="3" class="py-1.5 font-semibold">Итого</td>
                            <td class="py-1.5 text-right font-bold"
                                style="color:var(--color-gold-hover)">
                              {{ r.total | number:'1.0-0' }} ₽
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        <!-- Receipts summary footer -->
        <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          @for (ps of receiptsByPayment(); track ps.method) {
            <div class="rounded-xl p-3 text-center" style="background:var(--color-surface2)">
              <p class="text-xs section-title mb-1 flex items-center justify-center gap-1"><svg [lucideIcon]="payIcon(ps.method)" [size]="12"></svg> {{ ps.label }}</p>
              <p class="font-bold" style="color:var(--color-gold-hover)">{{ ps.total | number:'1.0-0' }} ₽</p>
              <p class="text-xs" style="color:var(--color-muted)">{{ ps.count }} чеков</p>
            </div>
          }
        </div>

      } @else if (!receiptsLoading()) {
        <p class="text-center py-10" style="color:var(--color-muted)">
          Нет чеков для выбранной смены
        </p>
      }
    </div>
  }

</div>
  `,
})
export class ShiftsComponent implements OnInit {
  tab    = signal<Tab>('active');
  shifts = signal<Shift[]>([]);

  tabs = [
    { id: 'active'   as Tab, label: 'Активные смены' },
    { id: 'day'      as Tab, label: 'Итоги дня' },
    { id: 'receipts' as Tab, label: 'Детали по чекам' },
  ];

  // ── Tab 1 ────────────────────────────────────────────────────────
  openedId      = signal<number | null>(null);
  detail        = signal<ShiftDetail | null>(null);
  detailLoading = signal(false);

  openShifts = computed(() => this.shifts().filter(s => s.is_open));

  // ── Tab 2 ────────────────────────────────────────────────────────
  selectedDate = '';

  availableDates = computed(() => {
    const seen = new Set<string>();
    return this.shifts()
      .filter(s => { const ok = !seen.has(s.date); seen.add(s.date); return ok; })
      .map(s => ({ value: s.date, label: this.formatDate(s.date) }));
  });

  dayShifts  = computed(() => this.shifts().filter(s => s.date === this.selectedDate));
  dayRevenue = computed(() => this.dayShifts().reduce((a, s) => a + +s.total_revenue, 0));
  dayOrders  = computed(() => this.dayShifts().reduce((a, s) => a + s.orders_count, 0));
  dayTickets = computed(() => this.dayShifts().reduce((a, s) => a + s.tickets_count, 0));

  // ── Tab 3 ────────────────────────────────────────────────────────
  receiptShiftId  = '';
  receipts        = signal<Receipt[]>([]);
  receiptsLoading = signal(false);
  openedReceiptId = signal<number | null>(null);

  receiptsTotal = computed(() => this.receipts().reduce((s, r) => s + +r.total, 0));

  receiptsByPayment = computed(() => {
    const map = new Map<string, { method: string; label: string; total: number; count: number }>();
    for (const r of this.receipts()) {
      const k = r.payment_method;
      const cur = map.get(k) ?? { method: k, label: r.payment_label, total: 0, count: 0 };
      map.set(k, { ...cur, total: cur.total + +r.total, count: cur.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  });

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() {
    this.api.getShifts().subscribe(s => {
      this.shifts.set(s);
      if (s.length && !this.selectedDate) this.selectedDate = s[0].date;
    });
  }

  createShift()         { this.api.createShift({}).subscribe(() => this.load()); }
  closeShift(s: Shift)  { this.api.closeShift(s.id).subscribe(() => this.load()); }
  reopenShift(s: Shift) { this.api.reopenShift(s.id).subscribe(() => this.load()); }

  toggleDetail(shift: Shift) {
    if (this.openedId() === shift.id) { this.openedId.set(null); this.detail.set(null); return; }
    this.openedId.set(shift.id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.api.getShiftDetail(shift.id).subscribe({
      next:  d => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }

  onDateChange() { /* computed will update dayShifts */ }

  goToReceipts(s: Shift) {
    this.tab.set('receipts');
    this.receiptShiftId = String(s.id);
    this.loadReceipts();
  }

  loadReceipts() {
    this.receiptsLoading.set(true);
    this.openedReceiptId.set(null);
    const id = this.receiptShiftId ? +this.receiptShiftId : undefined;
    this.api.getReceipts(id).subscribe({
      next:  r => { this.receipts.set(r); this.receiptsLoading.set(false); },
      error: () => this.receiptsLoading.set(false),
    });
  }

  toggleReceipt(id: number) {
    this.openedReceiptId.set(this.openedReceiptId() === id ? null : id);
  }

  exportShift(shift: Shift) {
    this.api.downloadExport(this.api.exportShift(shift.id)).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bardream_shift_${shift.date}.xlsx`;
      a.click();
    });
  }

  // ── Helpers ──────────────────────────────────────────────────────
  summaryChips(d: ShiftDetail) {
    return [
      { label: 'Выручка',  value: (d.summary.total_revenue | 0).toLocaleString('ru') + ' ₽', color: 'var(--color-gold-hover)' },
      { label: 'Чеков',    value: String(d.summary.receipts_count) },
      { label: 'Гостей',   value: String(d.summary.guests_count) },
      { label: 'Ср. чек',  value: (d.summary.avg_check | 0).toLocaleString('ru') + ' ₽' },
    ];
  }

  categoryRows(d: ShiftDetail) {
    const total = d.summary.total_revenue || 1;
    return [
      { label: 'Бар',    icon: LucideGlassWater,      amount: d.by_category.bar,     pct: Math.round(d.by_category.bar     / total * 100) },
      { label: 'Кухня',  icon: LucideUtensilsCrossed, amount: d.by_category.kitchen, pct: Math.round(d.by_category.kitchen / total * 100) },
      { label: 'Кальян', icon: LucideWind,            amount: d.by_category.hookah,  pct: Math.round(d.by_category.hookah  / total * 100) },
      { label: 'Билеты', icon: LucideTicket,          amount: d.by_category.tickets, pct: Math.round(d.by_category.tickets / total * 100) },
    ].filter(r => r.amount > 0);
  }

  payIcon(method: string): LucideIconInput { return PAY_ICON[method] ?? LucideBanknote; }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  }
  formatTime(dt: string) {
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  formatDateTime(dt: string) {
    return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}