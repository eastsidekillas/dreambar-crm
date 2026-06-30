import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { KitchenTicket } from '../../../core/models';
import { LucideCircleCheck, LucideClock } from '@lucide/angular';
import { tableChips, urgencyColor, kitchenItemStatusChip, LIST_TAB_HOST } from './bar-ui';

/** Вкладка «Кухня» — read-only монитор готовности блюд для бармена. */
@Component({
  selector: 'bar-kitchen-monitor-tab',
  standalone: true,
  imports: [CommonModule, LucideCircleCheck, LucideClock],
  host: { style: LIST_TAB_HOST },
  template: `
    @if (noShift) {
      <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
        <span class="text-6xl mb-4">😴</span>
        <p class="text-xl font-bold mb-1">Смена не открыта</p>
      </div>
    } @else if (!active.length && !ready.length) {
      <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
        <svg lucideCircleCheck [size]="48" class="mb-3" style="color:#4ADE80"></svg>
        <p class="text-lg font-bold mb-1">Кухня свободна</p>
        <p style="color:#64748b">Активных заказов нет</p>
      </div>
    } @else {

      <!-- Готовые блюда — наверху, выделено зелёным -->
      @if (ready.length) {
        <section class="px-3 pt-3">
          <p class="text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1" style="color:#22c55e">
            <svg lucideCircleCheck [size]="14"></svg> Готово к выдаче ({{ ready.length }})
          </p>
          <div class="grid gap-2 mb-3"
               style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
            @for (t of ready; track t.order_id) {
              <div class="rounded-xl p-3" style="background:#14532d;border:1px solid #166534">
                <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span class="font-bold" style="color:#4ade80">#{{ t.order_id }}</span>
                  @for (chip of tableChips(t.table_number); track chip) {
                    <span class="text-sm font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                          style="background:rgba(0,0,0,0.3);color:#bbf7d0">{{ chip }}</span>
                  }
                  <span class="text-xs ml-auto" style="color:#86efac">{{ t.waiter_name }}</span>
                </div>
                @for (it of t.items; track it.id) {
                  <p class="text-sm" style="color:#bbf7d0">{{ it.quantity }}× {{ it.name }}</p>
                }
              </div>
            }
          </div>
        </section>
      }

      <!-- В работе -->
      @if (active.length) {
        <section class="px-3 pt-1 pb-4">
          <p class="text-xs font-bold mb-2 uppercase tracking-wider flex items-center gap-1" style="color:#f59e0b">
            <svg lucideClock [size]="14"></svg> Готовится ({{ active.length }})
          </p>
          <div class="grid gap-2"
               style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
            @for (t of active; track t.order_id) {
              <div class="rounded-xl p-3"
                   style="background:#1e293b;border:2px solid"
                   [style.border-color]="urgencyColor(t.elapsed_min, 'food')">
                <div class="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span class="font-bold" style="color:#f59e0b">#{{ t.order_id }}</span>
                  @for (chip of tableChips(t.table_number); track chip) {
                    <span class="text-sm font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                          style="background:#334155;color:#f1f5f9">{{ chip }}</span>
                  }
                  <span class="text-xs font-bold ml-auto whitespace-nowrap" [style.color]="urgencyColor(t.elapsed_min, 'food')">
                    <svg lucideClock [size]="12" class="inline-block mr-0.5"></svg> {{ t.elapsed_min }} мин
                  </span>
                </div>
                @for (it of t.items; track it.id) {
                  <div class="flex items-center justify-between text-sm py-0.5">
                    <span>{{ it.quantity }}× {{ it.name }}</span>
                    <span class="text-xs px-2 py-0.5 rounded-full" [style]="kitchenItemStatusChip(it.kitchen_status)">
                      {{ it.kitchen_status === 'cooking' ? 'готовится' : 'ожидает' }}
                    </span>
                  </div>
                }
              </div>
            }
          </div>
        </section>
      }
    }
  `,
})
export class BarKitchenMonitorTab {
  @Input({ required: true }) active: KitchenTicket[] = [];
  @Input({ required: true }) ready: KitchenTicket[] = [];
  @Input() noShift = false;

  tableChips            = tableChips;
  urgencyColor          = urgencyColor;
  kitchenItemStatusChip = kitchenItemStatusChip;
}
