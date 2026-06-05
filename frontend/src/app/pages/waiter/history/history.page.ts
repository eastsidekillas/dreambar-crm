import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Order } from '../../../core/models';

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-3 pb-4">
      <div class="flex items-center justify-between">
        <h2 class="font-bold text-base">История заказов</h2>
        <span class="badge badge-gray">{{ orders().length }} заказов</span>
      </div>

      @for (order of orders(); track order.id) {
        <div class="card">
          <!-- Header -->
          <div class="flex items-center justify-between mb-2">
            <div class="flex items-center gap-2">
              <span class="font-bold text-sm" style="color:var(--color-text)">#{{ order.id }}</span>
              <span class="badge" [class]="statusBadge(order.status)">
                {{ statusLabel(order.status) }}
              </span>
              @if (order.table_number) {
                <span class="badge badge-gray">{{ order.table_number }}</span>
              }
            </div>
            <span class="font-bold" style="color:var(--color-gold-hover)">
              {{ order.total | number:'1.0-0' }} ₽
            </span>
          </div>

          <!-- Items -->
          <div class="space-y-1">
            @for (item of order.items; track item.id) {
              <div class="flex items-center gap-2 text-sm">
                <span class="flex-1" style="color:var(--color-text)">{{ item.menu_item_name }}</span>
                <span style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="font-medium" style="color:var(--color-gold-hover); min-width:56px; text-align:right">
                  {{ item.subtotal | number:'1.0-0' }} ₽
                </span>
              </div>
            }
          </div>

          <p class="text-xs mt-2" style="color:var(--color-light)">
            🕐 {{ formatTime(order.created_at) }}
          </p>
        </div>
      }

      @if (!orders().length) {
        <div class="card text-center py-12">
          <span class="text-4xl block mb-3">📋</span>
          <p style="color:var(--color-muted)">Заказов за эту смену нет</p>
        </div>
      }
    </div>
  `
})
export class HistoryPage implements OnInit {
  orders = signal<Order[]>([]);

  constructor(private api: ApiService) {}
  ngOnInit() { this.api.getMyOrders().subscribe(o => this.orders.set(o)); }

  statusLabel(s: string) { return s === 'open' ? 'Открыт' : s === 'closed' ? 'Принят' : 'Отменён'; }
  statusBadge(s: string) { return s === 'closed' ? 'badge-green' : s === 'open' ? 'badge-amber' : 'badge-red'; }

  formatTime(dt: string) {
    return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}
