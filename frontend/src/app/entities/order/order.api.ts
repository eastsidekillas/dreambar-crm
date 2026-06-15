import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Order, Receipt, PaymentMethod, KitchenData, KitchenStatus,
} from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

export interface BillSpec { item_ids: number[]; payment_method: PaymentMethod; }

@Injectable({ providedIn: 'root' })
export class OrderApi {
  private http = inject(HttpClient);

  // ── Orders ───────────────────────────────────────────────────────
  getOrders(shiftId?: number): Observable<Order[]> {
    let params = new HttpParams().set('page_size', '200');
    if (shiftId) params = params.set('shift', shiftId);
    return unpage(this.http.get<Order[] | Paginated<Order>>(`${BASE}/orders/`, { params }));
  }
  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${BASE}/orders/my_orders/`);
  }
  /** Открытые посадки текущей смены (занятые столы). */
  getActiveOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${BASE}/orders/active/`);
  }
  createOrder(data: { shift: number; table_number: string; guests?: number; notes: string; items?: { menu_item: number; quantity: number; guest_no?: number }[] }): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/`, data);
  }
  addItemToOrder(orderId: number, menuItemId: number, quantity: number, guestNo = 0): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/add_item/`, { menu_item: menuItemId, quantity, guest_no: guestNo });
  }
  /** Перенести позицию на другого гостя (0 — общая позиция). */
  setItemGuest(orderId: number, itemId: number, guestNo: number): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/item/${itemId}/guest/`, { guest_no: guestNo });
  }
  removeItemFromOrder(orderId: number, itemId: number): Observable<Order> {
    return this.http.delete<Order>(`${BASE}/orders/${orderId}/remove_item/${itemId}/`);
  }
  closeOrder(orderId: number, paymentMethod: PaymentMethod = 'cash'): Observable<{ order: Order; receipt: Receipt }> {
    return this.http.post<{ order: Order; receipt: Receipt }>(`${BASE}/orders/${orderId}/close/`, { payment_method: paymentMethod });
  }
  /** Закрыть счёт: один чек или раздельный счёт (несколько чеков). */
  checkoutOrder(orderId: number, bills: BillSpec[], depositAmount?: number, depositMethod?: string): Observable<{ order: Order; receipts: Receipt[] }> {
    const body: any = { bills };
    if (depositAmount && depositAmount > 0) {
      body.deposit_amount = depositAmount;
      body.deposit_method = depositMethod || '';
    }
    return this.http.post<{ order: Order; receipts: Receipt[] }>(`${BASE}/orders/${orderId}/checkout/`, body);
  }
  updateOrder(orderId: number, data: { table_number?: string; guests?: number; notes?: string }): Observable<Order> {
    return this.http.patch<Order>(`${BASE}/orders/${orderId}/`, data);
  }
  cancelOrder(orderId: number): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/cancel/`, {});
  }
  /** Удалить пустой стол (заказ без позиций) — освободить его. */
  deleteOrder(orderId: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/orders/${orderId}/`);
  }
  moveOrderTable(orderId: number, tableNumber: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/move_table/`, { table_number: tableNumber });
  }
  linkReservationToOrder(orderId: number, reservationId: number | null): Observable<Order> {
    return this.http.patch<Order>(`${BASE}/orders/${orderId}/`, { reservation: reservationId });
  }

  // ── Receipts ─────────────────────────────────────────────────────
  getReceipts(shiftId?: number): Observable<Receipt[]> {
    let params = new HttpParams().set('page_size', '500');
    if (shiftId) params = params.set('shift', shiftId);
    return unpage(this.http.get<Receipt[] | Paginated<Receipt>>(`${BASE}/receipts/`, { params }));
  }
  /** Аппаратная печать чека на термопринтере (ATOL RP-326). printerId — необязательно. */
  printReceipt(receiptId: number, printerId?: number): Observable<{ job_id: number; status: string; error: string }> {
    const body = printerId ? { printer: printerId } : {};
    return this.http.post<{ job_id: number; status: string; error: string }>(
      `${BASE}/receipts/${receiptId}/print/`, body);
  }

  // ── Kitchen (KDS) ────────────────────────────────────────────────
  getKitchenOrders(type: 'kitchen' | 'bar' = 'kitchen'): Observable<KitchenData> {
    return this.http.get<KitchenData>(`${BASE}/kitchen/orders/?type=${type}`);
  }
  setKitchenItemStatus(itemId: number, status: KitchenStatus): Observable<any> {
    return this.http.post(`${BASE}/kitchen/item/${itemId}/status/`, { status });
  }
  markKitchenOrderReady(orderId: number, type?: 'kitchen' | 'bar'): Observable<any> {
    const params = type ? new HttpParams().set('type', type) : undefined;
    return this.http.post(`${BASE}/kitchen/order/${orderId}/ready/`, {}, { params });
  }
}