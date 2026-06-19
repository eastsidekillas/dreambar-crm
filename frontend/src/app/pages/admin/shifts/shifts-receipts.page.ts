import type { LucideIconInput } from '@lucide/angular';
import { PAY_ICON } from '../../../shared/lib/payments';
import { Component, OnInit, signal, computed } from '@angular/core';
import { formatDate as fmtDate } from '../../../shared/lib/formatters';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OrderApi } from '../../../entities/order';
import { ShiftApi } from '../../../entities/shift';
import { Shift, Receipt } from '../../../core/models';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import {
  LucideDynamicIcon,
  LucideBanknote, LucideCreditCard, LucideSmartphone, LucideShuffle,
  LucideReceipt, LucidePrinter, LucideSearch, LucideX,
} from '@lucide/angular';

@Component({
  selector: 'app-shifts-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDynamicIcon, LucideReceipt, LucidePrinter, LucideSearch, LucideX],
  template: `
<div class="space-y-4">

  <div>
    <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideReceipt [size]="20"></svg> Детали по чекам</h1>
    <p class="text-xs mt-0.5" style="color:var(--color-muted)">
      Список чеков с детализацией. Поиск по № заказа, перепечать одного или нескольких чеков.
    </p>
  </div>

  <div class="card">
    <!-- Filter -->
    <div class="flex items-center gap-3 flex-wrap mb-4">
      <label class="section-title">Смена</label>
      <select [(ngModel)]="shiftId" (ngModelChange)="onShiftChange()" class="field" style="width:240px">
        <option value="">Все смены</option>
        @for (s of shifts(); track s.id) {
          <option [value]="s.id">{{ formatDate(s.date) }} — {{ s.opened_by_name }}</option>
        }
      </select>

      <label class="section-title">№ заказа</label>
      <div class="flex items-center gap-1.5">
        <input [(ngModel)]="orderQuery" (keyup.enter)="searchByOrder()" inputmode="numeric"
               placeholder="напр. 182" class="field" style="width:110px"/>
        <button (click)="searchByOrder()" class="btn btn-ghost btn-sm" title="Найти чеки заказа">
          <svg lucideSearch [size]="15"></svg>
        </button>
        @if (orderQuery) {
          <button (click)="clearOrderSearch()" class="btn btn-ghost btn-sm" title="Сбросить поиск">
            <svg lucideX [size]="15"></svg>
          </button>
        }
      </div>

      @if (loading()) {
        <span class="text-xs" style="color:var(--color-muted)">Загрузка...</span>
      } @else if (receipts().length) {
        <span class="text-xs" style="color:var(--color-muted)">
          {{ receipts().length }} чеков · {{ receiptsTotal() | number:'1.0-0' }} ₽
        </span>
      }
    </div>

    <!-- Table -->
    @if (receipts().length) {
      <div class="overflow-x-auto rounded-xl" style="border:1px solid var(--color-border)">
        <table class="w-full text-sm">
          <thead>
            <tr style="background:var(--color-surface2)">
              <th class="px-3 py-2.5" style="width:36px">
                <input type="checkbox" [checked]="allSelected()" (change)="toggleAll()"
                       title="Выбрать все" style="cursor:pointer"/>
              </th>
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
              <tr style="border-top:1px solid var(--color-border)"
                  [style.background]="isSelected(r.id) ? 'var(--color-gold-light)' : ''">
                <td class="px-3 py-2.5">
                  <input type="checkbox" [checked]="isSelected(r.id)" (change)="toggleSelect(r.id)"
                         style="cursor:pointer"/>
                </td>
                <td class="px-3 py-2.5">
                  <span class="font-mono text-xs px-2 py-0.5 rounded"
                        style="background:var(--color-surface2)">#{{ r.number }}</span>
                </td>
                <td class="px-3 py-2.5" style="color:var(--color-muted)">
                  {{ formatDateTime(r.issued_at) }}
                </td>
                <td class="px-3 py-2.5 font-medium">{{ r.table_number || '—' }}</td>
                <td class="px-3 py-2.5">{{ r.waiter_name }}</td>
                <td class="px-3 py-2.5">
                  <span class="flex items-center gap-1.5">
                    <svg [lucideIcon]="payIcon(r.payment_method)" [size]="14"></svg> {{ r.payment_label }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right font-semibold" style="color:var(--color-gold-hover)">
                  {{ r.total | number:'1.0-0' }} ₽
                </td>
                <td class="px-3 py-2.5">
                  <div class="flex items-center justify-end gap-1">
                    <button (click)="reprintOne(r)" class="btn btn-ghost btn-sm" title="Перепечатать чек">
                      <svg lucidePrinter [size]="15"></svg>
                    </button>
                    <button (click)="toggleReceipt(r.id)" class="btn btn-ghost btn-sm"
                            style="font-size:11px">
                      {{ openedId() === r.id ? '▲' : '▼' }}
                    </button>
                  </div>
                </td>
              </tr>

              @if (openedId() === r.id) {
                <tr style="border-top:1px solid var(--color-border)">
                  <td colspan="8" class="px-4 py-3" style="background:var(--color-surface2)">
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
                          <td class="py-1.5 text-right font-bold" style="color:var(--color-gold-hover)">
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

      <!-- Payment summary -->
      <div class="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
        @for (ps of receiptsByPayment(); track ps.method) {
          <div class="rounded-xl p-3 text-center" style="background:var(--color-surface2)">
            <p class="text-xs section-title mb-1 flex items-center justify-center gap-1"><svg [lucideIcon]="payIcon(ps.method)" [size]="12"></svg> {{ ps.label }}</p>
            <p class="font-bold" style="color:var(--color-gold-hover)">
              {{ ps.total | number:'1.0-0' }} ₽
            </p>
            <p class="text-xs" style="color:var(--color-muted)">{{ ps.count }} чеков</p>
          </div>
        }
      </div>

    } @else if (!loading()) {
      <p class="text-center py-10" style="color:var(--color-muted)">
        {{ orderQuery ? 'По заказу №' + orderQuery + ' чеков не найдено' : 'Нет чеков для выбранной смены' }}
      </p>
    }
  </div>

</div>

<!-- Панель массовой перепечатки -->
@if (selectedCount()) {
  <div class="fixed left-0 right-0 z-40 flex items-center justify-between gap-3 px-4 py-3"
       style="bottom:env(safe-area-inset-bottom,0);background:var(--color-surface);
              border-top:1px solid var(--color-border);box-shadow:0 -4px 16px rgba(0,0,0,0.08)">
    <span class="text-sm font-medium">Выбрано чеков: {{ selectedCount() }}</span>
    <div class="flex items-center gap-2">
      <button (click)="clearSelection()" class="btn btn-ghost btn-sm">Сбросить</button>
      <button (click)="reprintSelected()" class="btn btn-primary btn-sm flex items-center gap-1.5">
        <svg lucidePrinter [size]="15"></svg> Перепечатать выбранные
      </button>
    </div>
  </div>
}
  `,
})
export class ShiftsReceiptsPage implements OnInit {
  shifts   = signal<Shift[]>([]);
  receipts = signal<Receipt[]>([]);
  loading  = signal(false);
  shiftId  = '';
  orderQuery = '';
  openedId = signal<number | null>(null);
  selected = signal<Set<number>>(new Set());

  receiptsTotal = computed(() => this.receipts().reduce((s, r) => s + +r.total, 0));
  selectedCount = computed(() => this.selected().size);
  allSelected   = computed(() => {
    const rs = this.receipts();
    return rs.length > 0 && rs.every(r => this.selected().has(r.id));
  });

  receiptsByPayment = computed(() => {
    const map = new Map<string, { method: string; label: string; total: number; count: number }>();
    for (const r of this.receipts()) {
      const k   = r.payment_method;
      const cur = map.get(k) ?? { method: k, label: r.payment_label, total: 0, count: 0 };
      map.set(k, { ...cur, total: cur.total + +r.total, count: cur.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  });

  constructor(private orderApi: OrderApi, private shiftApi: ShiftApi, private route: ActivatedRoute,
              private printer: ReceiptPrintService) {}

  ngOnInit() {
    this.shiftApi.getShifts().subscribe(s => {
      this.shifts.set(s);
      this.route.queryParams.subscribe(params => {
        if (params['shift']) this.shiftId = String(params['shift']);
        this.loadReceipts();
      });
    });
  }

  loadReceipts() {
    this.loading.set(true);
    this.openedId.set(null);
    this.selected.set(new Set());
    const oq = this.orderQuery.trim();
    const orderId = oq && Number.isFinite(+oq) ? +oq : undefined;
    const shiftId = !orderId && this.shiftId ? +this.shiftId : undefined;
    this.orderApi.getReceipts(shiftId, orderId).subscribe({
      next:  r => { this.receipts.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  /** Поиск по № заказа: смена игнорируется (ищем по всей базе). */
  searchByOrder()    { this.shiftId = ''; this.loadReceipts(); }
  clearOrderSearch() { this.orderQuery = ''; this.loadReceipts(); }
  onShiftChange()    { this.orderQuery = ''; this.loadReceipts(); }

  toggleReceipt(id: number) {
    this.openedId.set(this.openedId() === id ? null : id);
  }

  // ── Выбор и перепечать ───────────────────────────────────────────
  isSelected(id: number) { return this.selected().has(id); }
  toggleSelect(id: number) {
    const next = new Set(this.selected());
    next.has(id) ? next.delete(id) : next.add(id);
    this.selected.set(next);
  }
  toggleAll() {
    this.selected.set(this.allSelected() ? new Set() : new Set(this.receipts().map(r => r.id)));
  }
  clearSelection() { this.selected.set(new Set()); }

  reprintOne(r: Receipt) { this.printer.printHardware(r); }
  reprintSelected() {
    const ids = this.selected();
    const list = this.receipts().filter(r => ids.has(r.id));
    if (!list.length) return;
    if (!confirm(`Перепечатать ${list.length} чек(ов)? Каждый уйдёт на принтер заново.`)) return;
    this.printer.printHardware(list);
    this.clearSelection();
  }

  payIcon(method: string): LucideIconInput { return PAY_ICON[method] ?? LucideBanknote; }

  formatDate(d: string) { return fmtDate(d, { weekday: 'short', day: 'numeric', month: 'long' }); }
  formatDateTime(dt: string) {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }
}