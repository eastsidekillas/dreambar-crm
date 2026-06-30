import { Component, EventEmitter, Input, Output, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderApi } from '../../../entities/order';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { KitchenTicket, KitchenItem, KitchenStatus } from '../../../core/models';
import {
  LucideCheck, LucideCheckCheck, LucideX, LucideCircleCheck, LucideClock, LucidePlay,
} from '@lucide/angular';
import { tableChips, urgencyColor, itemRail, MONO, LIST_TAB_HOST } from './bar-ui';

/** Вкладка «Заказы» — KDS бара: активные тикеты и готовые к выдаче. */
@Component({
  selector: 'bar-orders-tab',
  standalone: true,
  imports: [CommonModule, LucideCheck, LucideCheckCheck, LucideX, LucideCircleCheck, LucideClock, LucidePlay],
  host: { style: LIST_TAB_HOST },
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
            style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-content:start;align-items:start">
        @for (t of active; track t.order_id) {
          <div class="rounded-lg overflow-hidden flex flex-col"
               style="background:#1e293b;border:1px solid #2a3852"
               [style.border-left]="'4px solid ' + urgencyColor(t.elapsed_min)">

            <!-- Docket header -->
            <div class="px-3 pt-2.5 pb-2 flex items-start justify-between gap-2">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="font-bold leading-none" [style]="MONO"
                        style="font-size:1.2rem;color:#e8edf4;letter-spacing:0.02em">#{{ t.order_id }}</span>
                  @for (chip of tableChips(t.table_number); track chip) {
                    <span class="font-semibold px-1.5 py-0.5 rounded whitespace-nowrap" [style]="MONO"
                          style="font-size:0.78rem;background:#26334a;color:#cbd5e1">{{ chip }}</span>
                  }
                </div>
                <span class="block mt-1" [style]="MONO" style="font-size:0.72rem;color:#64748b">{{ t.waiter_name }}</span>
              </div>
              <span class="flex items-center gap-1 whitespace-nowrap flex-shrink-0 rounded font-semibold"
                    [style]="MONO" [style.color]="urgencyColor(t.elapsed_min)"
                    [style.border]="'1px solid ' + urgencyColor(t.elapsed_min) + '66'"
                    style="font-size:0.78rem;padding:2px 7px;background:rgba(0,0,0,0.18)">
                <svg lucideClock [size]="12"></svg> {{ t.elapsed_min }} мин
              </span>
            </div>

            <!-- Перфорация (отрывной край докета) -->
            <div style="border-top:1px dashed rgba(148,163,184,0.22)"></div>

            <!-- Заметка официанта ко всему заказу -->
            @if (t.notes) {
              <div class="px-3 py-2 mx-3 mt-2 rounded-r"
                   style="border-left:3px solid #f59e0b;background:rgba(245,158,11,0.09)">
                <span class="block uppercase tracking-wider mb-0.5" [style]="MONO" style="font-size:0.62rem;color:#b07a2e">заметка</span>
                <span class="block text-sm" style="color:#fcd9a8;white-space:pre-wrap;word-break:break-word">{{ t.notes }}</span>
              </div>
            }

            <!-- Посуда к столу (не в счёте) -->
            @if (t.glassware?.length) {
              <div class="px-3 py-2 mx-3 mt-2 rounded-r"
                   style="border-left:3px solid #38bdf8;background:rgba(56,189,248,0.08)">
                <span class="block uppercase tracking-wider mb-0.5" [style]="MONO" style="font-size:0.62rem;color:#5b91ad">посуда</span>
                <span class="text-sm" style="color:#bae6fd">
                  @for (g of t.glassware; track g.kind) {
                    <span class="whitespace-nowrap">{{ g.label }} <span [style]="MONO">×{{ g.count }}</span>@if (!$last) {<span style="color:#475569"> · </span>}</span>
                  }
                </span>
              </div>
            }

            <!-- Леджер напитков -->
            <div class="px-3 pt-1.5 flex-1">
              @for (it of t.items; track it.id; let first = $first) {
                <div class="py-2.5"
                     [style.border-top]="first ? 'none' : '1px solid rgba(148,163,184,0.10)'"
                     [style.opacity]="it.kitchen_status === 'ready' ? '0.5' : '1'">

                  <div class="flex items-start gap-2.5">
                    <!-- статусный рейл -->
                    <span class="flex-shrink-0 self-stretch rounded-full" style="width:3px"
                          [style.background]="itemRail(it.kitchen_status)"></span>

                    <!-- количество (моно, по правому краю) -->
                    <span class="font-bold flex-shrink-0 text-right" [style]="MONO"
                          style="min-width:2.3rem;font-size:1.05rem"
                          [style.color]="it.kitchen_status === 'cooking' ? '#f59e0b' : '#e8edf4'">{{ it.quantity }}×</span>

                    <!-- название + мета -->
                    <div class="flex-1 min-w-0">
                      <span class="font-semibold leading-snug" style="word-break:break-word;color:#e8edf4"
                            [class.line-through]="it.kitchen_status === 'ready'">{{ it.name }}</span>
                      @if (it.volume || it.modifiers?.length) {
                        <p class="mt-0.5" [style]="MONO" style="font-size:0.74rem;color:#7c8aa0;word-break:break-word">
                          @if (it.volume) { <span>{{ it.volume }}</span> }
                          @if (it.volume && it.modifiers?.length) { <span style="color:#475569"> · </span> }
                          @if (it.modifiers?.length) { <span style="color:#c79248">+ {{ it.modifiers!.join(' · ') }}</span> }
                        </p>
                      }
                    </div>

                    <!-- действие -->
                    <div class="flex-shrink-0 flex items-center gap-1.5">
                      @if (it.kitchen_status === 'new') {
                        <button (click)="setStatus(it, 'cooking')"
                                class="rounded-lg font-bold flex items-center gap-1"
                                style="background:#f59e0b;color:#0f172a;min-height:44px;padding:0 15px;font-size:0.88rem">
                          <svg lucidePlay [size]="14"></svg> Начать
                        </button>
                      } @else if (it.kitchen_status === 'cooking') {
                        <button (click)="setStatus(it, 'ready')"
                                class="rounded-lg font-bold flex items-center gap-1"
                                style="background:#22c55e;color:#0f172a;min-height:44px;padding:0 15px;font-size:0.88rem">
                          <svg lucideCheck [size]="16"></svg> Готово
                        </button>
                      } @else {
                        <svg lucideCircleCheck [size]="22" style="color:#22c55e"></svg>
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
                                style="background:transparent;color:#475569;min-width:36px;min-height:36px"
                                title="Удалить"><svg lucideX [size]="15"></svg></button>
                      }
                    </div>
                  </div>

                  <!-- комментарий гостя — во всю ширину, с отступом под названием -->
                  @if (it.comment) {
                    <div class="mt-1.5 pl-2 pr-2 py-1 rounded-r" style="margin-left:3.4rem;
                         border-left:2px solid #f59e0b;background:rgba(245,158,11,0.10)">
                      <span class="block" style="font-size:0.84rem;line-height:1.3;color:#fcd9a8;white-space:pre-wrap;word-break:break-word">{{ it.comment }}</span>
                    </div>
                  }
                </div>
              }
            </div>

            <!-- Все напитки готовы -->
            <button (click)="markAllReady(t)"
                    class="font-bold flex items-center justify-center gap-2"
                    style="background:#15803d;color:white;min-height:52px;font-size:0.95rem;border:none;border-top:1px solid rgba(0,0,0,0.25);width:100%">
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
  urgencyColor  = urgencyColor;
  itemRail      = itemRail;
  MONO          = MONO;

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

}
