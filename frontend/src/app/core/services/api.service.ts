import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Shift, MenuByCategory, MenuItem, Order, EntryTicket, Receipt, PaymentMethod,
  DashboardData, ShiftAnalytics, TopItem, MonthlyData, MenuCategory,
  Employee, EmployeeActivity, KitchenData, KitchenStatus
} from '../models';

export interface BillSpec { item_ids: number[]; payment_method: PaymentMethod; }

import { environment } from '../../../environments/environment';

const BASE = environment.apiBase;

interface Paginated<T> { count: number; results: T[]; next: string | null; previous: string | null; }

/** DRF returns either a plain array (custom actions) or {count, results:[]} (list views). */
function unpage<T>(obs: Observable<T[] | Paginated<T>>): Observable<T[]> {
  return obs.pipe(map((r: any) => Array.isArray(r) ? r : (r.results ?? [])));
}

@Injectable({ providedIn: 'root' })
export class ApiService {
  constructor(private http: HttpClient) {}

  // ── Shifts ──────────────────────────────────────────────────────
  getShifts(): Observable<Shift[]> {
    return unpage(this.http.get<Shift[] | Paginated<Shift>>(`${BASE}/shifts/?page_size=200`));
  }
  getCurrentShift(): Observable<Shift> {
    return this.http.get<Shift>(`${BASE}/shifts/current/`);
  }
  createShift(data: Partial<Shift>): Observable<Shift> {
    return this.http.post<Shift>(`${BASE}/shifts/`, data);
  }
  closeShift(id: number): Observable<Shift> {
    return this.http.post<Shift>(`${BASE}/shifts/${id}/close/`, {});
  }
  reopenShift(id: number): Observable<Shift> {
    return this.http.post<Shift>(`${BASE}/shifts/${id}/reopen/`, {});
  }

  // ── Menu ─────────────────────────────────────────────────────────
  getMenuByCategory(): Observable<MenuByCategory[]> {
    return this.http.get<MenuByCategory[]>(`${BASE}/menu/items/by_category/`);
  }
  getMenuItems(): Observable<MenuItem[]> {
    return unpage(this.http.get<MenuItem[] | Paginated<MenuItem>>(`${BASE}/menu/items/?page_size=500`));
  }
  getMenuCategories(): Observable<MenuCategory[]> {
    return unpage(this.http.get<MenuCategory[] | Paginated<MenuCategory>>(`${BASE}/menu/categories/?page_size=100`));
  }
  createMenuItem(data: Partial<MenuItem>): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${BASE}/menu/items/`, data);
  }
  updateMenuItem(id: number, data: Partial<MenuItem>): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`${BASE}/menu/items/${id}/`, data);
  }
  deleteMenuItem(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/items/${id}/`);
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
  checkoutOrder(orderId: number, bills: BillSpec[]): Observable<{ order: Order; receipts: Receipt[] }> {
    return this.http.post<{ order: Order; receipts: Receipt[] }>(`${BASE}/orders/${orderId}/checkout/`, { bills });
  }
  cancelOrder(orderId: number): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/cancel/`, {});
  }
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

  // ── Tickets ──────────────────────────────────────────────────────
  getTickets(shiftId?: number): Observable<EntryTicket[]> {
    let params = new HttpParams().set('page_size', '500');
    if (shiftId) params = params.set('shift', shiftId);
    return unpage(this.http.get<EntryTicket[] | Paginated<EntryTicket>>(`${BASE}/tickets/`, { params }));
  }
  createTicket(data: { shift: number; bracelet_number: string; price: number }): Observable<EntryTicket> {
    return this.http.post<EntryTicket>(`${BASE}/tickets/`, data);
  }
  bulkCreateTickets(data: { shift: number; start: number; end: number; price: number }): Observable<{ created: number }> {
    return this.http.post<{ created: number }>(`${BASE}/tickets/bulk_create/`, data);
  }

  // ── Employees ────────────────────────────────────────────────────
  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${BASE}/employees/`);
  }
  getEmployeeActivity(shiftId?: number): Observable<EmployeeActivity[]> {
    let params = new HttpParams();
    if (shiftId) params = params.set('shift', shiftId);
    return this.http.get<EmployeeActivity[]>(`${BASE}/employees/activity/`, { params });
  }
  getEmployeeOrders(userId: number, shiftId?: number): Observable<Order[]> {
    let params = new HttpParams().set('user_id', userId);
    if (shiftId) params = params.set('shift', shiftId);
    return this.http.get<Order[]>(`${BASE}/employees/orders/`, { params });
  }
  createEmployee(data: { username: string; password?: string; display_name?: string; role: string; first_name?: string }): Observable<any> {
    return this.http.post(`${BASE}/employees/`, data);
  }
  updateEmployee(id: number, data: { display_name?: string; role?: string; password?: string; is_active?: boolean }): Observable<any> {
    return this.http.patch(`${BASE}/employees/${id}/`, data);
  }

  // ── Kitchen (KDS) ────────────────────────────────────────────────
  getKitchenOrders(): Observable<KitchenData> {
    return this.http.get<KitchenData>(`${BASE}/kitchen/orders/`);
  }
  setKitchenItemStatus(itemId: number, status: KitchenStatus): Observable<any> {
    return this.http.post(`${BASE}/kitchen/item/${itemId}/status/`, { status });
  }
  markKitchenOrderReady(orderId: number): Observable<any> {
    return this.http.post(`${BASE}/kitchen/order/${orderId}/ready/`, {});
  }

  // ── Analytics ────────────────────────────────────────────────────
  getDashboard(): Observable<DashboardData> {
    return this.http.get<DashboardData>(`${BASE}/analytics/dashboard/`);
  }
  getShiftAnalytics(limit = 20): Observable<ShiftAnalytics[]> {
    return this.http.get<ShiftAnalytics[]>(`${BASE}/analytics/shifts/?limit=${limit}`);
  }
  getTopItems(type?: string): Observable<TopItem[]> {
    let params = new HttpParams();
    if (type) params = params.set('type', type);
    return this.http.get<TopItem[]>(`${BASE}/analytics/top-items/`, { params });
  }
  getMonthly(): Observable<MonthlyData[]> {
    return this.http.get<MonthlyData[]>(`${BASE}/analytics/monthly/`);
  }

  // ── Exports ──────────────────────────────────────────────────────
  exportShift(shiftId: number): string {
    const token = localStorage.getItem('access_token');
    return `${BASE}/exports/shift/${shiftId}/?token=${token}`;
  }
  exportReport(dateFrom?: string, dateTo?: string): string {
    const token = localStorage.getItem('access_token');
    let url = `${BASE}/exports/report/?token=${token}`;
    if (dateFrom) url += `&date_from=${dateFrom}`;
    if (dateTo)   url += `&date_to=${dateTo}`;
    return url;
  }
  downloadExport(url: string): Observable<Blob> {
    return this.http.get(url, { responseType: 'blob' });
  }
}
