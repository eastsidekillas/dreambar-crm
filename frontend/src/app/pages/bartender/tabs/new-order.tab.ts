import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PAY_OPTIONS } from '../../../shared/lib/payments';
import { MenuApi } from '../../../entities/menu';
import { OrderApi } from '../../../entities/order';
import { ShiftApi } from '../../../entities/shift';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { TouchKeyboardDirective } from '../../../shared/ui';
import { MenuItem, PaymentMethod } from '../../../core/models';
import {
  LucideDynamicIcon, LucideGlassWater, LucideUtensilsCrossed, LucideWine, LucideFolder, LucideReceipt,
} from '@lucide/angular';

/** Вкладка «+ Новый» — свой заказ бармена: меню → корзина → оплата с чеком. */
@Component({
  selector: 'bar-new-order-tab',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDynamicIcon, TouchKeyboardDirective,
    LucideGlassWater, LucideUtensilsCrossed, LucideWine, LucideFolder, LucideReceipt],
  host: { '[style.display]': "visible ? 'contents' : 'none'" },
  template: `
    <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

      <!-- Menu panel -->
      <div class="flex-1 min-h-0 flex flex-col overflow-hidden">

        <!-- Label / guests row -->
        <div class="flex items-center gap-3 p-3 pb-2">
          <input [(ngModel)]="label" bdKbd class="field flex-1" placeholder="Стол / зона / стойка"
                 style="background:#1e293b;border-color:#334155;color:#f1f5f9"/>
          <input [(ngModel)]="guests" type="number" min="1" bdKbd class="field w-20"
                 placeholder="Гостей" style="background:#1e293b;border-color:#334155;color:#f1f5f9"/>
        </div>

        <!-- Breadcrumb -->
        @if (activeCat() !== 0) {
          <div class="flex-shrink-0 flex items-center gap-1 px-3 pb-2 text-sm"
               style="color:#64748b">
            <button (click)="goRoot()"
                    class="font-semibold hover:underline" style="color:#f59e0b">Меню</button>
            @if (activeDrink()) {
              <span>›</span>
              <button (click)="goCat()" class="font-semibold hover:underline"
                      style="color:#f59e0b">{{ activeCatName() }}</button>
              <span>›</span>
              <span style="color:#f1f5f9">{{ activeDrink() }}</span>
            } @else {
              <span>›</span>
              <span style="color:#f1f5f9">{{ activeCatName() }}</span>
            }
          </div>
        }

        <!-- ── Уровень 1: Сетка категорий ── -->
        @if (activeCat() === 0) {
          <div class="flex-1 min-h-0 overflow-y-auto p-3">
            <div class="grid gap-3"
                 style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
              @for (cat of menu(); track cat.id) {
                <button (click)="activeCat.set(cat.id)"
                        class="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition-all active:scale-95"
                        style="background:#1e293b;border:1px solid #334155;min-height:110px">
                  @if (cat.type === 'kitchen') {
                    <svg lucideUtensilsCrossed [size]="40" style="color:#f59e0b"></svg>
                  } @else {
                    <svg lucideGlassWater [size]="40" style="color:#f59e0b"></svg>
                  }
                  <span class="font-bold text-sm text-center leading-tight uppercase tracking-wide"
                        style="color:#f1f5f9">{{ cat.name }}</span>
                  <span class="text-xs" style="color:#64748b">{{ cat.items.length }} поз.</span>
                </button>
              }
            </div>
          </div>
        }

        <!-- ── Уровень 2: Папки по виду напитка/блюда ── -->
        @if (activeCat() !== 0 && !activeDrink()) {
          <div class="flex-1 min-h-0 overflow-y-auto p-3">
            <div class="grid gap-3"
                 style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
              @for (group of drinkGroups(); track group.name) {
                <button (click)="selectDrinkGroup(group)"
                        class="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition-all active:scale-95"
                        style="background:#1e293b;border:1px solid #334155;min-height:110px">
                  @if (group.items.length > 1) {
                    <svg lucideFolder [size]="40" style="color:#f59e0b"></svg>
                  } @else {
                    <span style="font-size:2.5rem;line-height:1;color:#f59e0b">✚</span>
                  }
                  <span class="font-bold text-sm text-center leading-tight uppercase tracking-wide"
                        style="color:#f1f5f9">{{ group.name }}</span>
                  @if (group.items.length > 1) {
                    <span class="text-xs" style="color:#64748b">{{ group.items.length }} вар.</span>
                  } @else {
                    <span class="text-xs font-bold" style="color:#f59e0b">{{ group.items[0].price }} ₽</span>
                  }
                </button>
              }
            </div>
          </div>
        }

        <!-- ── Уровень 3: Варианты по объёму ── -->
        @if (activeCat() !== 0 && activeDrink()) {
          <div class="flex-1 min-h-0 overflow-y-auto p-3">
            <div class="grid gap-3"
                 style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
              @for (item of drinkVariants(); track item.id) {
                <div class="flex flex-col rounded-2xl overflow-hidden relative"
                     style="background:#1e293b;border:1px solid;min-height:120px"
                     [style.border-color]="item.is_out_of_stock ? '#ef4444' : '#334155'">
                  <button (click)="!item.is_out_of_stock && addToCart(item)"
                          class="flex flex-col items-center justify-center gap-2 p-5 flex-1 transition-all active:scale-95"
                          [style.opacity]="item.is_out_of_stock ? '0.4' : '1'"
                          [style.cursor]="item.is_out_of_stock ? 'not-allowed' : 'pointer'">
                    <svg lucideWine [size]="32" style="color:#f59e0b"></svg>
                    <span class="font-bold text-base" style="color:#f1f5f9">
                      {{ item.volume || 'Порция' }}
                    </span>
                    <span class="font-bold text-lg" style="color:#f59e0b">{{ item.price }} ₽</span>
                  </button>
                  <button (click)="toggleStock(item)"
                          class="py-1.5 text-xs font-bold text-center"
                          [style]="item.is_out_of_stock
                            ? 'background:#ef444422;color:#ef4444'
                            : 'background:#1e293b;color:#475569;border-top:1px solid #334155'">
                    {{ item.is_out_of_stock ? '🔴 Закончилось' : 'Отметить «нет»' }}
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>

      <!-- Cart panel -->
      <div class="flex-shrink-0 max-h-64 md:max-h-none w-full md:w-72 flex flex-col overflow-hidden"
           style="background:#0a0f1e;border-top:1px solid #1e293b;border-left:1px solid #1e293b">
        <div class="flex-shrink-0 px-4 py-3 font-bold flex items-center gap-2" style="border-bottom:1px solid #1e293b">
          <svg lucideReceipt [size]="16"></svg> Заказ
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
          @for (line of cartLines(); track line.item.id) {
            <div class="flex items-center gap-2 py-1.5" style="border-bottom:1px solid #1e293b">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate">{{ line.item.name }}</p>
                <p class="text-xs" style="color:#64748b">{{ line.item.price }} ₽</p>
              </div>
              <div class="flex items-center gap-1">
                <button (click)="decCart(line.item)" class="w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center"
                        style="background:#1e293b">−</button>
                <span class="w-6 text-center text-sm font-bold">{{ line.qty }}</span>
                <button (click)="addToCart(line.item)" class="w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center"
                        style="background:#1e293b">+</button>
              </div>
              <span class="text-sm font-bold w-16 text-right" style="color:#f59e0b">
                {{ line.item.price * line.qty | number:'1.0-0' }} ₽
              </span>
            </div>
          }
          @if (!cartLines().length) {
            <p class="text-sm py-4 text-center" style="color:#475569">Добавьте позиции</p>
          }
        </div>

        <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid #1e293b">
          <div class="flex items-center justify-between mb-3">
            <span style="color:#94a3b8">Итого</span>
            <span class="font-bold text-lg" style="color:#f59e0b">{{ cartTotal() | number:'1.0-0' }} ₽</span>
          </div>
          <button (click)="openPayModal()" [disabled]="!cartLines().length || submitting()"
                  class="w-full py-3 rounded-xl font-bold text-sm"
                  style="background:#f59e0b;color:#0f172a">
            {{ submitting() ? 'Отправка...' : 'Принять заказ' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Модальное окно оплаты -->
    @if (payModal()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
           style="background:rgba(0,0,0,0.7)" (click)="payModal.set(false)">
        <div class="rounded-2xl p-6 w-full max-w-sm"
             style="background:#1e293b;border:1px solid #334155"
             (click)="$event.stopPropagation()">
          <p class="font-bold text-lg mb-1">Способ оплаты</p>
          <p class="text-sm mb-4" style="color:#64748b">
            Итого: <span class="font-bold" style="color:#f59e0b">{{ cartTotal() | number:'1.0-0' }} ₽</span>
          </p>

          <div class="grid grid-cols-3 gap-2 mb-5">
            @for (p of payOptions; track p.value) {
              <button (click)="selectedPay = p.value"
                      class="py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all"
                      [style]="selectedPay === p.value
                        ? 'background:#f59e0b;color:#0f172a'
                        : 'background:#0f172a;color:#94a3b8;border:1px solid #334155'">
                <svg [lucideIcon]="p.icon" [size]="20"></svg>
                {{ p.label }}
              </button>
            }
          </div>

          <div class="flex gap-2">
            <button (click)="payModal.set(false)"
                    class="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                    style="background:#0f172a;color:#94a3b8;border:1px solid #334155">
              Отмена
            </button>
            <button (click)="submitOrder()"
                    class="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style="background:#f59e0b;color:#0f172a">
              Принять и чек
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class BarNewOrderTab {
  @Input() visible = false;
  /** Заказ оформлен — страница переключается на «Заказы» и перезагружает их */
  @Output() submitted = new EventEmitter<void>();

  private menuApi  = inject(MenuApi);
  private orderApi = inject(OrderApi);
  private shiftApi = inject(ShiftApi);
  private toast    = inject(ToastService);
  private printer  = inject(ReceiptPrintService);

  menu   = signal<{ id: number; name: string; type: string; items: MenuItem[] }[]>([]);
  label  = '';
  guests = 1;
  private cart = signal<Map<number, { item: MenuItem; qty: number }>>(new Map());
  submitting = signal(false);

  // navigation: 0 = root, >0 = inside category; '' = drink-type grid, else drink name
  activeCat   = signal<number>(0);
  activeDrink = signal<string>('');

  payModal    = signal(false);
  selectedPay: PaymentMethod = 'cash';
  payOptions  = PAY_OPTIONS;

  activeCatName = computed(() =>
    this.menu().find(c => c.id === this.activeCat())?.name ?? ''
  );
  activeCatItems = computed(() =>
    this.menu().find(c => c.id === this.activeCat())?.items ?? []
  );

  // Group items inside a category by drink name (level 2 folders)
  drinkGroups = computed(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of this.activeCatItems()) {
      const key = item.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  // Items for the selected drink name (level 3 — by volume)
  drinkVariants = computed(() =>
    this.activeCatItems().filter(i => i.name === this.activeDrink())
  );

  cartLines = computed(() => [...this.cart().values()]);
  cartTotal = computed(() => this.cartLines().reduce((s, l) => s + l.item.price * l.qty, 0));

  constructor() {
    this.menuApi.getMenuByCategory().subscribe(cats => {
      this.menu.set(
        cats.filter(c => c.station_type === 'bar' || c.station_type === 'kitchen')
            .map(c => ({ id: c.id, name: c.name, type: c.station_type, items: c.items }))
      );
      this.goRoot();
    });
  }

  goRoot() { this.activeCat.set(0); this.activeDrink.set(''); }
  goCat()  { this.activeDrink.set(''); }

  selectDrinkGroup(group: { name: string; items: MenuItem[] }) {
    if (group.items.length === 1) {
      this.addToCart(group.items[0]);
    } else {
      this.activeDrink.set(group.name);
    }
  }

  toggleStock(item: MenuItem) {
    const prev = item.is_out_of_stock;
    item.is_out_of_stock = !prev;
    this.menuApi.toggleOutOfStock(item.id).subscribe({
      error: () => { item.is_out_of_stock = prev; this.toast.error('Ошибка'); },
    });
  }

  addToCart(item: MenuItem) {
    this.cart.update(m => {
      const next = new Map(m);
      const cur = next.get(item.id);
      next.set(item.id, { item, qty: (cur?.qty ?? 0) + 1 });
      return next;
    });
  }

  decCart(item: MenuItem) {
    this.cart.update(m => {
      const next = new Map(m);
      const cur = next.get(item.id);
      if (!cur) return next;
      if (cur.qty <= 1) next.delete(item.id);
      else next.set(item.id, { ...cur, qty: cur.qty - 1 });
      return next;
    });
  }

  openPayModal() {
    if (!this.cartLines().length) return;
    this.selectedPay = 'cash';
    this.payModal.set(true);
  }

  submitOrder() {
    if (!this.cartLines().length || this.submitting()) return;
    this.payModal.set(false);
    this.submitting.set(true);
    this.shiftApi.getCurrentShift().subscribe({
      next: shift => {
        const label = this.label.trim() || 'Стойка';
        this.orderApi.createOrder({
          shift: shift.id,
          table_number: label,
          guests: this.guests || 1,
          notes: '',
          items: this.cartLines().map(l => ({ menu_item: l.item.id, quantity: l.qty })),
        }).subscribe({
          next: order => {
            this.orderApi.closeOrder(order.id, this.selectedPay).subscribe({
              next: res => {
                this.submitting.set(false);
                this.cart.set(new Map());
                this.label = '';
                this.guests = 1;
                this.toast.success('Заказ принят');
                this.printer.printHardware(res.receipt);
                this.submitted.emit();
              },
              error: () => {
                this.submitting.set(false);
                this.toast.error('Ошибка при закрытии заказа');
              },
            });
          },
          error: () => { this.submitting.set(false); this.toast.error('Ошибка при создании заказа'); },
        });
      },
      error: () => { this.submitting.set(false); this.toast.error('Нет открытой смены'); },
    });
  }
}
