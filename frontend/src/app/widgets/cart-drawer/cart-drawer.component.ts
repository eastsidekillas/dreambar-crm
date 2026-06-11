import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService } from '../../features/cart/cart.service';
import { LucidePlus, LucideShoppingCart, LucideX, LucideTrash2, LucideCircleCheck } from '@lucide/angular';

export interface CartSubmit { table: string; guests: number; }

@Component({
  selector: 'cart-drawer',
  standalone: true,
  imports: [CommonModule, FormsModule, LucidePlus, LucideShoppingCart, LucideX, LucideTrash2, LucideCircleCheck],
  template: `
    @if (open) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.4)"
           (click)="close.emit()"></div>

      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;max-height:90vh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="close.emit()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <div>
            @if (cart.target(); as t) {
              <h2 class="font-bold text-base flex items-center gap-1"><svg lucidePlus [size]="16"></svg> Дозаказ · {{ t.table_number || 'Стол' }}</h2>
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">Добавится к открытому счёту · {{ cart.count() }} поз.</p>
            } @else {
              <h2 class="font-bold text-base flex items-center gap-1"><svg lucideShoppingCart [size]="16"></svg> Новый стол</h2>
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ cart.count() }} позиций</p>
            }
          </div>
          <button (click)="close.emit()" class="btn btn-ghost btn-sm flex items-center gap-1"><svg lucideX [size]="14"></svg> Закрыть</button>
        </div>

        <!-- Items list -->
        <div class="overflow-y-auto flex-1 px-4 py-2">
          @for (c of cart.items(); track c.item.id + '-' + c.guestNo) {
            <div class="flex items-center gap-3 py-3"
                 style="border-bottom:1px solid var(--color-border)">

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <p class="font-medium text-sm truncate">{{ c.item.name }}</p>
                <p class="text-xs flex items-center gap-1.5" style="color:var(--color-muted)">
                  <span class="badge" [class]="c.guestNo ? 'badge-gold' : 'badge-gray'">
                    {{ c.guestNo ? 'Гость ' + c.guestNo : 'Общий' }}
                  </span>
                  @if (c.item.volume) { {{ c.item.volume }} }
                </p>
              </div>

              <!-- Qty controls -->
              <div class="flex items-center gap-2 flex-shrink-0">
                <button (click)="cart.remove(c.item.id, c.guestNo)"
                        class="flex items-center justify-center w-8 h-8 rounded-full font-bold"
                        style="background:var(--color-bg);border:1.5px solid var(--color-border);color:var(--color-text)">
                  −
                </button>
                <span class="w-5 text-center font-bold text-sm">{{ c.qty }}</span>
                <button (click)="cart.add(c.item, c.guestNo)"
                        class="flex items-center justify-center w-8 h-8 rounded-full font-bold text-white"
                        style="background:var(--color-gold)">
                  +
                </button>
              </div>

              <!-- Subtotal -->
              <span class="font-bold text-sm flex-shrink-0 w-16 text-right"
                    style="color:var(--color-gold-hover)">
                {{ c.item.price * c.qty | number:'1.0-0' }} ₽
              </span>
            </div>
          }
        </div>

        <!-- Footer -->
        <div class="px-4 pt-3 pb-4" style="border-top:1px solid var(--color-border);background:var(--color-surface2)">

          @if (!cart.target()) {
            <div class="flex gap-2 mb-3">
              <div class="flex-1">
                <label class="section-title block mb-1.5">Стол / зона</label>
                <input [(ngModel)]="tableNumber"
                       placeholder="Стол 5, VIP-1, Бар"
                       class="field" style="height:44px" />
              </div>
              <div style="width:90px">
                <label class="section-title block mb-1.5">Гостей</label>
                <input [(ngModel)]="guests" type="number" min="0"
                       class="field" style="height:44px;text-align:center" />
              </div>
            </div>
          }

          <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-medium" style="color:var(--color-muted)">Сумма заказа</span>
            <span class="text-2xl font-bold" style="color:var(--color-text)">
              {{ cart.total() | number:'1.0-0' }} ₽
            </span>
          </div>

          <div class="flex gap-2">
            <button (click)="onClear()" class="btn btn-ghost flex items-center gap-1" style="flex:1">
              <svg lucideTrash2 [size]="14"></svg> Очистить
            </button>
            <button (click)="onSubmit()" [disabled]="submitting()"
                    class="btn btn-primary flex items-center justify-center gap-1" style="flex:2;height:48px;font-size:0.95rem">
              @if (submitting()) {
                Отправка...
              } @else if (cart.target()) {
                <svg lucidePlus [size]="16"></svg> Добавить к столу
              } @else {
                <svg lucideCircleCheck [size]="16"></svg> Открыть стол
              }
            </button>
          </div>
        </div>
      </div>
    }
  `
})
export class CartDrawerComponent {
  @Input() open = false;
  @Output() close  = new EventEmitter<void>();
  @Output() submit = new EventEmitter<CartSubmit>();

  cart = inject(CartService);
  submitting = signal(false);
  tableNumber = '';
  guests: number | null = null;

  onClear() { this.cart.clear(); this.close.emit(); }

  onSubmit() {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.submit.emit({ table: this.tableNumber, guests: this.guests || 0 });
  }

  resetSubmitting() { this.submitting.set(false); this.tableNumber = ''; this.guests = null; }
}
