import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideArrowLeftRight, LucideX } from '@lucide/angular';
import { Order, Zone } from '../../../core/models';
import { OrderApi } from '../../../entities/order';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/** Шторка «Пересадить»: выбор стола(ов) для переноса/объединения заказа. */
@Component({
  selector: 'move-table-sheet',
  standalone: true,
  imports: [CommonModule, LucideArrowLeftRight, LucideX],
  template: `
    <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closed.emit()"></div>
    <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
         style="background:white;max-height:80dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
      <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closed.emit()">
        <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
      </div>
      <div class="flex items-center justify-between px-4 py-3 flex-shrink-0"
           style="border-bottom:1px solid var(--color-border)">
        <div>
          <h2 class="font-bold text-base flex items-center gap-2"><svg lucideArrowLeftRight [size]="16"></svg> Пересадить</h2>
          <p class="text-xs" style="color:var(--color-muted)">Текущий: {{ order.table_number }}</p>
        </div>
        <button (click)="closed.emit()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
      </div>
      <div class="flex-1 overflow-y-auto px-4 py-4">
        <p class="text-xs mb-3" style="color:var(--color-muted)">
          Выберите один или несколько столов для объединения
        </p>
        @if (hasTables) {
          @for (z of zones; track z.id) {
            @if (z.tables.length) {
              <p class="text-xs font-semibold mb-2 mt-1" style="color:var(--color-muted)">{{ z.name }}</p>
              <div class="grid gap-2 mb-3" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">
                @for (t of z.tables; track t.id) {
                  <button [disabled]="busyByOther(t.number) || saving()"
                          (click)="onSelect(t.number)"
                          class="rounded-xl p-2.5 text-center transition-all"
                          [style]="busyByOther(t.number)
                            ? 'background:var(--color-surface2);opacity:0.35;cursor:not-allowed'
                            : isSel(t.number)
                              ? 'background:var(--color-gold);color:white'
                              : 'background:var(--color-bg);border:1px solid var(--color-border)'">
                    <p class="font-bold text-sm">{{ t.number }}</p>
                    <p class="text-xs">{{ busyByOther(t.number) ? 'занят' : isSel(t.number) ? '✓' : 'свободен' }}</p>
                  </button>
                }
              </div>
            }
          }
          @if (selected.length) {
            <div class="sticky bottom-0 pt-3" style="background:white">
              <button (click)="doMove()" [disabled]="saving()"
                      class="btn btn-primary btn-full" style="height:48px">
                {{ saving() ? '...' : 'Пересадить → ' + selected.join('+') }}
              </button>
            </div>
          }
        } @else {
          <p class="text-center py-6" style="color:var(--color-muted)">Столы не настроены</p>
        }
      </div>
    </div>
  `,
})
export class MoveTableSheet {
  private orderApi = inject(OrderApi);
  private toast = inject(ToastService);

  @Input({ required: true }) set order(o: Order) {
    this._order = o;
    this.selected = this.tablesOf(o);
  }
  get order() { return this._order; }
  private _order!: Order;

  @Input() zones: Zone[] = [];
  /** Номера столов, занятых ДРУГИМИ заказами (родитель считает с учётом текущего). */
  @Input() occupiedByOthers = new Set<string>();

  @Output() moved  = new EventEmitter<Order>();
  @Output() closed = new EventEmitter<void>();

  selected: string[] = [];
  saving = signal(false);

  get hasTables(): boolean { return this.zones.some(z => z.tables.length > 0); }

  private tablesOf(o: Order): string[] {
    return o.table_number.split('+').map(s => s.trim()).filter(Boolean);
  }
  isCurrent(num: string): boolean { return this.tablesOf(this._order).includes(num); }
  busyByOther(num: string): boolean { return this.occupiedByOthers.has(num) && !this.isCurrent(num); }
  isSel(num: string): boolean { return this.selected.includes(num); }

  onSelect(num: string) {
    if (this.busyByOther(num)) return;
    this.selected = this.isSel(num)
      ? this.selected.filter(t => t !== num)
      : [...this.selected, num];
  }

  doMove() {
    if (this.saving() || !this.selected.length) return;
    const newNumber = this.selected.join('+');
    if (newNumber === this._order.table_number) { this.closed.emit(); return; }
    this.saving.set(true);
    this.orderApi.moveOrderTable(this._order.id, newNumber).subscribe({
      next: u => { this.saving.set(false); this.moved.emit(u); this.toast.success(`Стол → ${newNumber}`); },
      error: err => { this.saving.set(false); this.toast.apiError(err, 'Ошибка пересадки'); },
    });
  }
}