import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  Shift, MenuByCategory, MenuItem, Order, EntryTicket, Receipt, PaymentMethod,
  DashboardData, ShiftAnalytics, TopItem, MonthlyData, Menu, MenuCategory, MenuSection,
  Employee, EmployeeActivity, KitchenData, KitchenStatus, Printer,
  ShiftDetail, SalesReport, ForecastDay,
  Product, MenuItemComponent, ConsumptionRow, InventoryMovement, MovementReason,
  StaffMember, TokenResponse,
  PurchaseOrder, PurchaseOrderItem,
  ModifierGroup, Modifier, MenuItemModifierGroup,
  DeletedOrderItem,
  Reservation, ReservationStatus,
  Zone, VenueTable,
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

  // ── Menus ────────────────────────────────────────────────────────
  getMenus(): Observable<Menu[]> {
    return unpage(this.http.get<Menu[] | Paginated<Menu>>(`${BASE}/menu/?page_size=50`));
  }
  createMenu(data: { name: string }): Observable<Menu> {
    return this.http.post<Menu>(`${BASE}/menu/`, data);
  }
  updateMenu(id: number, data: Partial<Menu>): Observable<Menu> {
    return this.http.patch<Menu>(`${BASE}/menu/${id}/`, data);
  }
  activateMenu(id: number): Observable<Menu> {
    return this.http.post<Menu>(`${BASE}/menu/${id}/activate/`, {});
  }
  duplicateMenu(id: number, name?: string): Observable<Menu> {
    return this.http.post<Menu>(`${BASE}/menu/${id}/duplicate/`, name ? { name } : {});
  }
  deleteMenu(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/${id}/`);
  }

  // ── Menu items ───────────────────────────────────────────────────
  getMenuByCategory(menuId?: number): Observable<MenuByCategory[]> {
    const url = menuId
      ? `${BASE}/menu/items/by_category/?menu=${menuId}`
      : `${BASE}/menu/items/by_category/`;
    return this.http.get<MenuByCategory[]>(url);
  }
  getMenuItems(): Observable<MenuItem[]> {
    return unpage(this.http.get<MenuItem[] | Paginated<MenuItem>>(`${BASE}/menu/items/?page_size=500`));
  }
  getMenuCategories(): Observable<MenuCategory[]> {
    return unpage(this.http.get<MenuCategory[] | Paginated<MenuCategory>>(`${BASE}/menu/categories/?page_size=200`));
  }
  getMenuSections(): Observable<MenuSection[]> {
    return unpage(this.http.get<MenuSection[] | Paginated<MenuSection>>(`${BASE}/menu/sections/?page_size=200`));
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
  createMenuSection(data: Partial<MenuSection>): Observable<MenuSection> {
    return this.http.post<MenuSection>(`${BASE}/menu/sections/`, data);
  }
  updateMenuSection(id: number, data: Partial<MenuSection>): Observable<MenuSection> {
    return this.http.patch<MenuSection>(`${BASE}/menu/sections/${id}/`, data);
  }
  deleteMenuSection(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/sections/${id}/`);
  }
  createMenuCategory(data: Partial<MenuCategory>): Observable<MenuCategory> {
    return this.http.post<MenuCategory>(`${BASE}/menu/categories/`, data);
  }
  updateMenuCategory(id: number, data: Partial<MenuCategory>): Observable<MenuCategory> {
    return this.http.patch<MenuCategory>(`${BASE}/menu/categories/${id}/`, data);
  }
  deleteMenuCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/categories/${id}/`);
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
  toggleOutOfStock(itemId: number): Observable<{ id: number; is_out_of_stock: boolean }> {
    return this.http.post<{ id: number; is_out_of_stock: boolean }>(`${BASE}/menu/items/${itemId}/toggle_stock/`, {});
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

  // ── PIN Auth ─────────────────────────────────────────────────────
  getStaffList(): Observable<StaffMember[]> {
    return this.http.get<StaffMember[]>(`${BASE}/auth/staff/`);
  }
  pinLogin(userId: number, pin: string): Observable<TokenResponse> {
    return this.http.post<TokenResponse>(`${BASE}/auth/pin/`, { user_id: userId, pin });
  }
  setEmployeePin(userId: number, pin: string): Observable<any> {
    return this.http.patch(`${BASE}/employees/${userId}/`, { pin });
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
  deleteEmployee(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/employees/${id}/`);
  }

  // ── Printers ─────────────────────────────────────────────────────
  getPrinters(): Observable<Printer[]> {
    return this.http.get<Printer[]>(`${BASE}/printers/`);
  }
  createPrinter(data: Partial<Printer>): Observable<Printer> {
    return this.http.post<Printer>(`${BASE}/printers/`, data);
  }
  updatePrinter(id: number, data: Partial<Printer>): Observable<Printer> {
    return this.http.patch<Printer>(`${BASE}/printers/${id}/`, data);
  }
  deletePrinter(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/printers/${id}/`);
  }
  testPrinter(id: number): Observable<{ ok: boolean; error?: string }> {
    return this.http.post<{ ok: boolean; error?: string }>(`${BASE}/printers/${id}/test/`, {});
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
  getShiftDetail(shiftId: number): Observable<ShiftDetail> {
    return this.http.get<ShiftDetail>(`${BASE}/analytics/shift-detail/${shiftId}/`);
  }
  getForecast(): Observable<ForecastDay[]> {
    return this.http.get<ForecastDay[]>(`${BASE}/analytics/forecast/`);
  }

  getSalesReport(dateFrom?: string, dateTo?: string): Observable<SalesReport> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo)   params = params.set('date_to', dateTo);
    return this.http.get<SalesReport>(`${BASE}/analytics/sales-report/`, { params });
  }

  // ── Inventory ────────────────────────────────────────────────────
  getProducts(): Observable<Product[]> {
    return unpage(this.http.get<Product[] | Paginated<Product>>(`${BASE}/inventory/products/?page_size=500`));
  }
  createProduct(data: Partial<Product>): Observable<Product> {
    return this.http.post<Product>(`${BASE}/inventory/products/`, data);
  }
  updateProduct(id: number, data: Partial<Product>): Observable<Product> {
    return this.http.patch<Product>(`${BASE}/inventory/products/${id}/`, data);
  }
  deleteProduct(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/inventory/products/${id}/`);
  }
  getComponents(menuItemId?: number): Observable<MenuItemComponent[]> {
    const url = menuItemId
      ? `${BASE}/inventory/components/?menu_item=${menuItemId}&page_size=500`
      : `${BASE}/inventory/components/?page_size=2000`;
    return unpage(this.http.get<MenuItemComponent[] | Paginated<MenuItemComponent>>(url));
  }
  createComponent(data: { menu_item: number; product: number; quantity: number }): Observable<MenuItemComponent> {
    return this.http.post<MenuItemComponent>(`${BASE}/inventory/components/`, data);
  }
  updateComponent(id: number, quantity: number): Observable<MenuItemComponent> {
    return this.http.patch<MenuItemComponent>(`${BASE}/inventory/components/${id}/`, { quantity });
  }
  deleteComponent(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/inventory/components/${id}/`);
  }
  getConsumption(dateFrom?: string, dateTo?: string, shiftId?: number): Observable<ConsumptionRow[]> {
    let params = new HttpParams();
    if (shiftId)  params = params.set('shift', shiftId);
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo)   params = params.set('date_to', dateTo);
    return this.http.get<ConsumptionRow[]>(`${BASE}/inventory/consumption/`, { params });
  }
  getLowStock(): Observable<Product[]> {
    return this.http.get<Product[]>(`${BASE}/inventory/products/low_stock/`);
  }
  getMovements(productId?: number, shiftId?: number): Observable<InventoryMovement[]> {
    let params = new HttpParams().set('page_size', '200');
    if (productId) params = params.set('product', productId);
    if (shiftId)   params = params.set('shift', shiftId);
    return unpage(this.http.get<InventoryMovement[] | Paginated<InventoryMovement>>(`${BASE}/inventory/movements/`, { params }));
  }
  adjustStock(data: { product: number; quantity: number; reason: MovementReason; note?: string }): Observable<Product> {
    return this.http.post<Product>(`${BASE}/inventory/movements/adjust/`, data);
  }

  // ── Purchases ────────────────────────────────────────────────────
  getPurchaseOrders(): Observable<PurchaseOrder[]> {
    return unpage(this.http.get<PurchaseOrder[] | any>(`${BASE}/inventory/purchases/?page_size=200`));
  }
  getPurchaseOrder(id: number): Observable<PurchaseOrder> {
    return this.http.get<PurchaseOrder>(`${BASE}/inventory/purchases/${id}/`);
  }
  createPurchaseFromLowStock(): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${BASE}/inventory/purchases/from_low_stock/`, {});
  }
  updatePurchaseStatus(id: number, status: string): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${BASE}/inventory/purchases/${id}/`, { status });
  }
  receivePurchaseOrder(id: number, items: { id: number; qty_received: number; unit_price: number }[]): Observable<PurchaseOrder> {
    return this.http.post<PurchaseOrder>(`${BASE}/inventory/purchases/${id}/receive/`, { items });
  }
  updatePurchaseItem(orderId: number, itemId: number, data: Partial<PurchaseOrderItem>): Observable<PurchaseOrderItem> {
    return this.http.patch<PurchaseOrderItem>(`${BASE}/inventory/purchases/${orderId}/items/${itemId}/`, data);
  }
  deletePurchaseOrder(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/inventory/purchases/${id}/`);
  }

  // ── Modifiers ─────────────────────────────────────────────────────
  getModifierGroups(): Observable<ModifierGroup[]> {
    return unpage(this.http.get<ModifierGroup[] | any>(`${BASE}/menu/modifier-groups/?page_size=200`));
  }
  createModifierGroup(data: Partial<ModifierGroup>): Observable<ModifierGroup> {
    return this.http.post<ModifierGroup>(`${BASE}/menu/modifier-groups/`, data);
  }
  updateModifierGroup(id: number, data: Partial<ModifierGroup>): Observable<ModifierGroup> {
    return this.http.patch<ModifierGroup>(`${BASE}/menu/modifier-groups/${id}/`, data);
  }
  deleteModifierGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/modifier-groups/${id}/`);
  }
  createModifier(data: Partial<Modifier>): Observable<Modifier> {
    return this.http.post<Modifier>(`${BASE}/menu/modifiers/`, data);
  }
  updateModifier(id: number, data: Partial<Modifier>): Observable<Modifier> {
    return this.http.patch<Modifier>(`${BASE}/menu/modifiers/${id}/`, data);
  }
  deleteModifier(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/modifiers/${id}/`);
  }
  getItemModifierGroups(menuItemId: number): Observable<MenuItemModifierGroup[]> {
    return this.http.get<MenuItemModifierGroup[]>(`${BASE}/menu/items/${menuItemId}/modifier_groups/`);
  }
  assignModifierGroup(menuItemId: number, modifierGroupId: number): Observable<MenuItemModifierGroup> {
    return this.http.post<MenuItemModifierGroup>(`${BASE}/menu/item-modifiers/`, {
      menu_item: menuItemId, modifier_group: modifierGroupId,
    });
  }
  removeModifierGroup(linkId: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/item-modifiers/${linkId}/`);
  }

  // ── Audit ────────────────────────────────────────────────────────
  getDeletedItems(params?: { shift?: number; deleted_by?: number; date_from?: string; date_to?: string }): Observable<DeletedOrderItem[]> {
    let p = new HttpParams().set('page_size', '500');
    if (params?.shift)       p = p.set('shift', params.shift);
    if (params?.deleted_by)  p = p.set('deleted_by', params.deleted_by);
    if (params?.date_from)   p = p.set('date_from', params.date_from);
    if (params?.date_to)     p = p.set('date_to', params.date_to);
    return unpage(this.http.get<DeletedOrderItem[] | Paginated<DeletedOrderItem>>(`${BASE}/audit/deleted-items/`, { params: p }));
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

  // ── Reservations ─────────────────────────────────────────────────
  getReservations(params?: { date?: string; date_from?: string; date_to?: string; status?: string }): Observable<Reservation[]> {
    let p = new HttpParams().set('page_size', '200');
    if (params?.date)      p = p.set('date', params.date);
    if (params?.date_from) p = p.set('date_from', params.date_from);
    if (params?.date_to)   p = p.set('date_to', params.date_to);
    if (params?.status)    p = p.set('status', params.status);
    return unpage(this.http.get<Reservation[] | Paginated<Reservation>>(`${BASE}/reservations/`, { params: p }));
  }
  createReservation(data: Partial<Reservation>): Observable<Reservation> {
    return this.http.post<Reservation>(`${BASE}/reservations/`, data);
  }
  updateReservation(id: number, data: Partial<Reservation>): Observable<Reservation> {
    return this.http.patch<Reservation>(`${BASE}/reservations/${id}/`, data);
  }
  deleteReservation(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/reservations/${id}/`);
  }
  setReservationStatus(id: number, status: ReservationStatus): Observable<Reservation> {
    return this.http.post<Reservation>(`${BASE}/reservations/${id}/set_status/`, { status });
  }
  markReservationDeposit(id: number, paid: boolean): Observable<Reservation> {
    return this.http.post<Reservation>(`${BASE}/reservations/${id}/mark_deposit/`, { paid });
  }
  linkReservationToOrder(orderId: number, reservationId: number | null): Observable<Order> {
    return this.http.patch<Order>(`${BASE}/orders/${orderId}/`, { reservation: reservationId });
  }

  moveOrderTable(orderId: number, tableNumber: string): Observable<Order> {
    return this.http.post<Order>(`${BASE}/orders/${orderId}/move_table/`, { table_number: tableNumber });
  }

  // ── Tables & Zones ────────────────────────────────────────────────
  getZones(): Observable<Zone[]> {
    return unpage(this.http.get<Zone[] | Paginated<Zone>>(`${BASE}/tables/zones/?page_size=100`));
  }
  createZone(data: Partial<Zone>): Observable<Zone> {
    return this.http.post<Zone>(`${BASE}/tables/zones/`, data);
  }
  updateZone(id: number, data: Partial<Zone>): Observable<Zone> {
    return this.http.patch<Zone>(`${BASE}/tables/zones/${id}/`, data);
  }
  deleteZone(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/tables/zones/${id}/`);
  }
  createTable(data: Partial<VenueTable>): Observable<VenueTable> {
    return this.http.post<VenueTable>(`${BASE}/tables/`, data);
  }
  updateTable(id: number, data: Partial<VenueTable>): Observable<VenueTable> {
    return this.http.patch<VenueTable>(`${BASE}/tables/${id}/`, data);
  }
  deleteTable(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/tables/${id}/`);
  }
}
