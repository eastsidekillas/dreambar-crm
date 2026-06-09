import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { Shift, Receipt } from '../../../core/models';

const PAY_ICON: Record<string, string> = {
  cash: '💵', card: '💳', transfer: '📲', mixed: '🔀',
};

@Component({
  selector: 'app-shifts-receipts',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-4">

  <div>
    <h1 class="text-xl font-bold">🧾 Детали по чекам</h1>
    <p class="text-xs mt-0.5" style="color:var(--color-muted)">
      Список чеков с детализацией по позициям
    </p>
  </div>

  <div class="card">
    <!-- Filter -->
    <div class="flex items-center gap-3 flex-wrap mb-4">
      <label class="section-title">Смена</label>
      <select [(ngModel)]="shiftId" (ngModelChange)="loadReceipts()" class="field" style="width:280px">
        <option value="">Все смены</option>
        @for (s of shifts(); track s.id) {
          <option [value]="s.id">{{ formatDate(s.date) }} — {{ s.opened_by_name }}</option>
        }
      </select>
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
                        style="background:var(--color-surface2)">#{{ r.number }}</span>
                </td>
                <td class="px-3 py-2.5" style="color:var(--color-muted)">
                  {{ formatDateTime(r.issued_at) }}
                </td>
                <td class="px-3 py-2.5 font-medium">{{ r.table_number || '—' }}</td>
                <td class="px-3 py-2.5">{{ r.waiter_name }}</td>
                <td class="px-3 py-2.5">
                  <span class="flex items-center gap-1.5">
                    {{ payIcon(r.payment_method) }} {{ r.payment_label }}
                  </span>
                </td>
                <td class="px-3 py-2.5 text-right font-semibold" style="color:var(--color-gold-hover)">
                  {{ r.total | number:'1.0-0' }} ₽
                </td>
                <td class="px-3 py-2.5">
                  <button (click)="toggleReceipt(r.id)" class="btn btn-ghost btn-sm"
                          style="font-size:11px">
                    {{ openedId() === r.id ? '▲' : '▼' }}
                  </button>
                </td>
              </tr>

              @if (openedId() === r.id) {
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
            <p class="text-xs section-title mb-1">{{ payIcon(ps.method) }} {{ ps.label }}</p>
            <p class="font-bold" style="color:var(--color-gold-hover)">
              {{ ps.total | number:'1.0-0' }} ₽
            </p>
            <p class="text-xs" style="color:var(--color-muted)">{{ ps.count }} чеков</p>
          </div>
        }
      </div>

    } @else if (!loading()) {
      <p class="text-center py-10" style="color:var(--color-muted)">
        Нет чеков для выбранной смены
      </p>
    }
  </div>

</div>
  `,
})
export class ShiftsReceiptsPage implements OnInit {
  shifts   = signal<Shift[]>([]);
  receipts = signal<Receipt[]>([]);
  loading  = signal(false);
  shiftId  = '';
  openedId = signal<number | null>(null);

  receiptsTotal = computed(() => this.receipts().reduce((s, r) => s + +r.total, 0));

  receiptsByPayment = computed(() => {
    const map = new Map<string, { method: string; label: string; total: number; count: number }>();
    for (const r of this.receipts()) {
      const k   = r.payment_method;
      const cur = map.get(k) ?? { method: k, label: r.payment_label, total: 0, count: 0 };
      map.set(k, { ...cur, total: cur.total + +r.total, count: cur.count + 1 });
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  });

  constructor(private api: ApiService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.api.getShifts().subscribe(s => {
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
    const id = this.shiftId ? +this.shiftId : undefined;
    this.api.getReceipts(id).subscribe({
      next:  r => { this.receipts.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  toggleReceipt(id: number) {
    this.openedId.set(this.openedId() === id ? null : id);
  }

  payIcon(method: string) { return PAY_ICON[method] ?? '💰'; }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  }
  formatDateTime(dt: string) {
    return new Date(dt).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
  }
}