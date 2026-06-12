import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApi } from '../../../entities/inventory';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { PurchaseOrder, PurchaseOrderItem, Product } from '../../../core/models';
import {
  LucideShoppingCart, LucideTriangleAlert, LucideClipboardList,
  LucideMail, LucidePackage, LucideTrash2, LucideX, LucideCircleCheck, LucideQrCode,
} from '@lucide/angular';
import { ReceiptImportModal } from './receipt-import.modal';

@Component({
  selector: 'app-purchases',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideShoppingCart, LucideTriangleAlert, LucideClipboardList,
    LucideMail, LucidePackage, LucideTrash2, LucideX, LucideCircleCheck, LucideQrCode,
    ReceiptImportModal],
  template: `
<div class="space-y-4">

  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideShoppingCart [size]="20"></svg> Закупки</h1>
      <p class="text-xs mt-0.5" style="color:var(--color-muted)">
        Управление заказами поставщикам и оприходованием
      </p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <button (click)="receiptModal.show()" class="btn btn-outline btn-sm flex items-center gap-1.5">
        <svg lucideQrCode [size]="15"></svg> Чек из магазина
      </button>
      <button (click)="createFromLowStock()" class="btn btn-primary btn-sm"
              [disabled]="creating()">
        {{ creating() ? 'Создание...' : '⚡ Создать заявку из остатков' }}
      </button>
    </div>
  </div>

  <!-- Low stock alert -->
  @if (lowStockProducts().length) {
    <div class="rounded-xl p-3 flex items-start gap-3"
         style="background:#fef3c7;border:1px solid #fbbf24">
      <svg lucideTriangleAlert [size]="18" class="flex-shrink-0" style="color:#92400e"></svg>
      <div>
        <p class="text-sm font-semibold" style="color:#92400e">
          {{ lowStockProducts().length }} позиций ниже минимального остатка
        </p>
        <p class="text-xs mt-0.5" style="color:#b45309">
          {{ lowStockProducts().slice(0, 4).map(p => p.name).join(', ') }}
          @if (lowStockProducts().length > 4) { <span>и ещё {{ lowStockProducts().length - 4 }}</span> }
        </p>
      </div>
    </div>
  }

  <!-- Orders list -->
  @if (!orders().length && !loading()) {
    <div class="card text-center py-12">
      <svg lucideClipboardList [size]="48" class="mb-2 mx-auto" style="color:var(--color-muted)"></svg>
      <p style="color:var(--color-muted)">Заказов на закупку пока нет.</p>
      <p class="text-xs mt-1" style="color:var(--color-muted)">
        Нажмите «Создать заявку из остатков» — система автоматически соберёт что заканчивается.
      </p>
    </div>
  }

  <div class="space-y-3">
    @for (order of orders(); track order.id) {
      <div class="card overflow-hidden"
           [style.border-color]="statusColor(order.status)">

        <!-- Header row -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  [style.background]="statusColor(order.status)"></span>
            <div>
              <p class="font-bold text-sm leading-none">Заявка #{{ order.id }}</p>
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">
                {{ formatDate(order.created_at) }}
                @if (order.created_by_name) { · {{ order.created_by_name }} }
              </p>
            </div>
          </div>

          <!-- Store -->
          @if (order.status === 'received') {
            @if (order.store) {
              <span class="text-xs px-2 py-0.5 rounded-full"
                    style="background:var(--color-bg);color:var(--color-muted)">{{ order.store }}</span>
            }
          } @else {
            <input [ngModel]="order.store" (ngModelChange)="order.store = $event"
                   (blur)="saveStore(order)"
                   class="field" style="height:28px;width:130px;font-size:12px"
                   placeholder="Магазин..."/>
          }

          <div class="flex items-center gap-4 flex-1 ml-2">
            <div>
              <p class="font-bold">{{ order.items.length }}</p>
              <p class="text-xs section-title">Позиций</p>
            </div>
            <div>
              <p class="font-bold" style="color:var(--color-gold-hover)">
                {{ orderTotal(order) | number:'1.0-0' }} ₽
              </p>
              <p class="text-xs section-title">Сумма</p>
            </div>
          </div>

          <span class="badge text-xs"
                [style]="statusBadgeStyle(order.status)">
            {{ order.status_label }}
          </span>

          <div class="flex items-center gap-1.5">
            @if (order.status === 'draft') {
              <button (click)="markOrdered(order)" class="btn btn-ghost btn-sm flex items-center gap-1">
                <svg lucideMail [size]="14"></svg> Заказано
              </button>
              <button (click)="openReceive(order)" class="btn btn-primary btn-sm flex items-center gap-1">
                <svg lucidePackage [size]="14"></svg> Оприходовать
              </button>
              <button (click)="deleteOrder(order)" class="btn btn-ghost btn-sm"
                      style="color:#dc2626"><svg lucideTrash2 [size]="14"></svg></button>
            }
            @if (order.status === 'ordered') {
              <button (click)="openReceive(order)" class="btn btn-primary btn-sm flex items-center gap-1">
                <svg lucidePackage [size]="14"></svg> Оприходовать
              </button>
            }
            <button (click)="toggle(order.id)" class="btn btn-ghost btn-sm">
              {{ openedId() === order.id ? '▲' : '▼' }}
            </button>
          </div>
        </div>

        <!-- Items table -->
        @if (openedId() === order.id) {
          <div class="mt-4 pt-4" style="border-top:1px solid var(--color-border)">
            <div class="overflow-x-auto rounded-xl" style="border:1px solid var(--color-border)">
              <table class="w-full text-sm">
                <thead>
                  <tr style="background:var(--color-surface2)">
                    <th class="text-left px-3 py-2 section-title font-medium">Продукт</th>
                    <th class="text-right px-3 py-2 section-title font-medium">Заказано</th>
                    <th class="text-right px-3 py-2 section-title font-medium">Цена</th>
                    <th class="text-right px-3 py-2 section-title font-medium">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of order.items; track item.id) {
                    <tr style="border-top:1px solid var(--color-border)">
                      <td class="px-3 py-2 font-medium">{{ item.product_name }}</td>
                      <td class="px-3 py-2 text-right">
                        {{ item.qty_ordered }} {{ item.product_unit }}
                      </td>
                      <td class="px-3 py-2 text-right" style="color:var(--color-muted)">
                        {{ item.unit_price | number:'1.0-0' }} ₽
                      </td>
                      <td class="px-3 py-2 text-right font-medium"
                          style="color:var(--color-gold-hover)">
                        {{ (item.qty_ordered * item.unit_price) | number:'1.0-0' }} ₽
                      </td>
                    </tr>
                  }
                </tbody>
                <tfoot>
                  <tr style="border-top:2px solid var(--color-border);background:var(--color-surface2)">
                    <td colspan="3" class="px-3 py-2 font-semibold">Итого</td>
                    <td class="px-3 py-2 text-right font-bold" style="color:var(--color-gold-hover)">
                      {{ orderTotal(order) | number:'1.0-0' }} ₽
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        }

      </div>
    }
  </div>

</div>

<!-- ── Receive modal ──────────────────────────────────────────────── -->
@if (receivingOrder()) {
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
       style="background:rgba(0,0,0,0.5)">
    <div class="card w-full max-w-2xl max-h-[90vh] overflow-y-auto" style="background:var(--color-surface)">

      <div class="flex items-center justify-between mb-4">
        <h2 class="font-bold text-lg flex items-center gap-2"><svg lucidePackage [size]="18"></svg> Оприходование — Заявка #{{ receivingOrder()!.id }}</h2>
        <button (click)="receivingOrder.set(null)" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
      </div>

      <p class="text-sm mb-4" style="color:var(--color-muted)">
        Введите фактически полученное количество и цену закупки. После подтверждения остатки на складе обновятся.
      </p>

      <div class="space-y-2 mb-4">
        @for (item of receiveItems(); track item.id) {
          <div class="rounded-xl p-3" style="background:var(--color-surface2)">
            <p class="font-medium text-sm mb-2">{{ item.product_name }}</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="section-title text-xs mb-1 block">
                  Получено ({{ item.product_unit }})
                  <span style="color:var(--color-muted)"> / заказано: {{ item.qty_ordered }}</span>
                </label>
                <input type="number" [(ngModel)]="item.qty_received" min="0"
                       class="field w-full" step="0.001">
              </div>
              <div>
                <label class="section-title text-xs mb-1 block">Цена за ед. (₽)</label>
                <input type="number" [(ngModel)]="item.unit_price" min="0"
                       class="field w-full" step="0.01">
              </div>
            </div>
          </div>
        }
      </div>

      <div class="flex items-center justify-between pt-3"
           style="border-top:1px solid var(--color-border)">
        <div>
          <p class="text-xs section-title">Итого к оприходованию</p>
          <p class="font-bold text-lg" style="color:var(--color-gold-hover)">
            {{ receiveTotal() | number:'1.0-0' }} ₽
          </p>
        </div>
        <div class="flex gap-2">
          <button (click)="receivingOrder.set(null)" class="btn btn-ghost">Отмена</button>
          <button (click)="confirmReceive()" class="btn btn-primary" [disabled]="receiving()">
            @if (!receiving()) {
              <svg lucideCircleCheck [size]="16" class="mr-1 inline-block"></svg>
            }
            {{ receiving() ? 'Оприходование...' : 'Подтвердить' }}
          </button>
        </div>
      </div>

    </div>
  </div>
}

<receipt-import-modal #receiptModal (applied)="load()" />
  `,
})
export class PurchasesPage implements OnInit {
  orders          = signal<PurchaseOrder[]>([]);
  lowStockProducts = signal<Product[]>([]);
  loading         = signal(false);
  creating        = signal(false);
  openedId        = signal<number | null>(null);

  receivingOrder = signal<PurchaseOrder | null>(null);
  receiveItems   = signal<(PurchaseOrderItem & { qty_received: number; unit_price: number })[]>([]);
  receiving      = signal(false);

  receiveTotal = computed(() =>
    this.receiveItems().reduce((s, i) => s + i.qty_received * i.unit_price, 0)
  );

  constructor(private inventoryApi: InventoryApi, private toast: ToastService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.inventoryApi.getPurchaseOrders().subscribe(o => { this.orders.set(o); this.loading.set(false); });
    this.inventoryApi.getLowStock().subscribe(p => this.lowStockProducts.set(p));
  }

  createFromLowStock() {
    this.creating.set(true);
    this.inventoryApi.createPurchaseFromLowStock().subscribe({
      next:  order => { this.orders.update(o => [order, ...o]); this.creating.set(false); },
      error: (e)   => { alert(e.error?.detail ?? 'Ошибка'); this.creating.set(false); },
    });
  }

  saveStore(order: PurchaseOrder) {
    this.inventoryApi.updatePurchaseOrder(order.id, { store: order.store }).subscribe({
      error: () => this.toast.error('Не удалось сохранить магазин'),
    });
  }

  markOrdered(order: PurchaseOrder) {
    this.inventoryApi.updatePurchaseStatus(order.id, 'ordered').subscribe(updated =>
      this.orders.update(os => os.map(o => o.id === updated.id ? updated : o))
    );
  }

  openReceive(order: PurchaseOrder) {
    this.receiveItems.set(order.items.map(i => ({
      ...i,
      qty_received: Number(i.qty_ordered),
      unit_price:   Number(i.unit_price),
    })));
    this.receivingOrder.set(order);
  }

  confirmReceive() {
    const order = this.receivingOrder();
    if (!order) return;
    this.receiving.set(true);
    const items = this.receiveItems().map(i => ({
      id: i.id, qty_received: i.qty_received, unit_price: i.unit_price,
    }));
    this.inventoryApi.receivePurchaseOrder(order.id, items).subscribe({
      next: updated => {
        this.orders.update(os => os.map(o => o.id === updated.id ? updated : o));
        this.receivingOrder.set(null);
        this.receiving.set(false);
        this.inventoryApi.getLowStock().subscribe(p => this.lowStockProducts.set(p));
      },
      error: () => this.receiving.set(false),
    });
  }

  deleteOrder(order: PurchaseOrder) {
    if (!confirm(`Удалить заявку #${order.id}?`)) return;
    this.inventoryApi.deletePurchaseOrder(order.id).subscribe(() =>
      this.orders.update(os => os.filter(o => o.id !== order.id))
    );
  }

  toggle(id: number) {
    this.openedId.set(this.openedId() === id ? null : id);
  }

  orderTotal(order: PurchaseOrder) {
    return order.items.reduce((s, i) => s + Number(i.qty_ordered) * Number(i.unit_price), 0);
  }

  statusColor(status: string) {
    return status === 'draft' ? '#f59e0b' : status === 'ordered' ? '#3b82f6' : '#22c55e';
  }

  statusBadgeStyle(status: string) {
    const colors: Record<string, string> = {
      draft:    'background:#fef3c7;color:#92400e',
      ordered:  'background:#dbeafe;color:#1e40af',
      received: 'background:#dcfce7;color:#166534',
    };
    return colors[status] ?? '';
  }

  formatDate(d: string) {
    return new Date(d).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }
}