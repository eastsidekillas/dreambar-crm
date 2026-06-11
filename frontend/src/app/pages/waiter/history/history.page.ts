import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { formatDateTime as fmtDateTime } from '../../../shared/lib/formatters';
import { CommonModule } from '@angular/common';
import { OrderApi } from '../../../entities/order';
import { ShiftApi } from '../../../entities/shift';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { Receipt } from '../../../core/models';
import { LucideReceipt, LucideClock, LucidePrinter } from '@lucide/angular';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, LucideReceipt, LucideClock, LucidePrinter],
  template: `
    <div class="space-y-3 pb-4">
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-base">Чеки смены</h2>
        <span class="badge badge-gray">{{ receipts().length }} чеков</span>
      </div>

      <div class="card text-center">
        <p class="text-3xl font-bold" style="color:var(--color-gold-hover)">{{ total() | number:'1.0-0' }} ₽</p>
        <p class="text-xs mt-1 section-title">Сумма по чекам</p>
      </div>

      @for (r of receipts(); track r.id) {
        <div class="card">
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm flex items-center gap-1" style="color:var(--color-text)"><svg lucideReceipt [size]="14"></svg> {{ r.code }}</span>
              @if (r.table_number) { <span class="badge badge-gray">{{ r.table_number }}</span> }
              <span class="badge badge-green">{{ r.payment_label }}</span>
            </div>
            <span class="font-bold" style="color:var(--color-gold-hover)">{{ r.total | number:'1.0-0' }} ₽</span>
          </div>

          <div class="space-y-1">
            @for (item of r.items; track item.id) {
              <div class="flex items-center gap-2 text-sm">
                <span class="flex-1" style="color:var(--color-text)">{{ item.menu_item_name }}</span>
                <span style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="font-medium" style="color:var(--color-gold-hover); min-width:56px; text-align:right">
                  {{ item.subtotal | number:'1.0-0' }} ₽
                </span>
              </div>
            }
          </div>

          <div class="flex items-center justify-between mt-2">
            <p class="text-xs flex items-center gap-1" style="color:var(--color-light)"><svg lucideClock [size]="12"></svg> {{ formatTime(r.issued_at) }} · {{ r.waiter_name }}</p>
            <button (click)="reprint(r)" class="btn btn-ghost btn-sm flex items-center gap-1"><svg lucidePrinter [size]="14"></svg> Печать</button>
          </div>
        </div>
      }

      @if (!receipts().length) {
        <div class="card text-center py-12">
          <svg lucideReceipt [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Чеков за эту смену нет</p>
        </div>
      }
    </div>
  `
})
export class HistoryPage implements OnInit {
  private orderApi = inject(OrderApi);
  private shiftApi = inject(ShiftApi);
  private printer = inject(ReceiptPrintService);

  receipts = signal<Receipt[]>([]);
  total = computed(() => this.receipts().reduce((s, r) => s + +r.total, 0));

  ngOnInit() {
    this.shiftApi.getCurrentShift().subscribe({
      next: s => this.orderApi.getReceipts(s.id).subscribe(r => this.receipts.set(r)),
      error: () => this.orderApi.getReceipts().subscribe(r => this.receipts.set(r)),
    });
  }

  reprint(r: Receipt) { this.printer.printHardware(r); }

  formatTime(dt: string) { return fmtDateTime(dt); }
}