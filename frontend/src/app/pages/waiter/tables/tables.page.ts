import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { CartService } from '../../../features/cart/cart.service';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Order, OrderItem, PaymentMethod, Receipt } from '../../../core/models';

const PAYMENTS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'Наличные', icon: '💵' },
  { value: 'card',     label: 'Карта',    icon: '💳' },
  { value: 'transfer', label: 'Перевод',  icon: '📲' },
];

const POLL_MS = 10_000;

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3 pb-4">

      <button (click)="openNewTable()" class="btn btn-primary btn-full" style="height:48px;font-size:0.95rem">
        ＋ Новый стол
        @if (orders().length) {
          <span class="text-xs font-normal opacity-70">· {{ orders().length }} занято</span>
        }
      </button>

      @for (o of orders(); track o.id) {
        <div class="overflow-hidden"
             style="background:white;border:1px solid var(--color-border);border-radius:12px">

          <!-- ── Table header ───────────────────────── -->
          <div class="flex items-center justify-between px-3 py-2.5"
               style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-bold text-base truncate">{{ o.table_number || 'Стол' }}</span>
              @if (o.guests) {
                <span class="text-xs flex-shrink-0" style="color:var(--color-muted)">· 👥 {{ o.guests }}</span>
              }
              @if (readyCount(o) > 0) {
                <span class="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold animate-pulse"
                      style="background:#16a34a;color:white">
                  ✓ {{ readyCount(o) }}
                </span>
              }
              <button (click)="openEdit(o)" class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
                      style="color:var(--color-muted)" title="Редактировать">✏️</button>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs" style="color:var(--color-muted)">{{ elapsed(o) }}</span>
              <span class="font-bold text-sm" style="color:var(--color-gold-hover)">
                {{ unpaidTotal(o) | number:'1.0-0' }} ₽
              </span>
            </div>
          </div>

          <!-- ── Notes ──────────────────────────────── -->
          @if (o.notes) {
            <div class="px-3 py-2 text-xs flex items-start gap-1.5"
                 style="background:#fffbeb;border-bottom:1px solid var(--color-gold-mid);color:#92400e">
              <span class="flex-shrink-0">📝</span>
              <span>{{ o.notes }}</span>
            </div>
          }

          <!-- ── Per-guest items ─────────────────────── -->
          @if (unpaidItems(o).length) {
            @for (grp of guestGroups(o); track grp.guest) {
              <div class="px-3 py-2" style="border-bottom:1px solid var(--color-border)">

                <div class="flex items-center justify-between mb-1">
                  <span class="section-title">{{ guestLabel(grp.guest) }}</span>
                  <span class="text-xs font-bold" style="color:var(--color-gold-hover)">
                    {{ grp.total | number:'1.0-0' }} ₽
                  </span>
                </div>

                @for (item of grp.items; track item.id) {
                  <div class="flex items-center gap-2 py-0.5">
                    <span class="flex-1 text-sm truncate" style="color:var(--color-text)">
                      {{ item.menu_item_name }}
                    </span>
                    <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                    @if (item.kitchen_status === 'ready') {
                      <span class="text-xs font-bold" style="color:#16a34a">✓</span>
                    } @else if (item.kitchen_status === 'cooking') {
                      <span class="text-xs" style="color:var(--color-amber)">⏳</span>
                    }
                    @if (confirmDeleteItem() === item.id) {
                      <button (click)="removeItem(o, item)"
                              class="text-xs font-bold px-1.5 py-0.5 rounded"
                              style="background:#ef4444;color:white">Да</button>
                      <button (click)="confirmDeleteItem.set(null)"
                              class="text-xs px-1.5 py-0.5 rounded"
                              style="background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)">Нет</button>
                    } @else {
                      <button (click)="askDeleteItem(item)"
                              class="w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0"
                              style="color:var(--color-muted)" title="Удалить">✕</button>
                    }
                  </div>
                }
              </div>
            }
          } @else {
            <div class="px-3 py-3 text-xs text-center"
                 style="color:var(--color-muted);border-bottom:1px solid var(--color-border)">
              Все позиции оплачены
            </div>
          }

          <!-- ── Issued receipts ────────────────────── -->
          @if (o.receipts.length) {
            <div class="flex flex-wrap gap-1 px-3 py-2" style="border-bottom:1px solid var(--color-border)">
              @for (r of o.receipts; track r.id) {
                <button (click)="reprint(r)" class="badge badge-green" style="cursor:pointer">
                  🧾 {{ r.code }} · {{ r.total | number:'1.0-0' }} ₽
                </button>
              }
            </div>
          }

          <!-- ── Actions ───────────────────────────── -->
          <div style="display:grid;grid-template-columns:1fr 1fr">
            <button (click)="addMore(o)"
                    class="flex items-center justify-center gap-1 py-3 font-semibold text-sm"
                    style="border-right:1px solid var(--color-border);color:var(--color-text)">
              ➕ Дозаказ
            </button>
            <button (click)="openCheckout(o)" [disabled]="!unpaidItems(o).length"
                    class="flex items-center justify-center gap-1 py-3 font-bold text-sm"
                    [style]="unpaidItems(o).length
                      ? 'background:var(--color-gold);color:white'
                      : 'color:var(--color-muted)'">
              💳 Счёт
            </button>
          </div>
        </div>
      }

      @if (!orders().length) {
        <div class="text-center py-16">
          <span class="text-4xl block mb-3">🍽</span>
          <p style="color:var(--color-muted)">Нет открытых столов</p>
        </div>
      }
    </div>

    <!-- ── New table dialog ───────────────────────────── -->
    @if (newTable()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeNewTable()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeNewTable()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">🍽 Новый стол</h2>
          <button (click)="closeNewTable()" class="btn btn-ghost btn-sm">✕</button>
        </div>
        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="section-title block mb-1.5">Стол / зона</label>
            <input [(ngModel)]="ntTable" placeholder="Стол 5, VIP-1, Бар" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Гостей</label>
            <input [(ngModel)]="ntGuests" type="number" min="0" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Комментарий</label>
            <textarea [(ngModel)]="ntNotes" placeholder="Аллергия, пожелания, особые условия…"
                      class="field" rows="2" style="resize:none"></textarea>
          </div>
          <button (click)="createTable()" [disabled]="creating() || !ntTable.trim()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ creating() ? '⏳ ...' : 'Открыть стол и перейти в меню →' }}
          </button>
        </div>
      </div>
    }

    <!-- ── Edit table modal ──────────────────────────────── -->
    @if (editOrder()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeEdit()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeEdit()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">✏️ Изменить стол</h2>
          <button (click)="closeEdit()" class="btn btn-ghost btn-sm">✕</button>
        </div>
        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="section-title block mb-1.5">Стол / зона</label>
            <input [(ngModel)]="editTable" placeholder="Стол 5, VIP-1, Бар" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Гостей</label>
            <input [(ngModel)]="editGuests" type="number" min="0" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Комментарий</label>
            <textarea [(ngModel)]="editNotes" placeholder="Аллергия, пожелания, особые условия…"
                      class="field" rows="2" style="resize:none"></textarea>
          </div>
          <button (click)="saveEdit()" [disabled]="saving() || !editTable.trim()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ saving() ? '⏳ ...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    }

    <!-- ── Checkout modal ─────────────────────────────── -->
    @if (checkout(); as co) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeCheckout()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl overflow-hidden"
           style="background:white;max-height:92dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closeCheckout()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <!-- Title row -->
        <div class="flex-shrink-0 flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <div class="flex items-center gap-2">
            @if (checkoutStep() === 'pay') {
              <button (click)="checkoutStep.set('mode')"
                      class="text-sm font-semibold" style="color:var(--color-muted)">← Назад</button>
            }
            <h2 class="font-bold text-base">💳 {{ co.table_number || 'Стол' }}</h2>
          </div>
          <button (click)="closeCheckout()" class="btn btn-ghost btn-sm">✕</button>
        </div>

        <!-- ── STEP 1: mode choice ──────────────────────── -->
        @if (checkoutStep() === 'mode') {
          <div class="px-4 py-5 space-y-3 flex-shrink-0">
            <p class="text-sm text-center mb-4" style="color:var(--color-muted)">Как будете платить?</p>

            <!-- Single bill -->
            <button (click)="chooseSingle()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-border);background:white">
              <span class="text-3xl">🧾</span>
              <div>
                <p class="font-bold text-base">Один счёт</p>
                <p class="text-sm" style="color:var(--color-muted)">
                  {{ coItems().length }} поз. · {{ totalAll() | number:'1.0-0' }} ₽
                </p>
              </div>
            </button>

            <!-- Split -->
            <button (click)="chooseSplit()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-gold);background:var(--color-gold-light)">
              <span class="text-3xl">👥</span>
              <div>
                <p class="font-bold text-base">Раздельно</p>
                <p class="text-sm" style="color:var(--color-gold-hover)">
                  Каждый платит за себя
                  @if (checkoutGuestGroups().length > 1) {
                    · {{ checkoutGuestGroups().length }} счёт(а)
                  }
                </p>
              </div>
            </button>
          </div>
        }

        <!-- ── STEP 2a: single bill ─────────────────────── -->
        @if (checkoutStep() === 'pay' && !split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            @for (item of coItems(); track item.id) {
              <div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--color-border)">
                <span class="flex-1 text-sm">{{ item.menu_item_name }}</span>
                <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="text-sm font-semibold" style="color:var(--color-gold-hover);min-width:56px;text-align:right">
                  {{ item.subtotal | number:'1.0-0' }} ₽
                </span>
              </div>
            }
          </div>
          <div class="flex-shrink-0 px-4 pt-3 pb-5" style="border-top:1px solid var(--color-border)">
            <div class="flex items-center justify-between mb-3">
              <span class="font-medium" style="color:var(--color-muted)">Итого</span>
              <span class="text-2xl font-bold">{{ totalAll() | number:'1.0-0' }} ₽</span>
            </div>
            <div class="flex gap-2 mb-4">
              @for (p of payments; track p.value) {
                <button (click)="singlePay.set(p.value)" class="btn btn-sm" style="flex:1"
                        [class]="singlePay() === p.value ? 'btn-primary' : 'btn-outline'">
                  {{ p.icon }} {{ p.label }}
                </button>
              }
            </div>
            <button (click)="confirm()" [disabled]="submitting()"
                    class="btn btn-primary btn-full" style="height:48px">
              {{ submitting() ? '⏳ ...' : '🧾 Закрыть счёт и печать' }}
            </button>
          </div>
        }

        <!-- ── STEP 2b: split per guest ─────────────────── -->
        @if (checkoutStep() === 'pay' && split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">

            <!-- Guest list: assign to bill -->
            @for (grp of checkoutGuestGroups(); track grp.guest) {
              <div class="rounded-xl overflow-hidden" style="border:1.5px solid var(--color-border)">

                <!-- Guest header: name | bill buttons | total -->
                <div class="flex items-center gap-2 px-3 py-2.5"
                     style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
                  <span class="font-semibold text-sm flex-1">{{ guestLabel(grp.guest) }}</span>

                  <!-- Bill number selector -->
                  <div class="flex items-center gap-1">
                    @for (bn of billChoices(); track bn) {
                      <button (click)="setGuestBill(grp.guest, bn)"
                              class="w-7 h-7 rounded-full text-xs font-bold"
                              [style]="guestBillOf(grp.guest) === bn
                                ? 'background:var(--color-gold);color:white'
                                : 'background:white;color:var(--color-muted);border:1.5px solid var(--color-border-mid)'">
                        {{ bn }}
                      </button>
                    }
                  </div>

                  <span class="font-bold text-sm flex-shrink-0" style="color:var(--color-gold-hover)">
                    {{ grp.total | number:'1.0-0' }} ₽
                  </span>
                </div>

                <!-- Items -->
                <div class="px-3 py-2">
                  @for (item of grp.items; track item.id) {
                    <div class="flex items-center gap-2 py-0.5 text-sm">
                      <span class="flex-1 truncate">{{ item.menu_item_name }}</span>
                      <span style="color:var(--color-muted)">× {{ item.quantity }}</span>
                      <span style="color:var(--color-gold-hover);min-width:52px;text-align:right">
                        {{ item.subtotal | number:'1.0-0' }} ₽
                      </span>
                    </div>
                  }
                </div>
              </div>
            }

            <!-- Bill summary: payment per merged bill -->
            <div class="pt-2" style="border-top:2px solid var(--color-border)">
              <p class="section-title mb-2">Итого по чекам</p>

              @for (bill of splitBills(); track bill.billNo) {
                <div class="mb-3 rounded-xl overflow-hidden" style="border:1.5px solid var(--color-gold)">
                  <div class="flex items-center justify-between px-3 py-2"
                       style="background:var(--color-gold-light)">
                    <div class="leading-tight">
                      <p class="font-bold text-sm">Чек {{ bill.billNo }}</p>
                      <p class="text-xs" style="color:var(--color-gold-hover)">
                        {{ billGuestNames(bill.guests) }}
                      </p>
                    </div>
                    <span class="font-bold" style="color:var(--color-gold-hover)">
                      {{ bill.total | number:'1.0-0' }} ₽
                    </span>
                  </div>
                  <div class="flex gap-2 px-3 py-2.5">
                    @for (p of payments; track p.value) {
                      <button (click)="setBillPay(bill.billNo, p.value)" class="btn btn-sm" style="flex:1"
                              [class]="billPayOf(bill.billNo) === p.value ? 'btn-primary' : 'btn-outline'">
                        {{ p.icon }} {{ p.label }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid var(--color-border)">
            <button (click)="confirm()" [disabled]="submitting()"
                    class="btn btn-primary btn-full" style="height:48px">
              {{ submitting() ? '⏳ ...'
                : '🧾 Закрыть и печать (' + splitBills().length + ' чека)' }}
            </button>
          </div>
        }
      </div>
    }
  `
})
export class TablesPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private cart = inject(CartService);
  private printer = inject(ReceiptPrintService);
  private toast = inject(ToastService);
  private router = inject(Router);

  payments = PAYMENTS;
  orders = signal<Order[]>([]);

  // new table dialog state
  private shiftId: number | null = null;
  newTable = signal(false);
  creating = signal(false);
  ntTable  = '';
  ntGuests: number | null = null;
  ntNotes  = '';

  private pollTimer?: ReturnType<typeof setInterval>;

  // edit table modal state
  editOrder  = signal<Order | null>(null);
  editTable  = '';
  editGuests: number | null = null;
  editNotes  = '';
  saving     = signal(false);

  openEdit(o: Order) {
    this.editTable  = o.table_number || '';
    this.editGuests = o.guests || null;
    this.editNotes  = o.notes || '';
    this.editOrder.set(o);
  }

  closeEdit() { this.editOrder.set(null); }

  saveEdit() {
    const o = this.editOrder();
    if (!o || this.saving() || !this.editTable.trim()) return;
    this.saving.set(true);
    this.api.updateOrder(o.id, {
      table_number: this.editTable.trim(),
      guests: this.editGuests || 0,
      notes: this.editNotes.trim(),
    }).subscribe({
      next: updated => {
        this.replaceOrder(updated);
        this.saving.set(false);
        this.closeEdit();
      },
      error: () => { this.saving.set(false); this.toast.error('Не удалось сохранить'); },
    });
  }

  // checkout modal state
  checkout     = signal<Order | null>(null);
  checkoutStep = signal<'mode' | 'pay'>('mode');
  split        = signal(false);
  submitting   = signal(false);
  singlePay    = signal<PaymentMethod>('cash');
  // guest_no → bill number (1-based)
  private guestBillMap = signal<Record<number, number>>({});
  // bill number → payment method
  private billPayMap   = signal<Record<number, PaymentMethod>>({});

  coItems = computed(() => {
    const o = this.checkout();
    return o ? this.unpaidItems(o) : [];
  });

  totalAll = computed(() =>
    this.coItems().reduce((s, i) => s + +i.subtotal, 0)
  );

  // Groups by guest_no (for display in split mode)
  checkoutGuestGroups = computed(() => {
    const byGuest = new Map<number, OrderItem[]>();
    for (const it of this.coItems()) {
      const grp = byGuest.get(it.guest_no) ?? [];
      grp.push(it);
      byGuest.set(it.guest_no, grp);
    }
    return [...byGuest.keys()].sort((a, b) => a - b).map(guest => {
      const items = byGuest.get(guest)!;
      return { guest, items, total: items.reduce((s, i) => s + +i.subtotal, 0) };
    });
  });

  // Merged bills: bill number → { guests, items, total }
  splitBills = computed(() => {
    const gbm = this.guestBillMap();
    const bills = new Map<number, { guests: number[]; items: OrderItem[]; total: number }>();
    for (const grp of this.checkoutGuestGroups()) {
      const bn = gbm[grp.guest] ?? 1;
      if (!bills.has(bn)) bills.set(bn, { guests: [], items: [], total: 0 });
      const b = bills.get(bn)!;
      b.guests.push(grp.guest);
      b.items.push(...grp.items);
      b.total += grp.total;
    }
    return [...bills.entries()].sort(([a], [b]) => a - b)
      .map(([billNo, data]) => ({ billNo, ...data }));
  });

  // Which bill numbers can be chosen (all in use + one new)
  billChoices = computed(() => {
    const gbm = this.guestBillMap();
    const used = new Set(Object.values(gbm));
    const max  = used.size ? Math.max(...used) : 0;
    const nums = [...used].sort((a, b) => a - b);
    if (max < this.checkoutGuestGroups().length) nums.push(max + 1);
    return nums;
  });

  ngOnInit() {
    this.load();
    this.api.getCurrentShift().subscribe({ next: s => this.shiftId = s?.id ?? null, error: () => {} });
    this.pollTimer = setInterval(() => this.load(), POLL_MS);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  load() {
    this.api.getActiveOrders().subscribe(o => this.orders.set(o));
  }

  // ── new table ──────────────────────────────────────────────────
  openNewTable() { this.ntTable = ''; this.ntGuests = null; this.ntNotes = ''; this.creating.set(false); this.newTable.set(true); }
  closeNewTable() { this.newTable.set(false); }

  createTable() {
    if (this.creating() || !this.ntTable.trim()) return;
    if (!this.shiftId) { this.toast.error('Нет открытой смены'); return; }
    this.creating.set(true);
    this.api.createOrder({
      shift: this.shiftId, table_number: this.ntTable.trim(), guests: this.ntGuests || 0, notes: this.ntNotes.trim(), items: [],
    }).subscribe({
      next: order => {
        this.cart.setTarget(order);
        this.newTable.set(false);
        this.router.navigate(['/waiter/order']);
      },
      error: () => { this.creating.set(false); this.toast.error('Не удалось открыть стол'); },
    });
  }

  // ── per-guest grouping (раздельный вид карточки) ────────────────
  guestLabel(guest: number): string { return guest === 0 ? '👥 Общий' : 'Гость ' + guest; }

  /** Доступные номера гостей для переноса: [0 (общий), 1..N]. */
  guestOptions(o: Order): number[] {
    const used = this.unpaidItems(o).reduce((m, i) => Math.max(m, i.guest_no), 0);
    const n = Math.max(o.guests ?? 0, used);
    return [0, ...Array.from({ length: n }, (_, i) => i + 1)];
  }

  /** Группы неоплаченных позиций по гостям (только непустые), отсортированы по номеру. */
  guestGroups(o: Order): { guest: number; items: OrderItem[]; total: number }[] {
    const byGuest = new Map<number, OrderItem[]>();
    for (const it of this.unpaidItems(o)) {
      (byGuest.get(it.guest_no) ?? byGuest.set(it.guest_no, []).get(it.guest_no)!).push(it);
    }
    return [...byGuest.keys()].sort((a, b) => a - b).map(guest => {
      const items = byGuest.get(guest)!;
      return { guest, items, total: items.reduce((s, i) => s + +i.subtotal, 0) };
    });
  }

  confirmDeleteItem = signal<number | null>(null);

  askDeleteItem(item: OrderItem) {
    this.confirmDeleteItem.set(item.id);
  }

  removeItem(o: Order, item: OrderItem) {
    this.confirmDeleteItem.set(null);
    this.api.removeItemFromOrder(o.id, item.id).subscribe({
      next: updated => this.replaceOrder(updated),
      error: () => this.toast.error('Не удалось удалить позицию'),
    });
  }

  moveItem(o: Order, item: OrderItem, guest: number) {
    if (item.guest_no === guest) return;
    this.api.setItemGuest(o.id, item.id, guest).subscribe({
      next: updated => this.replaceOrder(updated),
      error: () => this.toast.error('Не удалось перенести позицию'),
    });
  }

  private replaceOrder(updated: Order) {
    this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
  }

  // ── helpers per order ──────────────────────────────────────────
  unpaidItems(o: Order): OrderItem[] { return o.items.filter(i => i.receipt == null); }
  unpaidTotal(o: Order): number { return this.unpaidItems(o).reduce((s, i) => s + +i.subtotal, 0); }
  readyCount(o: Order): number {
    return o.items.filter(i => i.receipt == null && i.kitchen_status === 'ready').length;
  }
  elapsed(o: Order): string {
    const min = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч ${min % 60} мин`;
  }

  // ── actions ────────────────────────────────────────────────────
  addMore(o: Order) {
    this.cart.setTarget(o);
    this.router.navigate(['/waiter/order']);
  }

  reprint(r: Receipt) {
    this.printer.printHardware(r);
  }

  // ── checkout modal ─────────────────────────────────────────────
  openCheckout(o: Order) {
    this.checkout.set(o);
    this.checkoutStep.set('mode');
    this.split.set(false);
    this.singlePay.set('cash');
    this.guestBillMap.set({});
    this.billPayMap.set({});
    this.submitting.set(false);
  }

  closeCheckout() {
    this.checkout.set(null);
    this.checkoutStep.set('mode');
  }

  chooseSingle() {
    this.split.set(false);
    this.checkoutStep.set('pay');
  }

  chooseSplit() {
    this.split.set(true);
    // Each guest starts on their own bill: guest index → bill number 1,2,3...
    const gbm: Record<number, number> = {};
    const bpm: Record<number, PaymentMethod> = {};
    this.checkoutGuestGroups().forEach((grp, idx) => {
      gbm[grp.guest] = idx + 1;
      bpm[idx + 1]   = 'cash';
    });
    this.guestBillMap.set(gbm);
    this.billPayMap.set(bpm);
    this.checkoutStep.set('pay');
  }

  guestBillOf(guest: number): number { return this.guestBillMap()[guest] ?? 1; }

  setGuestBill(guest: number, billNo: number) {
    this.guestBillMap.update(m => ({ ...m, [guest]: billNo }));
    if (!this.billPayMap()[billNo]) {
      this.billPayMap.update(m => ({ ...m, [billNo]: 'cash' }));
    }
  }

  billPayOf(billNo: number): PaymentMethod { return this.billPayMap()[billNo] ?? 'cash'; }

  setBillPay(billNo: number, method: PaymentMethod) {
    this.billPayMap.update(m => ({ ...m, [billNo]: method }));
  }

  billGuestNames(guests: number[]): string {
    return guests.map(g => this.guestLabel(g)).join(' + ');
  }

  confirm() {
    const o = this.checkout();
    if (!o || this.submitting() || !this.coItems().length) return;
    this.submitting.set(true);

    const billsPayload = this.split()
      ? this.splitBills().map(b => ({
          item_ids: b.items.map(i => i.id),
          payment_method: this.billPayOf(b.billNo),
        }))
      : [{ item_ids: this.coItems().map(i => i.id), payment_method: this.singlePay() }];

    this.api.checkoutOrder(o.id, billsPayload).subscribe({
      next: res => {
        this.printer.printHardware(res.receipts);
        this.toast.success(res.receipts.length > 1 ? 'Чеки сформированы' : 'Чек сформирован');
        this.closeCheckout();
        this.load();
      },
      error: () => { this.submitting.set(false); this.toast.error('Ошибка при закрытии счёта'); }
    });
  }
}