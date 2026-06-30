import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucidePlus, LucideEllipsis, LucideCheck, LucideClock } from '@lucide/angular';
import { Order, OrderItem } from '../../core/models';

export interface GuestCard { guest: number; items: OrderItem[]; total: number; }

/** Таблица гостей: строка гостя (+ / …) и его позиции (тап → редактирование). */
@Component({
  selector: 'guest-board',
  standalone: true,
  imports: [CommonModule, LucidePlus, LucideEllipsis, LucideCheck, LucideClock],
  host: { class: 'block' },
  template: `
    @for (grp of cards; track grp.guest) {
      <!-- Строка гостя -->
      <div class="flex items-center gap-2 py-2"
           style="border-bottom:1px solid var(--color-border)"
           [style.background]="targetGuest === grp.guest ? 'var(--color-gold-light)' : 'transparent'">
        <span class="font-bold text-sm flex-1 truncate">
          {{ gLabel(grp.guest) }} · <span style="color:var(--color-gold-hover)">{{ grp.total | number:'1.0-0' }} ₽</span>
        </span>
        <button (click)="add.emit(grp.guest)"
                class="flex items-center justify-center rounded-full flex-shrink-0 text-white"
                style="width:30px;height:30px;background:var(--color-gold)">
          <svg lucidePlus [size]="17"></svg>
        </button>
        <button (click)="menu.emit(grp.guest)"
                class="flex items-center justify-center rounded-full flex-shrink-0"
                style="width:30px;height:30px;background:transparent;color:var(--color-muted)">
          <svg lucideEllipsis [size]="18"></svg>
        </button>
      </div>

      <!-- Позиции гостя -->
      @for (item of grp.items; track item.id) {
        <button (click)="itemTap.emit(item)"
                class="w-full flex items-center gap-2 py-1.5 pl-2 text-left transition-colors active:bg-[var(--color-bg)]"
                style="border-bottom:1px solid var(--color-border)">
          @if (item.is_sent === false) {
            <span class="rounded-full flex-shrink-0" title="Не отправлено"
                  style="width:7px;height:7px;background:var(--color-amber)"></span>
          }
          <span class="text-sm font-bold flex-shrink-0 text-center" style="min-width:28px"
                [style.color]="item.quantity > 1 ? 'var(--color-gold-hover)' : 'var(--color-muted)'">{{ item.quantity }}<span style="opacity:0.55;font-weight:600">×</span></span>
          <span class="flex-1 min-w-0">
            <span class="text-sm truncate block"
                  [style.color]="item.kitchen_status === 'ready' ? '#16a34a' : null"
                  [style.font-weight]="item.kitchen_status === 'ready' ? '600' : null">{{ item.menu_item_name }}</span>
            <span class="text-xs block" style="color:var(--color-light)">
              @if (item.created_at) { {{ item.created_at | date:'HH:mm' }} }
              @if (item.comment) { <span style="color:var(--color-muted)">· {{ item.comment }}</span> }
            </span>
          </span>
          @if (item.kitchen_status === 'ready') {
            <span class="text-xs font-semibold flex items-center gap-0.5 flex-shrink-0 px-1.5 py-0.5 rounded-full"
                  style="color:#166534;background:#dcfce7">
              <svg lucideCheck [size]="11"></svg> Готово
            </span>
          } @else if (item.kitchen_status === 'cooking') {
            <svg lucideClock [size]="13" style="color:var(--color-amber);flex-shrink:0"></svg>
          }
          <span class="text-sm font-semibold" style="color:var(--color-gold-hover);min-width:56px;text-align:right">{{ item.subtotal | number:'1.0-0' }} ₽</span>
        </button>
      }
    }
  `,
})
export class GuestBoardComponent {
  @Input({ required: true }) cards: GuestCard[] = [];
  @Input() order: Order | null = null;
  @Input() targetGuest: number | null = null;

  @Output() add     = new EventEmitter<number>();
  @Output() menu    = new EventEmitter<number>();
  @Output() itemTap = new EventEmitter<OrderItem>();

  gLabel(guest: number): string {
    if (guest === 0) return 'Общий';
    return this.order?.guest_names?.[String(guest)] || `Гость ${guest}`;
  }
}
