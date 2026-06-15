import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, OrderItem, Receipt, Reservation } from '../../../core/models';
import * as bill from './order-bill';
import {
  LucideUsers, LucideCheck, LucidePencil, LucideMessageCircle, LucideCalendar,
  LucideBanknote, LucideClock, LucideX, LucideReceipt, LucidePlus,
  LucideArrowLeftRight, LucideCreditCard,
} from '@lucide/angular';

/** Карточка моего заказа: позиции по гостям, чеки, действия (дозаказ/пересадка/счёт/освободить). */
@Component({
  selector: 'order-card',
  standalone: true,
  imports: [CommonModule, LucideUsers, LucideCheck, LucidePencil, LucideMessageCircle,
            LucideCalendar, LucideBanknote, LucideClock, LucideX, LucideReceipt, LucidePlus,
            LucideArrowLeftRight, LucideCreditCard],
  template: `
    <div class="overflow-hidden" [id]="'order-' + order.id"
         style="background:white;border:1px solid var(--color-border);border-radius:12px">

      <div class="flex items-center justify-between px-3 py-2.5"
           style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-bold text-base truncate">{{ order.table_number || 'Стол' }}</span>
          @if (order.guests) {
            <span class="text-xs flex items-center gap-0.5 flex-shrink-0" style="color:var(--color-muted)">· <svg lucideUsers [size]="12"></svg> {{ order.guests }}</span>
          }
          @if (readyCount(order) > 0) {
            <span class="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold animate-pulse flex items-center gap-0.5"
                  style="background:#16a34a;color:white"><svg lucideCheck [size]="10"></svg> {{ readyCount(order) }}</span>
          }
          <button (click)="edit.emit()" class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
                  style="color:var(--color-muted)"><svg lucidePencil [size]="14"></svg></button>
        </div>
        <div class="flex items-center gap-2 flex-shrink-0">
          <span class="text-xs" style="color:var(--color-muted)">{{ elapsed(order) }}</span>
          <span class="font-bold text-sm" style="color:var(--color-gold-hover)">
            {{ unpaidTotal(order) | number:'1.0-0' }} ₽
          </span>
        </div>
      </div>

      @if (order.notes) {
        <div class="px-3 py-2 text-xs flex items-start gap-1.5"
             style="background:#fffbeb;border-bottom:1px solid var(--color-gold-mid);color:#92400e">
          <svg lucideMessageCircle [size]="12" class="flex-shrink-0 mt-0.5"></svg><span>{{ order.notes }}</span>
        </div>
      }

      @if (reservation) {
        <div class="px-3 py-2 text-xs flex items-center gap-1.5"
             style="background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1d4ed8">
          <svg lucideCalendar [size]="12" class="flex-shrink-0"></svg>
          <span class="font-medium">{{ reservation.name }}</span>
          <span style="color:#3b82f6">{{ reservation.time_start }}</span>
          <span class="flex items-center gap-0.5">· <svg lucideUsers [size]="12"></svg> {{ reservation.guests_count }}</span>
          @if (+reservation.deposit_amount > 0) {
            <span class="ml-auto font-medium flex items-center gap-0.5"><svg lucideBanknote [size]="12"></svg> {{ +reservation.deposit_amount | number:'1.0-0' }} ₽</span>
          }
        </div>
      }

      @if (unpaidItems(order).length) {
        @for (grp of guestGroups(order); track grp.guest) {
          <div class="px-3 py-2" style="border-bottom:1px solid var(--color-border)">
            <div class="flex items-center justify-between mb-1">
              <span class="section-title">{{ guestLabel(grp.guest) }}</span>
              <span class="text-xs font-bold" style="color:var(--color-gold-hover)">
                {{ grp.total | number:'1.0-0' }} ₽
              </span>
            </div>
            @for (item of grp.items; track item.id) {
              <div class="flex items-center gap-2 py-0.5">
                <span class="flex-1 text-sm truncate">{{ item.menu_item_name }}</span>
                <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                @if (item.kitchen_status === 'ready') {
                  <svg lucideCheck [size]="12" style="color:#16a34a;flex-shrink:0"></svg>
                } @else if (item.kitchen_status === 'cooking') {
                  <svg lucideClock [size]="12" style="color:var(--color-amber);flex-shrink:0"></svg>
                }
                @if (confirmDeleteId() === item.id) {
                  <button (click)="removeItem.emit(item); confirmDeleteId.set(null)"
                          class="text-xs font-bold px-1.5 py-0.5 rounded"
                          style="background:#ef4444;color:white">Да</button>
                  <button (click)="confirmDeleteId.set(null)"
                          class="text-xs px-1.5 py-0.5 rounded"
                          style="background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)">Нет</button>
                } @else {
                  <button (click)="confirmDeleteId.set(item.id)"
                          class="w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0"
                          style="color:var(--color-muted)"><svg lucideX [size]="12"></svg></button>
                }
              </div>
            }
          </div>
        }
      } @else {
        <div class="px-3 py-3 text-xs text-center"
             style="color:var(--color-muted);border-bottom:1px solid var(--color-border)">
          Все позиции оплачены
        </div>
      }

      @if (order.receipts.length) {
        <div class="flex flex-wrap gap-1 px-3 py-2" style="border-bottom:1px solid var(--color-border)">
          @for (r of order.receipts; track r.id) {
            <button (click)="reprint.emit(r)" class="badge badge-green flex items-center gap-1" style="cursor:pointer">
              <svg lucideReceipt [size]="12"></svg> {{ r.code }} · {{ r.total | number:'1.0-0' }} ₽
            </button>
          }
        </div>
      }

      @if (isEmpty(order)) {
        <!-- Пустой стол: ничего не заказали → можно освободить -->
        <div style="display:grid;grid-template-columns:1fr 1fr">
          @if (confirmFree()) {
            <button (click)="free.emit(); confirmFree.set(false)"
                    class="flex items-center justify-center gap-1 py-3 font-bold text-sm"
                    style="border-right:1px solid var(--color-border);background:#ef4444;color:white">
              <svg lucideX [size]="14"></svg> Удалить стол
            </button>
            <button (click)="confirmFree.set(false)"
                    class="flex items-center justify-center py-3 font-medium text-sm"
                    style="color:var(--color-muted)">Отмена</button>
          } @else {
            <button (click)="addMore.emit()"
                    class="flex items-center justify-center gap-1 py-3 font-semibold text-sm"
                    style="border-right:1px solid var(--color-border);color:var(--color-text)">
              <svg lucidePlus [size]="14"></svg> Дозаказ
            </button>
            <button (click)="confirmFree.set(true)"
                    class="flex items-center justify-center gap-1 py-3 font-medium text-sm"
                    style="color:var(--color-red)">
              <svg lucideX [size]="14"></svg> Освободить
            </button>
          }
        </div>
      } @else {
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr">
          <button (click)="addMore.emit()"
                  class="flex items-center justify-center gap-1 py-3 font-semibold text-sm"
                  style="border-right:1px solid var(--color-border);color:var(--color-text)">
            <svg lucidePlus [size]="14"></svg> Дозаказ
          </button>
          <button (click)="move.emit()"
                  class="flex items-center justify-center gap-1 py-3 font-medium text-sm"
                  style="border-right:1px solid var(--color-border);color:var(--color-muted)">
            <svg lucideArrowLeftRight [size]="14"></svg> Пересадить
          </button>
          <button (click)="checkout.emit()" [disabled]="!unpaidItems(order).length"
                  class="flex items-center justify-center gap-1 py-3 font-bold text-sm"
                  [style]="unpaidItems(order).length
                    ? 'background:var(--color-gold);color:white'
                    : 'color:var(--color-muted)'">
            <svg lucideCreditCard [size]="14"></svg> Счёт
          </button>
        </div>
      }
    </div>
  `,
})
export class OrderCard {
  @Input({ required: true }) order!: Order;
  @Input() reservation: Reservation | null = null;

  @Output() edit       = new EventEmitter<void>();
  @Output() addMore    = new EventEmitter<void>();
  @Output() move       = new EventEmitter<void>();
  @Output() checkout   = new EventEmitter<void>();
  @Output() removeItem = new EventEmitter<OrderItem>();
  @Output() free       = new EventEmitter<void>();
  @Output() reprint    = new EventEmitter<Receipt>();

  confirmDeleteId = signal<number | null>(null);
  confirmFree     = signal(false);

  // расчёт из общего util — выставлен полями, чтобы вызывать из шаблона
  readyCount  = bill.readyCount;
  elapsed     = bill.elapsed;
  unpaidTotal = bill.unpaidTotal;
  unpaidItems = bill.unpaidItems;
  guestGroups = bill.guestGroups;
  guestLabel  = bill.guestLabel;
  isEmpty     = bill.isEmpty;
}