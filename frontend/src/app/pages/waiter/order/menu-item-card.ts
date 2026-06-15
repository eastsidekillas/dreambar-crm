import { Component, Input, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideDynamicIcon } from '@lucide/angular';
import { MenuItem } from '../../../core/models';
import { CartService } from '../../../features/cart/cart.service';
import { catMeta } from '../../../shared/lib/menu-meta';

/** Карточка товара меню: тап — добавить, степпер «−/＋» при количестве > 0. */
@Component({
  selector: 'menu-item-card',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon],
  template: `
    <div class="menu-card" [class.in-cart]="cart.qty(item.id, guest) > 0"
         [class.out-of-stock]="item.is_out_of_stock"
         (click)="!item.is_out_of_stock && cart.add(item, guest)">

      @if (item.is_out_of_stock) {
        <span class="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
              style="background:#fee2e2;color:#dc2626">Нет</span>
      } @else if (cart.qty(item.id, guest) > 0) {
        <div class="absolute top-1.5 right-1.5 flex items-center gap-0.5 rounded-full"
             style="background:var(--color-gold);padding:2px" (click)="$event.stopPropagation()">
          <button (click)="cart.remove(item.id, guest); $event.stopPropagation()"
                  class="flex items-center justify-center rounded-full text-white"
                  style="width:26px;height:26px;font-size:1.15rem;line-height:1">−</button>
          <span class="text-white text-xs font-bold" style="min-width:14px;text-align:center">{{ cart.qty(item.id, guest) }}</span>
          <button (click)="cart.add(item, guest); $event.stopPropagation()"
                  class="flex items-center justify-center rounded-full text-white"
                  style="width:26px;height:26px;font-size:1.15rem;line-height:1">＋</button>
        </div>
      }

      <span class="inline-flex items-center gap-1 text-xs font-medium mb-1.5 px-1.5 py-0.5 rounded-full"
            [style.color]="meta.color" [style.background]="meta.bg">
        <svg [lucideIcon]="meta.icon" [size]="12"></svg>
      </span>

      <p class="font-semibold text-sm leading-tight mb-0.5" style="color:var(--color-text)">{{ item.name }}</p>

      @if (item.volume) {
        <p class="text-xs mb-1" style="color:var(--color-muted)">{{ item.volume }}</p>
      }

      @if (showDescription && item.description) {
        <p class="text-xs leading-snug mb-1" style="color:var(--color-light);font-style:italic">{{ item.description }}</p>
      }

      <p class="text-base font-bold mt-auto pt-1" style="color:var(--color-gold-hover)">{{ item.price | number:'1.0-0' }} ₽</p>
    </div>
  `,
})
export class MenuItemCard {
  cart = inject(CartService);
  @Input({ required: true }) item!: MenuItem;
  @Input() guest = 0;
  @Input() showDescription = false;
  get meta() { return catMeta(this.item.category_type); }
}