import { Component, Input, Output, EventEmitter, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PAY_OPTIONS } from '../../../shared/lib/payments';
import { Order, OrderItem, PaymentMethod, ReservationInfo } from '../../../core/models';
import { OrderApi } from '../../../entities/order';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import * as bill from './order-bill';
import {
  LucideDynamicIcon, LucideCreditCard, LucideX, LucideReceipt,
  LucideUsers, LucideUserMinus, LucideCheck,
} from '@lucide/angular';

/** Модалка «Счёт»: один счёт / раздельно / частичный расчёт, с учётом депозита. */
@Component({
  selector: 'checkout-sheet',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideCreditCard, LucideX, LucideReceipt,
            LucideUsers, LucideUserMinus, LucideCheck],
  template: `
    @if (current(); as co) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closed.emit()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl overflow-hidden"
           style="background:white;max-height:92dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closed.emit()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <div class="flex-shrink-0 flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <div class="flex items-center gap-2">
            @if (step() === 'pay') {
              <button (click)="step.set('mode')"
                      class="text-sm font-semibold" style="color:var(--color-muted)">← Назад</button>
            }
            <h2 class="font-bold text-base flex items-center gap-2"><svg lucideCreditCard [size]="16"></svg> {{ co.table_number || 'Стол' }}</h2>
          </div>
          <button (click)="closed.emit()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>

        @if (step() === 'mode') {
          <div class="px-4 py-5 space-y-3 flex-shrink-0">
            <p class="text-sm text-center mb-4" style="color:var(--color-muted)">Как будете платить?</p>
            <button (click)="chooseSingle()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-border);background:white">
              <svg lucideReceipt [size]="32" style="color:var(--color-muted);flex-shrink:0"></svg>
              <div>
                <p class="font-bold text-base">Один счёт</p>
                <p class="text-sm" style="color:var(--color-muted)">
                  {{ coItems().length }} поз. · {{ totalAll() | number:'1.0-0' }} ₽
                </p>
              </div>
            </button>
            <button (click)="chooseSplit()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-gold);background:var(--color-gold-light)">
              <svg lucideUsers [size]="32" style="color:var(--color-gold-hover);flex-shrink:0"></svg>
              <div>
                <p class="font-bold text-base">Раздельно</p>
                <p class="text-sm" style="color:var(--color-gold-hover)">
                  Каждый платит за себя
                  @if (checkoutGuestGroups().length > 1) { · {{ checkoutGuestGroups().length }} счёт(а) }
                </p>
              </div>
            </button>
            <button (click)="choosePartial()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-border);background:white">
              <svg lucideUserMinus [size]="32" style="color:var(--color-muted);flex-shrink:0"></svg>
              <div>
                <p class="font-bold text-base">Часть гостей уходит</p>
                <p class="text-sm" style="color:var(--color-muted)">
                  Чек только на уходящих — стол остаётся открыт
                </p>
              </div>
            </button>
          </div>
        }

        @if (step() === 'pay' && !split() && !partial()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            @for (item of coItems(); track item.id) {
              <div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--color-border)">
                <span class="flex-1 text-sm">{{ item.menu_item_name }}</span>
                <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="text-sm font-semibold"
                      style="color:var(--color-gold-hover);min-width:56px;text-align:right">
                  {{ item.subtotal | number:'1.0-0' }} ₽
                </span>
              </div>
            }
          </div>
          <div class="flex-shrink-0 px-4 pt-3 pb-5" style="border-top:1px solid var(--color-border)">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium" style="color:var(--color-muted)">Итого по чеку</span>
              <span class="text-2xl font-bold">{{ totalAll() | number:'1.0-0' }} ₽</span>
            </div>
            @if (depositInfo()) {
              <div class="rounded-xl px-3 py-2.5 mb-3 mt-2"
                   style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
                <div class="flex items-center justify-between mb-0.5">
                  <span class="text-sm font-medium" style="color:var(--color-gold-hover)">
                    Депозит ({{ depositInfo()!.deposit_method_label || 'нал' }})
                  </span>
                  <span class="text-sm font-bold" style="color:var(--color-gold-hover)">
                    −{{ depositInfo()!.deposit_amount | number:'1.0-0' }} ₽
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color:var(--color-muted)">{{ depositInfo()!.name }}</span>
                  @if (refundAmount() > 0) {
                    <span class="text-xs font-semibold" style="color:#166534">
                      Возврат: {{ refundAmount() | number:'1.0-0' }} ₽
                    </span>
                  } @else {
                    <span class="text-xs font-semibold" style="color:var(--color-gold-hover)">
                      Остаток: {{ remainingAmount() | number:'1.0-0' }} ₽
                    </span>
                  }
                </div>
              </div>
            } @else {
              <div class="mb-3"></div>
            }
            @if (refundAmount() > 0) {
              <div class="rounded-xl px-3 py-3 mb-4 text-center"
                   style="background:#dcfce7;border:1px solid #86efac">
                <span class="text-sm font-semibold flex items-center justify-center gap-1" style="color:#16a34a">
                  <svg lucideCheck [size]="16"></svg> Депозит покрывает счёт · возврат {{ refundAmount() | number:'1.0-0' }} ₽
                </span>
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
                @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> } {{ submitting() ? '...' : 'Закрыть счёт и печать' }}
              </button>
            } @else if (remainingAmount() === 0 && depositInfo()) {
              <div class="rounded-xl px-3 py-3 mb-4 text-center"
                   style="background:#dcfce7;border:1px solid #86efac">
                <span class="text-sm font-semibold flex items-center justify-center gap-1" style="color:#16a34a">
                  <svg lucideCheck [size]="16"></svg> Депозит покрывает весь счёт
                </span>
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
                @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> } {{ submitting() ? '...' : 'Закрыть счёт и печать' }}
              </button>
            } @else {
              <div class="flex gap-2 mb-4">
                @for (p of payments; track p.value) {
                  <button (click)="singlePay.set(p.value)" class="btn btn-sm flex items-center gap-1" style="flex:1"
                          [class]="singlePay() === p.value ? 'btn-primary' : 'btn-outline'">
                    <svg [lucideIcon]="p.icon" [size]="14"></svg> {{ p.label }}
                  </button>
                }
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
                @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> } {{ submitting() ? '...' : 'Закрыть счёт и печать' }}
              </button>
            }
          </div>
        }

        @if (step() === 'pay' && split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            @for (grp of checkoutGuestGroups(); track grp.guest) {
              <div class="rounded-xl overflow-hidden" style="border:1.5px solid var(--color-border)">
                <div class="flex items-center gap-2 px-3 py-2.5"
                     style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
                  <span class="font-semibold text-sm flex-1">{{ guestLabel(grp.guest) }}</span>
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
            <div class="pt-2" style="border-top:2px solid var(--color-border)">
              <p class="section-title mb-2">Итого по чекам</p>
              @for (b of splitBills(); track b.billNo) {
                <div class="mb-3 rounded-xl overflow-hidden" style="border:1.5px solid var(--color-gold)">
                  <div class="flex items-center justify-between px-3 py-2"
                       style="background:var(--color-gold-light)">
                    <div class="leading-tight">
                      <p class="font-bold text-sm">Чек {{ b.billNo }}</p>
                      <p class="text-xs" style="color:var(--color-gold-hover)">{{ billGuestNames(b.guests) }}</p>
                    </div>
                    <span class="font-bold" style="color:var(--color-gold-hover)">
                      {{ b.total | number:'1.0-0' }} ₽
                    </span>
                  </div>
                  <div class="flex gap-2 px-3 py-2.5">
                    @for (p of payments; track p.value) {
                      <button (click)="setBillPay(b.billNo, p.value)" class="btn btn-sm flex items-center gap-1" style="flex:1"
                              [class]="billPayOf(b.billNo) === p.value ? 'btn-primary' : 'btn-outline'">
                        <svg [lucideIcon]="p.icon" [size]="14"></svg> {{ p.label }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid var(--color-border)">
            <button (click)="confirm()" [disabled]="submitting()"
                    class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
              @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> }
              {{ submitting() ? '...' : 'Закрыть и печать (' + splitBills().length + ' чека)' }}
            </button>
          </div>
        }

        @if (step() === 'pay' && partial()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            <p class="text-sm" style="color:var(--color-muted)">
              Отметь, кто уходит — чек будет только на них, остальные продолжают сидеть.
            </p>
            @for (grp of checkoutGuestGroups(); track grp.guest) {
              <div (click)="togglePartialGuest(grp.guest)"
                   class="rounded-xl overflow-hidden cursor-pointer"
                   [style]="partialSel()[grp.guest]
                     ? 'border:2px solid var(--color-gold)'
                     : 'border:1.5px solid var(--color-border)'">
                <div class="flex items-center gap-2 px-3 py-2.5"
                     [style.background]="partialSel()[grp.guest] ? 'var(--color-gold-light)' : 'white'">
                  <span class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        [style]="partialSel()[grp.guest]
                          ? 'background:var(--color-gold);color:white'
                          : 'border:1.5px solid var(--color-border-mid);background:white'">
                    @if (partialSel()[grp.guest]) { <svg lucideCheck [size]="14"></svg> }
                  </span>
                  <span class="font-semibold text-sm flex-1">{{ guestLabel(grp.guest) }}</span>
                  <span class="font-bold text-sm flex-shrink-0" style="color:var(--color-gold-hover)">
                    {{ grp.total | number:'1.0-0' }} ₽
                  </span>
                </div>
                <div class="px-3 py-2" style="background:white">
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
          </div>
          <div class="flex-shrink-0 px-4 pt-3 pb-5" style="border-top:1px solid var(--color-border)">
            <div class="flex items-center justify-between mb-2">
              <span class="font-medium" style="color:var(--color-muted)">
                Выбрано: {{ partialItems().length }} поз.
              </span>
              <span class="text-2xl font-bold">{{ partialTotal() | number:'1.0-0' }} ₽</span>
            </div>
            @if (depositInfo()) {
              @if (partialAllSelected()) {
                <p class="text-xs mb-3" style="color:var(--color-gold-hover)">
                  Выбраны все гости — стол закроется, депозит
                  {{ depositInfo()!.deposit_amount | number:'1.0-0' }} ₽ будет учтён в чеке.
                </p>
              } @else {
                <p class="text-xs mb-3" style="color:var(--color-muted)">
                  Депозит {{ depositInfo()!.deposit_amount | number:'1.0-0' }} ₽ будет учтён
                  при полном расчёте стола.
                </p>
              }
            }
            <div class="flex gap-2 mb-4">
              @for (p of payments; track p.value) {
                <button (click)="singlePay.set(p.value)" class="btn btn-sm flex items-center gap-1" style="flex:1"
                        [class]="singlePay() === p.value ? 'btn-primary' : 'btn-outline'">
                  <svg [lucideIcon]="p.icon" [size]="14"></svg> {{ p.label }}
                </button>
              }
            </div>
            <button (click)="confirm()" [disabled]="submitting() || !partialItems().length"
                    class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px"
                    [style.opacity]="!partialItems().length ? '0.5' : '1'">
              @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> }
              {{ submitting() ? '...'
                 : partialAllSelected() ? 'Закрыть счёт и печать'
                 : 'Чек на выбранных и печать' }}
            </button>
          </div>
        }
      </div>
    }
  `,
})
export class CheckoutSheet {
  private orderApi = inject(OrderApi);
  private printer = inject(ReceiptPrintService);
  private toast = inject(ToastService);

  payments = PAY_OPTIONS;
  guestLabel = bill.guestLabel;

  @Input({ required: true }) set order(o: Order) {
    this.current.set(o);
    this.step.set('mode');
    this.split.set(false);
    this.partial.set(false);
    this.singlePay.set('cash');
    this.partialSel.set({});
    this.guestBillMap.set({});
    this.billPayMap.set({});
    this.submitting.set(false);
  }

  @Output() done   = new EventEmitter<void>();
  @Output() closed = new EventEmitter<void>();

  current = signal<Order | null>(null);
  step    = signal<'mode' | 'pay'>('mode');
  split   = signal(false);
  partial = signal(false);
  submitting = signal(false);
  singlePay  = signal<PaymentMethod>('cash');
  partialSel = signal<Record<number, boolean>>({});
  private guestBillMap = signal<Record<number, number>>({});
  private billPayMap   = signal<Record<number, PaymentMethod>>({});

  coItems  = computed(() => { const o = this.current(); return o ? bill.unpaidItems(o) : []; });
  totalAll = computed(() => this.coItems().reduce((s, i) => s + +i.subtotal, 0));

  depositInfo = computed((): ReservationInfo | null => {
    const r = this.current()?.reservation_info;
    if (!r || !r.deposit_paid || +r.deposit_amount <= 0) return null;
    return r;
  });
  depositAmount   = computed(() => this.depositInfo() ? +this.depositInfo()!.deposit_amount : 0);
  remainingAmount = computed(() => Math.max(0, this.totalAll() - this.depositAmount()));
  refundAmount    = computed(() => Math.max(0, this.depositAmount() - this.totalAll()));

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

  partialItems = computed(() =>
    this.checkoutGuestGroups().filter(g => this.partialSel()[g.guest]).flatMap(g => g.items));
  partialTotal = computed(() => this.partialItems().reduce((s, i) => s + +i.subtotal, 0));
  partialAllSelected = computed(() => {
    const groups = this.checkoutGuestGroups();
    return groups.length > 0 && groups.every(g => this.partialSel()[g.guest]);
  });

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
    return [...bills.entries()].sort(([a], [b]) => a - b).map(([billNo, data]) => ({ billNo, ...data }));
  });

  billChoices = computed(() => {
    const gbm = this.guestBillMap();
    const used = new Set(Object.values(gbm));
    const max  = used.size ? Math.max(...used) : 0;
    const nums = [...used].sort((a, b) => a - b);
    if (max < this.checkoutGuestGroups().length) nums.push(max + 1);
    return nums;
  });

  chooseSingle() { this.split.set(false); this.partial.set(false); this.step.set('pay'); }
  choosePartial() {
    this.partial.set(true);
    this.split.set(false);
    this.partialSel.set({});
    this.singlePay.set('cash');
    this.step.set('pay');
  }
  togglePartialGuest(guest: number) { this.partialSel.update(m => ({ ...m, [guest]: !m[guest] })); }
  chooseSplit() {
    this.split.set(true);
    this.partial.set(false);
    const gbm: Record<number, number> = {};
    const bpm: Record<number, PaymentMethod> = {};
    this.checkoutGuestGroups().forEach((grp, idx) => { gbm[grp.guest] = idx + 1; bpm[idx + 1] = 'cash'; });
    this.guestBillMap.set(gbm);
    this.billPayMap.set(bpm);
    this.step.set('pay');
  }
  guestBillOf(guest: number): number { return this.guestBillMap()[guest] ?? 1; }
  setGuestBill(guest: number, billNo: number) {
    this.guestBillMap.update(m => ({ ...m, [guest]: billNo }));
    if (!this.billPayMap()[billNo]) this.billPayMap.update(m => ({ ...m, [billNo]: 'cash' }));
  }
  billPayOf(billNo: number): PaymentMethod { return this.billPayMap()[billNo] ?? 'cash'; }
  setBillPay(billNo: number, method: PaymentMethod) { this.billPayMap.update(m => ({ ...m, [billNo]: method })); }
  billGuestNames(guests: number[]): string { return guests.map(g => bill.guestLabel(g)).join(' + '); }

  confirm() {
    const o = this.current();
    const items = this.partial() ? this.partialItems() : this.coItems();
    if (!o || this.submitting() || !items.length) return;
    this.submitting.set(true);
    const billsPayload = this.split()
      ? this.splitBills().map(b => ({ item_ids: b.items.map(i => i.id), payment_method: this.billPayOf(b.billNo) }))
      : [{ item_ids: items.map(i => i.id), payment_method: this.singlePay() }];
    const closesAll = !this.partial() || this.partialAllSelected();
    const d = this.split() || !closesAll ? null : this.depositInfo();
    const staysOpen = this.partial() && !this.partialAllSelected();
    this.orderApi.checkoutOrder(
      o.id, billsPayload,
      d ? +d.deposit_amount : undefined,
      d ? (d.deposit_method || undefined) : undefined,
    ).subscribe({
      next: res => {
        this.submitting.set(false);
        this.printer.printHardware(res.receipts);
        this.toast.success(staysOpen
          ? 'Чек сформирован — стол остаётся открыт'
          : res.receipts.length > 1 ? 'Чеки сформированы' : 'Чек сформирован');
        this.done.emit();
      },
      error: err => { this.submitting.set(false); this.toast.apiError(err, 'Ошибка при закрытии счёта'); },
    });
  }
}