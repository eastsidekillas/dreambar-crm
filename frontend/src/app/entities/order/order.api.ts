import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, throwError, catchError, tap, map } from 'rxjs';
import {
  Order, Receipt, PaymentMethod, KitchenData, KitchenStatus,
} from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';
import { OfflineService, isNetworkError } from '../../core/services/offline.service';
import { OrderOp, opToRequest } from './lib/order-ops';

export interface BillSpec { item_ids: number[]; payment_method: PaymentMethod; }
/** Снапшот позиции для оптимистичного показа при офлайн-добавлении. */
export interface ItemSnapshot { name: string; price: number; type: string; }

@Injectable({ providedIn: 'root' })
export class OrderApi {
  private http = inject(HttpClient);
  private offline = inject(OfflineService);

  /** Мутация существующего заказа: online-first; при сетевом сбое — в очередь +
   *  оптимистичный заказ. Тот же Idempotency-Key страхует от дублей при флаше. */
  private gateway(op: OrderOp): Observable<Order> {
    const { method, url, body } = opToRequest(op, BASE);
    return this.http.request<Order>(method, url, { body, headers: { 'Idempotency-Key': op.idem } }).pipe(
      tap(order => this.offline.patchOrder(order)),
      catchError(err => {
        if (isNetworkError(err)) {
          this.offline.enqueue(op);
          const o = this.offline.orderById(op.orderId);
          if (o) return of(o);
        }
        return throwError(() => err);
      }),
    );
  }

  // ── Orders ───────────────────────────────────────────────────────
  getOrders(shiftId?: number): Observable<Order[]> {
    let params = new HttpParams().set('page_size', '200');
    if (shiftId) params = params.set('shift', shiftId);
    return unpage(this.http.get<Order[] | Paginated<Order>>(`${BASE}/orders/`, { params }));
  }
  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${BASE}/orders/my_orders/`);
  }
  /** Открытые посадки текущей смены (занятые столы).
   *  Онлайн — обновляет базу офлайн-движка и пытается флашнуть очередь; офлайн —
   *  отдаёт последнее известное состояние с применёнными неотправленными операциями. */
  getActiveOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${BASE}/orders/active/`).pipe(
      tap(list => { this.offline.setBase(list); this.offline.flush(); }),
      map(() => this.offline.orders()),
      catchError(err => isNetworkError(err) ? of(this.offline.orders()) : throwError(() => err)),
    );
  }
  getOrder(orderId: number): Observable<Order> {
    return this.http.get<Order>(`${BASE}/orders/${orderId}/`);
  }
  createOrder(data: { shift: number; table_number: string; guests?: number; notes: string; reservation?: number | null; items?: { menu_item: number; quantity: number; guest_no?: number }[] }): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/`, data);
  }
  addItemToOrder(orderId: number, menuItemId: number, quantity: number, guestNo = 0,
                 modifierIds: number[] = [], snap?: ItemSnapshot): Observable<Order> {
    return this.gateway({
      kind: 'addItem', idem: this.offline.newIdem(), orderId, tempItemId: this.offline.nextTempItemId(),
      menuItemId, quantity, guestNo, modifierIds,
      name: snap?.name ?? 'Позиция', price: snap?.price ?? 0, type: snap?.type ?? '', comment: '',
      addedAt: new Date().toISOString(),
    });
  }
  /** Перенести позицию на другого гостя (0 — общая позиция). */
  setItemGuest(orderId: number, itemId: number, guestNo: number): Observable<Order> {
    // Позиция, ещё не синхронизированная (temp id<0) — правим её операцию в очереди.
    if (itemId < 0) { this.offline.setTempItemGuest(itemId, guestNo); return of(this.offline.orderById(orderId)!); }
    return this.gateway({ kind: 'setItemGuest', idem: this.offline.newIdem(), orderId, itemId, guestNo });
  }
  removeItemFromOrder(orderId: number, itemId: number): Observable<Order> {
    if (itemId < 0) { this.offline.cancelTempItem(itemId); return of(this.offline.orderById(orderId)!); }
    return this.gateway({ kind: 'removeItem', idem: this.offline.newIdem(), orderId, itemId });
  }
  /** Изменить количество и/или комментарий позиции. */
  updateOrderItem(orderId: number, itemId: number, data: { quantity?: number; comment?: string }): Observable<Order> {
    const cur = this.offline.orderById(orderId)?.items.find(i => i.id === itemId);
    const quantity = data.quantity ?? cur?.quantity ?? 1;
    const comment = data.comment ?? cur?.comment ?? '';
    if (itemId < 0) { this.offline.updateTempItem(itemId, { quantity, comment }); return of(this.offline.orderById(orderId)!); }
    return this.gateway({ kind: 'updateItem', idem: this.offline.newIdem(), orderId, itemId, quantity, comment });
  }
  /** Отправить черновые позиции заказа на кухню/бар. */
  sendOrder(orderId: number): Observable<{ order: Order; sent: number }> {
    const op: OrderOp = { kind: 'send', idem: this.offline.newIdem(), orderId };
    const { url } = opToRequest(op, BASE);
    return this.http.post<{ order: Order; sent: number }>(url, {}, { headers: { 'Idempotency-Key': op.idem } }).pipe(
      tap(res => this.offline.patchOrder(res.order)),
      catchError(err => {
        if (isNetworkError(err)) {
          this.offline.enqueue(op);
          const order = this.offline.orderById(orderId)!;
          return of({ order, sent: order.items.filter(i => i.is_sent).length });
        }
        return throwError(() => err);
      }),
    );
  }
  /** Сколько посуды (kind: glass/shot/wine) принести к столу. В чек НЕ входит. */
  setGlassware(orderId: number, kind: string, count: number): Observable<Order> {
    return this.gateway({ kind: 'setGlassware', idem: this.offline.newIdem(), orderId, glKind: kind, count });
  }
  /** Депозит, внесённый официантом за столом (деньги). Только онлайн — как чек. */
  setDeposit(orderId: number, amount: number, method: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/deposit/`, { amount, method })
      .pipe(tap(order => this.offline.patchOrder(order)));
  }
  closeOrder(orderId: number, paymentMethod: PaymentMethod = 'cash'): Observable<{ order: Order; receipt: Receipt }> {
    return this.http.post<{ order: Order; receipt: Receipt }>(`${BASE}/orders/${orderId}/close/`, { payment_method: paymentMethod });
  }
  /** Закрыть счёт: один чек или раздельный счёт (несколько чеков).
   * Депозит применяет бэкенд сам (общий баланс брони), фронт его не передаёт. */
  checkoutOrder(orderId: number, bills: BillSpec[]): Observable<{ order: Order; receipts: Receipt[] }> {
    return this.http.post<{ order: Order; receipts: Receipt[] }>(`${BASE}/orders/${orderId}/checkout/`, { bills });
  }
  updateOrder(orderId: number, data: { table_number?: string; guests?: number; notes?: string }): Observable<Order> {
    // Только смену числа гостей умеем офлайн; прочее (стол/заметки) — онлайн.
    if (data.guests != null && Object.keys(data).length === 1) {
      return this.gateway({ kind: 'setGuests', idem: this.offline.newIdem(), orderId, guests: data.guests });
    }
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
  /** Переименовать гостя (пусто — сбросить имя). */
  renameGuest(orderId: number, guestNo: number, name: string): Observable<Order> {
    return this.gateway({ kind: 'renameGuest', idem: this.offline.newIdem(), orderId, guestNo, name });
  }
  /** Печать предчека (не фискального) по столу или конкретному гостю. */
  printPrecheck(orderId: number, guestNo?: number): Observable<{ job_id: number; status: string; error: string }> {
    const body = guestNo != null ? { guest_no: guestNo } : {};
    return this.http.post<{ job_id: number; status: string; error: string }>(`${BASE}/orders/${orderId}/precheck/`, body);
  }
  /** Перенести позиции гостя в новый открытый заказ. */
  splitGuest(orderId: number, guestNo: number, tableNumber?: string): Observable<{ order: Order; new_order: Order }> {
    const body: any = { guest_no: guestNo };
    if (tableNumber) body.table_number = tableNumber;
    return this.http.post<{ order: Order; new_order: Order }>(`${BASE}/orders/${orderId}/guest/split/`, body);
  }
  linkReservationToOrder(orderId: number, reservationId: number | null): Observable<Order> {
    return this.http.patch<Order>(`${BASE}/orders/${orderId}/`, { reservation: reservationId });
  }

  // ── Receipts ─────────────────────────────────────────────────────
  getReceipts(shiftId?: number, orderId?: number): Observable<Receipt[]> {
    let params = new HttpParams().set('page_size', '500');
    if (shiftId) params = params.set('shift', shiftId);
    if (orderId) params = params.set('order', orderId);
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