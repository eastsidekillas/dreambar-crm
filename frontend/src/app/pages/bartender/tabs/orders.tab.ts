import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderApi } from '../../../entities/order';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { KitchenTicket, KitchenItem, KitchenStatus } from '../../../core/models';
import {
  LucideCheck, LucideCheckCheck, LucideX, LucideCircleCheck, LucideClock, LucidePlay,
  LucideMessageSquare,
} from '@lucide/angular';
import { tableChips } from './bar-ui';

/** Вкладка «Заказы» — KDS бара: активные тикеты и готовые к выдаче. */
@Component({
  selector: 'bar-orders-tab',
  standalone: true,
  imports: [CommonModule, LucideCheck, LucideCheckCheck, LucideX, LucideCircleCheck, LucideClock, LucidePlay, LucideMessageSquare],
  host: { style: 'display: contents' },
  template: `
    @if (noShift) {
      <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
        <span class="text-6xl mb-4">😴</span>
        <p class="text-xl font-bold mb-1">Смена не открыта</p>
        <p class="mb-6" style="color:#64748b">Открой смену, чтобы принимать заказы</p>
        <button (click)="openShift.emit()" [disabled]="openingShift"
                class="rounded-xl font-bold flex items-center gap-2 px-8"
                style="background:#22c55e;color:#0f172a;min-height:56px;font-size:1.05rem">
          <svg lucidePlay [size]="20"></svg>
          {{ openingShift ? 'Открываем...' : 'Открыть смену' }}
        </button>
      </div>
    } @else if (!active.length) {
      <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
        <svg lucideCircleCheck [size]="48" class="mb-3" style="color:#22c55e"></svg>
        <p class="text-lg font-bold mb-1">Нет напитков в работе</p>
        <p style="color:#64748b">Новые заказы появятся здесь автоматически</p>
      </div>
    } @else {
      <main class="p-3 grid gap-3"
            style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-content:start">
        @for (t of active; track t.order_id) {
          <div class="rounded-xl overflow-hidden flex flex-col"
               style="background:#1e293b;border:2px solid"
               [style.border-color]="urgencyColor(t.elapsed_min)">

            <!-- Ticket header -->
            <div class="px-3 py-2.5 flex items-start justify-between gap-2"
                 [style.background]="urgencyColor(t.elapsed_min) + '22'">
              <div class="flex items-center gap-1.5 flex-wrap min-w-0">
                <span class="font-bold text-lg" style="color:#f59e0b">#{{ t.order_id }}</span>
                @for (chip of tableChips(t.table_number); track chip) {
                  <span class="text-sm font-bold px-2 py-0.5 rounded whitespace-nowrap"
                        style="background:#334155;color:#f1f5f9">{{ chip }}</span>
                }
                <span class="text-xs" style="color:#94a3b8">{{ t.waiter_name }}</span>
              </div>
              <span class="text-sm font-bold whitespace-nowrap flex-shrink-0 mt-1"
                    [style.color]="urgencyColor(t.elapsed_min)">
                <svg lucideClock [size]="12" class="inline-block mr-0.5"></svg> {{ t.elapsed_min }} мин
              </span>
            </div>

            <!-- Комментарий официанта -->
            @if (t.notes) {
              <div class="px-3 py-2 flex items-start gap-2 text-sm font-semibold"
                   style="background:#422006;color:#fbbf24;border-bottom:1px solid #334155">
                <svg lucideMessageSquare [size]="14" class="flex-shrink-0 mt-0.5"></svg>
                <span style="white-space:pre-wrap">{{ t.notes }}</span>
              </div>
            }

            <!-- Посуда к столу (не в счёте) -->
            @if (t.glassware?.length) {
              <div class="px-3 py-2 flex items-center flex-wrap gap-x-3 gap-y-1 text-sm font-semibold"
                   style="background:#0c4a6e;color:#7dd3fc;border-bottom:1px solid #334155">
                <span>🍷 Посуда:</span>
                @for (g of t.glassware; track g.kind) {
                  <span>{{ g.label }} ×{{ g.count }}</span>
                }
              </div>
            }

            <!-- Drinks -->
            <div class="p-3 flex-1 space-y-2">
              @for (it of t.items; track it.id) {
                <div class="rounded-lg p-3 flex items-center justify-between gap-3"
                     [style.background]="itemBg(it.kitchen_status)"
                     [style.opacity]="it.kitchen_status === 'ready' ? '0.5' : '1'">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-baseline gap-2">
                      <span class="text-xl font-bold flex-shrink-0" style="color:#f59e0b">{{ it.quantity }}×</span>
                      <span class="font-semibold leading-tight" style="word-break:break-word">{{ it.name }}</span>
                    </div>
                    @if (it.volume) {
                      <p class="text-xs mt-0.5" style="color:#94a3b8">{{ it.volume }}</p>
                    }
                    @if (it.modifiers?.length) {
                      <div class="flex flex-wrap gap-1 mt-1">
                        @for (m of it.modifiers; track m) {
                          <span class="text-xs font-semibold px-2 py-0.5 rounded" style="background:#3a2e12;color:#fbbf24">{{ m }}</span>
                        }
                      </div>
                    }
                    @if (it.comment) {
                      <div class="flex items-start gap-1.5 mt-1.5 text-sm font-semibold" style="color:#fbbf24">
                        <svg lucideMessageSquare [size]="13" class="flex-shrink-0 mt-0.5"></svg>
                        <span style="white-space:pre-wrap;word-break:break-word">{{ it.comment }}</span>
                      </div>
                    }
                  </div>
                  <div class="flex-shrink-0 flex items-center gap-2">
                    @if (it.kitchen_status === 'new') {
                      <button (click)="setStatus(it, 'cooking')"
                              class="rounded-xl font-bold"
                              style="background:#f59e0b;color:#0f172a;min-height:48px;padding:0 18px;font-size:0.9rem">
                        ▶ Начать
                      </button>
                    } @else if (it.kitchen_status === 'cooking') {
                      <button (click)="setStatus(it, 'ready')"
                              class="rounded-xl font-bold flex items-center gap-1"
                              style="background:#22c55e;color:#0f172a;min-height:48px;padding:0 18px;font-size:0.9rem">
                        <svg lucideCheck [size]="16"></svg> Готово
                      </button>
                    } @else {
                      <span class="rounded-xl font-bold flex items-center gap-1"
                            style="background:#15803d;color:white;min-height:40px;padding:0 14px;font-size:0.85rem">
                        <svg lucideCheck [size]="14"></svg> Готов
                      </span>
                    }
                    @if (confirmDelete() === it.id) {
                      <button (click)="removeItem(t.order_id, it)"
                              class="rounded-lg font-bold"
                              style="background:#ef4444;color:white;min-height:44px;padding:0 12px;font-size:0.85rem">
                        Да
                      </button>
                      <button (click)="confirmDelete.set(null)"
                              class="rounded-lg"
                              style="background:#334155;color:#94a3b8;min-height:44px;padding:0 12px;font-size:0.85rem">
                        Нет
                      </button>
                    } @else {
                      <button (click)="confirmDelete.set(it.id)"
                              class="rounded-lg flex items-center justify-center"
                              style="background:#334155;color:#94a3b8;min-width:44px;min-height:44px"
                              title="Удалить"><svg lucideX [size]="16"></svg></button>
                    }
                  </div>
                </div>
              }
            </div>

            <!-- Mark all ready -->
            <button (click)="markAllReady(t)"
                    class="font-bold flex items-center justify-center gap-2"
                    style="background:#15803d;color:white;min-height:56px;font-size:1rem;border:none;width:100%">
              <svg lucideCheckCheck [size]="18"></svg> Все напитки готовы
            </button>
          </div>
        }
      </main>
    }

    <!-- Ready tickets (collapsed) -->
    @if (ready.length) {
      <section class="px-3 pb-4 mt-1">
        <button (click)="showReady.set(!showReady())"
                class="flex items-center gap-2 mb-2 text-sm font-semibold"
                style="color:#64748b">
          {{ showReady() ? '▾' : '▸' }} Готово к выдаче ({{ ready.length }})
        </button>
        @if (showReady()) {
          <div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
            @for (t of ready; track t.order_id) {
              <div class="rounded-lg p-3" style="background:#14532d;border:1px solid #166534">
                <div class="flex items-center justify-between mb-1">
                  <span class="font-bold" style="color:#4ade80">#{{ t.order_id }}
                    @if (t.table_number) { · {{ t.table_number }} }
                  </span>
                </div>
                @for (it of t.items; track it.id) {
                  <p class="text-sm" style="color:#bbf7d0">{{ it.quantity }}× {{ it.name }}@if (it.modifiers?.length) {<span style="color:#fbbf24"> · {{ it.modifiers!.join(', ') }}</span>}</p>
                }
              </div>
            }
          </div>
        }
      </section>
    }
  `,
})
export class BarOrdersTab {
  @Input({ required: true }) active: KitchenTicket[] = [];
  @Input() ready: KitchenTicket[] = [];
  @Input() noShift = false;
  @Input() openingShift = false;
  /** Просьба открыть смену — логика смены живёт в странице */
  @Output() openShift = new EventEmitter<void>();
  /** Данные изменились — страница должна перезагрузить заказы */
  @Output() changed = new EventEmitter<void>();

  private orderApi = inject(OrderApi);
  private toast    = inject(ToastService);

  showReady     = signal(false);
  confirmDelete = signal<number | null>(null);
  tableChips    = tableChips;

  setStatus(item: KitchenItem, status: KitchenStatus) {
    item.kitchen_status = status;
    this.orderApi.setKitchenItemStatus(item.id, status).subscribe({
      next: () => { if (status === 'ready') this.changed.emit(); },
      error: err => { this.toast.apiError(err, 'Не удалось изменить статус'); this.changed.emit(); },
    });
  }

  markAllReady(t: KitchenTicket) {
    this.orderApi.markKitchenOrderReady(t.order_id, 'bar').subscribe({
      next: () => this.changed.emit(),
      error: err => { this.toast.apiError(err, 'Не удалось отметить готовность'); this.changed.emit(); },
    });
  }

  removeItem(orderId: number, it: KitchenItem) {
    this.confirmDelete.set(null);
    this.orderApi.removeItemFromOrder(orderId, it.id).subscribe({
      next: () => this.changed.emit(),
      error: err => this.toast.apiError(err, 'Не удалось удалить позицию'),
    });
  }

  itemBg(status: string): string {
    if (status === 'cooking') return '#422006';
    if (status === 'ready')   return '#14532d';
    return '#0f172a';
  }

  urgencyColor(min: number): string {
    if (min >= 10) return '#ef4444';
    if (min >= 5)  return '#f59e0b';
    return '#22c55e';
  }
}
