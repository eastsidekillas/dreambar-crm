import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucidePencil, LucideX } from '@lucide/angular';
import { Order } from '../../../core/models';
import { OrderApi } from '../../../entities/order';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/** Модалка «Изменить стол»: число гостей и комментарий к заказу. */
@Component({
  selector: 'edit-order-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucidePencil, LucideX],
  template: `
    <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closed.emit()"></div>
    <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
         style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
      <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closed.emit()">
        <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
      </div>
      <div class="flex items-center justify-between px-4 py-3"
           style="border-bottom:1px solid var(--color-border)">
        <h2 class="font-bold text-base flex items-center gap-2"><svg lucidePencil [size]="16"></svg> Изменить стол</h2>
        <button (click)="closed.emit()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
      </div>
      <div class="px-4 py-4 space-y-3">
        <div>
          <label class="section-title block mb-1.5">Гостей</label>
          <input [(ngModel)]="guests" type="number" min="0" class="field" style="height:44px" />
        </div>
        <div>
          <label class="section-title block mb-1.5">Комментарий</label>
          <textarea [(ngModel)]="notes" placeholder="Аллергия, пожелания…"
                    class="field" rows="2" style="resize:none"></textarea>
        </div>
        <button (click)="save()" [disabled]="saving()"
                class="btn btn-primary btn-full" style="height:48px">
          {{ saving() ? '...' : 'Сохранить' }}
        </button>
      </div>
    </div>
  `,
})
export class EditOrderModal {
  private orderApi = inject(OrderApi);
  private toast = inject(ToastService);

  @Input({ required: true }) set order(o: Order) {
    this._order = o;
    this.guests = o.guests || null;
    this.notes  = o.notes || '';
  }
  private _order!: Order;

  @Output() saved  = new EventEmitter<Order>();
  @Output() closed = new EventEmitter<void>();

  guests: number | null = null;
  notes  = '';
  saving = signal(false);

  save() {
    if (this.saving()) return;
    this.saving.set(true);
    this.orderApi.updateOrder(this._order.id, {
      table_number: this._order.table_number,
      guests: this.guests || 0,
      notes:  this.notes.trim(),
    }).subscribe({
      next: u => { this.saving.set(false); this.saved.emit(u); },
      error: () => { this.saving.set(false); this.toast.error('Не удалось сохранить'); },
    });
  }
}