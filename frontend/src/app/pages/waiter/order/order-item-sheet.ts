import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideTrash2 } from '@lucide/angular';
import { OrderItem } from '../../../core/models';
import { BdBottomSheetComponent } from '../../../shared/ui';

/** Шторка позиции: количество + комментарий + удаление.
 * Презентационная — async-запросы ведёт OrderPage, сюда приходит [saving]. */
@Component({
  selector: 'order-item-sheet',
  standalone: true,
  imports: [CommonModule, LucideTrash2, BdBottomSheetComponent],
  template: `
    <bd-bottom-sheet (closed)="closed.emit()">
      <div class="px-4 pt-1 pb-4">
        <p class="font-bold text-lg leading-tight">{{ item.menu_item_name }}</p>
        <p class="text-sm font-bold mb-4" style="color:var(--color-gold-hover)">{{ item.unit_price | number:'1.0-0' }} ₽</p>

        @if (guests.length > 1) {
          <p class="text-xs font-semibold mb-2" style="color:var(--color-muted)">ГОСТЬ</p>
          <div class="flex flex-wrap gap-2 mb-4">
            @for (g of guests; track g.no) {
              <button (click)="guest.set(g.no)"
                      class="rounded-full text-sm font-semibold transition-colors" style="padding:7px 14px"
                      [style.background]="guest() === g.no ? 'var(--color-gold)' : 'var(--color-bg)'"
                      [style.color]="guest() === g.no ? 'white' : 'var(--color-text)'"
                      [style.border]="'1.5px solid ' + (guest() === g.no ? 'var(--color-gold)' : 'var(--color-border)')">
                {{ g.label }}
              </button>
            }
          </div>
        }

        <p class="text-xs font-semibold mb-2" style="color:var(--color-muted)">КОЛИЧЕСТВО</p>
        <div class="flex items-center justify-center gap-5 mb-4">
          <button (click)="qty.set(qty() > 1 ? qty() - 1 : 1)"
                  class="flex items-center justify-center rounded-full font-bold"
                  style="width:46px;height:46px;background:var(--color-bg);border:1.5px solid var(--color-border);color:var(--color-text);font-size:1.4rem">−</button>
          <span class="font-bold" style="font-size:2rem;min-width:48px;text-align:center">{{ qty() }}</span>
          <button (click)="qty.set(qty() + 1)"
                  class="flex items-center justify-center rounded-full font-bold text-white"
                  style="width:46px;height:46px;background:var(--color-gold);font-size:1.4rem">＋</button>
        </div>

        <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">КОММЕНТАРИЙ</p>
        <textarea [value]="comment()" (input)="comment.set($any($event.target).value)"
                  placeholder="Напр.: без лука, соус отдельно" class="field" rows="2" style="resize:none"></textarea>
      </div>
      <div sheet-footer class="px-4 pt-2 pb-4 flex gap-2" style="border-top:1px solid var(--color-border)">
        <button (click)="delete.emit()"
                class="flex items-center justify-center rounded-xl flex-shrink-0"
                style="width:52px;height:48px;color:var(--color-red);background:var(--color-red-bg)">
          <svg lucideTrash2 [size]="18"></svg>
        </button>
        <button (click)="save.emit({ quantity: qty(), comment: comment().trim(), guest: guest() })"
                [disabled]="saving" class="btn btn-primary" style="flex:1;height:48px">
          {{ saving ? '...' : 'Сохранить' }}
        </button>
      </div>
    </bd-bottom-sheet>
  `,
})
export class OrderItemSheet {
  @Input({ required: true }) set item(v: OrderItem) {
    this._item = v;
    this.qty.set(v.quantity);
    this.comment.set(v.comment ?? '');
    this.guest.set(v.guest_no);
  }
  get item() { return this._item; }
  private _item!: OrderItem;

  /** Гости, на которых можно переписать позицию (включая «Общий»). */
  @Input() guests: { no: number; label: string }[] = [];
  @Input() saving = false;

  @Output() save    = new EventEmitter<{ quantity: number; comment: string; guest: number }>();
  @Output() delete  = new EventEmitter<void>();
  @Output() closed  = new EventEmitter<void>();

  qty     = signal(1);
  comment = signal('');
  guest   = signal(0);
}