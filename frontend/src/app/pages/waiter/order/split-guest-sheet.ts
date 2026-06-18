import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, Zone } from '../../../core/models';
import { tableSegments } from '../../../entities/table';
import { BdBottomSheetComponent } from '../../../shared/ui';

/** Шторка «Перенести гостя на свободный стол»: одиночный выбор свободного стола.
 * Презентационная — splitGuest ведёт OrderPage, сюда приходит [saving]. */
@Component({
  selector: 'split-guest-sheet',
  standalone: true,
  imports: [CommonModule, BdBottomSheetComponent],
  template: `
    <bd-bottom-sheet [title]="'Перенести: ' + guestLabel" maxHeight="80dvh" (closed)="closed.emit()">
      <div class="px-4 py-4">
        <p class="text-xs mb-3" style="color:var(--color-muted)">
          Выберите свободный стол — позиции гостя уедут в новый заказ на нём.
        </p>
        @if (freeCount() > 0) {
          @for (z of zones; track z.id) {
            @if (freeOf(z).length) {
              <p class="text-xs font-semibold mb-2 mt-1" style="color:var(--color-muted)">{{ z.name }}</p>
              <div class="grid gap-2 mb-3" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">
                @for (num of freeOf(z); track num) {
                  <button (click)="selected.set(num)"
                          class="rounded-xl p-2.5 text-center transition-all"
                          [style]="selected() === num
                            ? 'background:var(--color-gold);color:white'
                            : 'background:var(--color-bg);border:1px solid var(--color-border)'">
                    <p class="font-bold text-sm">{{ num }}</p>
                    <p class="text-xs">{{ selected() === num ? '✓' : 'свободен' }}</p>
                  </button>
                }
              </div>
            }
          }
          @if (selected(); as num) {
            <div class="sticky bottom-0 pt-3" style="background:var(--color-surface)">
              <button (click)="picked.emit(num)" [disabled]="saving"
                      class="btn btn-primary btn-full" style="height:48px">
                {{ saving ? '...' : 'Перенести → стол ' + num }}
              </button>
            </div>
          }
        } @else {
          <p class="text-center py-6" style="color:var(--color-muted)">Нет свободных столов</p>
        }
      </div>
    </bd-bottom-sheet>
  `,
})
export class SplitGuestSheet {
  @Input({ required: true }) order!: Order;
  @Input() guestLabel = '';
  @Input() zones: Zone[] = [];
  /** Столы, занятые ДРУГИМИ заказами. */
  @Input() occupied = new Set<string>();
  @Input() saving = false;

  @Output() picked = new EventEmitter<string>();   // выбранный номер стола
  @Output() closed = new EventEmitter<void>();

  selected = signal<string | null>(null);

  /** Свободные столы зоны: не заняты другими и не входят в текущий стол заказа. */
  freeOf(z: Zone): string[] {
    const mine = tableSegments(this.order.table_number);
    return z.tables
      .map(t => t.number)
      .filter(num => !this.occupied.has(num) && !mine.includes(num));
  }
  freeCount(): number { return this.zones.reduce((s, z) => s + this.freeOf(z).length, 0); }
}