import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { CartService } from '../../../features/cart/cart.service';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Order, OrderItem, PaymentMethod } from '../../../core/models';

const PAYMENTS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'Наличные', icon: '💵' },
  { value: 'card',     label: 'Карта',    icon: '💳' },
  { value: 'transfer', label: 'Перевод',  icon: '📲' },
];

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3 pb-4">
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-base">Открытые столы</h2>
        <span class="badge badge-gray">{{ orders().length }} занято</span>
      </div>

      @for (o of orders(); track o.id) {
        <div class="card">
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="text-lg">🍽</span>
              <div class="leading-tight">
                <p class="font-bold text-sm">{{ o.table_number || 'Без стола' }}</p>
                <p class="text-xs" style="color:var(--color-muted)">
                  @if (o.guests) { 👥 {{ o.guests }} · }
                  {{ o.waiter_name }} · 🕐 {{ elapsed(o) }}
                </p>
              </div>
            </div>
            <span class="font-bold" style="color:var(--color-gold-hover)">
              {{ unpaidTotal(o) | number:'1.0-0' }} ₽
            </span>
          </div>

          <!-- Items -->
          <div class="space-y-1 mb-3">
            @for (item of unpaidItems(o); track item.id) {
              <div class="flex items-center gap-2 text-sm">
                <span class="flex-1" style="color:var(--color-text)">{{ item.menu_item_name }}</span>
                <span style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="font-medium" style="color:var(--color-gold-hover); min-width:56px; text-align:right">
                  {{ item.subtotal | number:'1.0-0' }} ₽
                </span>
              </div>
            }
            @if (!unpaidItems(o).length) {
              <p class="text-xs" style="color:var(--color-muted)">Все позиции оплачены, ожидается закрытие.</p>
            }
          </div>

          <!-- Already issued receipts (partial split) -->
          @if (o.receipts.length) {
            <div class="flex flex-wrap gap-1 mb-3">
              @for (r of o.receipts; track r.id) {
                <button (click)="reprint(r.id)" class="badge badge-green" style="cursor:pointer">
                  🧾 {{ r.code }} · {{ r.total | number:'1.0-0' }} ₽
                </button>
              }
            </div>
          }

          <!-- Actions -->
          <div class="flex gap-2">
            <button (click)="addMore(o)" class="btn btn-outline" style="flex:1">➕ Дозаказ</button>
            <button (click)="openCheckout(o)" [disabled]="!unpaidItems(o).length"
                    class="btn btn-primary" style="flex:1">💳 Счёт</button>
          </div>
        </div>
      }

      @if (!orders().length) {
        <div class="card text-center py-12">
          <span class="text-4xl block mb-3">🍽</span>
          <p style="color:var(--color-muted)">Нет открытых столов</p>
          <button (click)="goMenu()" class="btn btn-primary btn-sm mt-3">Открыть стол</button>
        </div>
      }
    </div>

    <!-- ── Checkout modal ─────────────────────────────── -->
    @if (checkout(); as co) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeCheckout()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;max-height:92vh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeCheckout()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">💳 Счёт · {{ co.table_number || 'Стол' }}</h2>
          <button (click)="closeCheckout()" class="btn btn-ghost btn-sm">✕</button>
        </div>

        <!-- mode toggle -->
        <div class="px-4 pt-3">
          <div class="flex gap-2">
            <button (click)="setSplit(false)" class="btn btn-sm" style="flex:1"
                    [class]="!split() ? 'btn-primary' : 'btn-outline'">Один чек</button>
            <button (click)="setSplit(true)" class="btn btn-sm" style="flex:1"
                    [class]="split() ? 'btn-primary' : 'btn-outline'">
              Раздельно@if (checkout()?.guests) { · {{ checkout()!.guests }} гост. }
            </button>
          </div>
        </div>

        <div class="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          @for (item of coItems(); track item.id) {
            <div class="flex items-center gap-2 py-1.5" style="border-bottom:1px solid var(--color-border)">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ item.menu_item_name }}</p>
                <p class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }} · {{ item.subtotal | number:'1.0-0' }} ₽</p>
              </div>
              @if (split()) {
                <div class="flex gap-1">
                  @for (b of billIndexes(); track b) {
                    <button (click)="assign(item.id, b)"
                            class="w-8 h-8 rounded-full text-xs font-bold"
                            [style.background]="billOf(item.id) === b ? 'var(--color-gold)' : 'var(--color-bg)'"
                            [style.color]="billOf(item.id) === b ? 'white' : 'var(--color-muted)'"
                            [style.border]="'1.5px solid var(--color-border)'">{{ b + 1 }}</button>
                  }
                </div>
              }
            </div>
          }

          @if (split()) {
            <button (click)="addBill()" [disabled]="bills() >= maxBills()"
                    class="btn btn-ghost btn-sm btn-full mt-2">
              {{ bills() >= maxBills() ? 'Максимум ' + maxBills() + ' чек(ов) — по числу гостей' : '+ Ещё чек (' + bills() + '/' + maxBills() + ')' }}
            </button>
          }
        </div>

        <!-- payment per bill -->
        <div class="px-4 pt-2 pb-4" style="border-top:1px solid var(--color-border);background:var(--color-surface2)">
          @for (b of activeBills(); track b) {
            <div class="mb-3">
              @if (split()) {
                <div class="flex items-center justify-between mb-1">
                  <span class="section-title">Чек {{ b + 1 }}</span>
                  <span class="font-bold text-sm" style="color:var(--color-gold-hover)">{{ billTotal(b) | number:'1.0-0' }} ₽</span>
                </div>
              } @else {
                <div class="flex items-center justify-between mb-1">
                  <span class="text-sm font-medium" style="color:var(--color-muted)">Итого к оплате</span>
                  <span class="text-xl font-bold">{{ billTotal(b) | number:'1.0-0' }} ₽</span>
                </div>
              }
              <div class="flex gap-2">
                @for (p of payments; track p.value) {
                  <button (click)="setPay(b, p.value)" class="btn btn-sm" style="flex:1"
                          [class]="payOf(b) === p.value ? 'btn-primary' : 'btn-outline'">
                    {{ p.icon }} {{ p.label }}
                  </button>
                }
              </div>
            </div>
          }

          <button (click)="confirm()" [disabled]="submitting() || !valid()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ submitting() ? '⏳ ...' : (split() ? '🧾 Закрыть и печать чеков' : '🧾 Закрыть счёт и печать') }}
          </button>
        </div>
      </div>
    }
  `
})
export class TablesPage implements OnInit {
  private api = inject(ApiService);
  private cart = inject(CartService);
  private printer = inject(ReceiptPrintService);
  private toast = inject(ToastService);
  private router = inject(Router);

  payments = PAYMENTS;
  orders = signal<Order[]>([]);

  // checkout modal state
  checkout = signal<Order | null>(null);
  split = signal(false);
  bills = signal(1);                              // количество чеков
  submitting = signal(false);
  private assignMap = signal<Record<number, number>>({});  // item_id -> bill index
  private payMap = signal<Record<number, PaymentMethod>>({}); // bill index -> method

  coItems = computed(() => {
    const o = this.checkout();
    return o ? this.unpaidItems(o) : [];
  });
  billIndexes = computed(() => Array.from({ length: this.bills() }, (_, i) => i));

  /** Максимум чеков = число гостей за столом (если не указано — до 12). */
  maxBills = computed(() => {
    const g = this.checkout()?.guests ?? 0;
    return g > 0 ? g : 12;
  });

  ngOnInit() { this.load(); }

  load() {
    this.api.getActiveOrders().subscribe(o => this.orders.set(o));
  }

  // ── helpers per order ──────────────────────────────────────────
  unpaidItems(o: Order): OrderItem[] { return o.items.filter(i => i.receipt == null); }
  unpaidTotal(o: Order): number { return this.unpaidItems(o).reduce((s, i) => s + +i.subtotal, 0); }
  elapsed(o: Order): string {
    const min = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч ${min % 60} мин`;
  }

  // ── actions ────────────────────────────────────────────────────
  addMore(o: Order) {
    this.cart.setTarget(o);
    this.router.navigate(['/waiter/order']);
  }
  goMenu() { this.router.navigate(['/waiter/order']); }

  reprint(receiptId: number) {
    this.api.getReceipts().subscribe(list => {
      const r = list.find(x => x.id === receiptId);
      if (r) this.printer.print(r);
    });
  }

  // ── checkout modal ─────────────────────────────────────────────
  openCheckout(o: Order) {
    this.checkout.set(o);
    this.split.set(false);
    this.bills.set(1);
    this.submitting.set(false);
    const am: Record<number, number> = {};
    this.unpaidItems(o).forEach(i => am[i.id] = 0);
    this.assignMap.set(am);
    this.payMap.set({ 0: 'cash' });
  }
  closeCheckout() { this.checkout.set(null); }

  /** Переключение режима. При включении «Раздельно» сразу создаём по чеку на гостя. */
  setSplit(on: boolean) {
    this.split.set(on);
    if (on && this.bills() < 2) {
      const target = Math.min(this.maxBills(), Math.max(2, this.checkout()?.guests ?? 2));
      this.bills.set(target);
      const pm = { ...this.payMap() };
      for (let i = 0; i < target; i++) if (!(i in pm)) pm[i] = 'cash';
      this.payMap.set(pm);
    }
  }

  assign(itemId: number, bill: number) {
    this.assignMap.update(m => ({ ...m, [itemId]: bill }));
  }
  billOf(itemId: number): number { return this.assignMap()[itemId] ?? 0; }

  addBill() {
    if (this.bills() >= this.maxBills()) return;
    const idx = this.bills();
    this.bills.update(n => n + 1);
    this.payMap.update(m => ({ ...m, [idx]: 'cash' }));
  }

  /** Только те чеки (по индексу), в которые попала хотя бы одна позиция. */
  activeBills = computed<number[]>(() => {
    if (!this.split()) return [0];
    const used = new Set(Object.values(this.assignMap()));
    return this.billIndexes().filter(b => used.has(b));
  });

  billTotal(bill: number): number {
    const am = this.assignMap();
    return this.coItems()
      .filter(i => (this.split() ? am[i.id] === bill : true))
      .reduce((s, i) => s + +i.subtotal, 0);
  }

  setPay(bill: number, method: PaymentMethod) {
    this.payMap.update(m => ({ ...m, [bill]: method }));
  }
  payOf(bill: number): PaymentMethod { return this.payMap()[bill] ?? 'cash'; }

  valid(): boolean {
    return this.coItems().length > 0 && this.activeBills().every(b => this.billTotal(b) > 0);
  }

  confirm() {
    const o = this.checkout();
    if (!o || this.submitting() || !this.valid()) return;
    this.submitting.set(true);

    const am = this.assignMap();
    const billsPayload = this.activeBills().map(b => ({
      item_ids: this.coItems().filter(i => (this.split() ? am[i.id] === b : true)).map(i => i.id),
      payment_method: this.payOf(b),
    }));

    this.api.checkoutOrder(o.id, billsPayload).subscribe({
      next: res => {
        this.printer.print(res.receipts);
        this.toast.success(res.receipts.length > 1 ? 'Чеки сформированы' : 'Чек сформирован');
        this.closeCheckout();
        this.load();
      },
      error: () => { this.submitting.set(false); this.toast.error('Ошибка при закрытии счёта'); }
    });
  }
}