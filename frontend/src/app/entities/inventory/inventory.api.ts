import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Product, MenuItemComponent, ConsumptionRow, InventoryMovement, MovementReason,
  PurchaseOrder, PurchaseOrderItem, StockReport, ReceiptImport, ReceiptImportLine,
} from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private http = inject(HttpClient);

  // ── Products ─────────────────────────────────────────────────────
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
  getLowStock(): Observable<Product[]> {
    return this.http.get<Product[]>(`${BASE}/inventory/products/low_stock/`);
  }
  /** Создаёт товары из позиций меню (готовая продукция) + рецептуру «1 шт». */
  createProductsFromMenu(menuItemIds: number[]): Observable<Product[]> {
    return this.http.post<Product[]>(`${BASE}/inventory/products/from_menu/`, { menu_item_ids: menuItemIds });
  }

  // ── Recipe components ────────────────────────────────────────────
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

  // ── Stock movements ──────────────────────────────────────────────
  getConsumption(dateFrom?: string, dateTo?: string, shiftId?: number): Observable<ConsumptionRow[]> {
    let params = new HttpParams();
    if (shiftId)  params = params.set('shift', shiftId);
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo)   params = params.set('date_to', dateTo);
    return this.http.get<ConsumptionRow[]>(`${BASE}/inventory/consumption/`, { params });
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
  /** Массовая инвентаризация: для каждого товара записывается adjustment на факт − учёт. */
  stocktake(items: { product: number; actual_qty: number }[]): Observable<Product[]> {
    return this.http.post<Product[]>(`${BASE}/inventory/movements/stocktake/`, { items });
  }
  getStockReport(dateFrom?: string, dateTo?: string): Observable<StockReport> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('date_from', dateFrom);
    if (dateTo)   params = params.set('date_to', dateTo);
    return this.http.get<StockReport>(`${BASE}/inventory/report/`, { params });
  }

  // ── Purchases ────────────────────────────────────────────────────
  getPurchaseOrders(): Observable<PurchaseOrder[]> {
    return unpage(this.http.get<PurchaseOrder[] | Paginated<PurchaseOrder>>(`${BASE}/inventory/purchases/?page_size=200`));
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
  updatePurchaseOrder(id: number, data: Partial<PurchaseOrder>): Observable<PurchaseOrder> {
    return this.http.patch<PurchaseOrder>(`${BASE}/inventory/purchases/${id}/`, data);
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

  // ── Импорт чеков магазина (QR → закупка) ─────────────────────────
  createReceiptImport(qr: string): Observable<ReceiptImport> {
    return this.http.post<ReceiptImport>(`${BASE}/inventory/receipt-imports/`, { qr });
  }
  pollReceiptImport(id: number): Observable<ReceiptImport> {
    return this.http.post<ReceiptImport>(`${BASE}/inventory/receipt-imports/${id}/poll/`, {});
  }
  applyReceiptImport(id: number, lines: ReceiptImportLine[]): Observable<{ import: ReceiptImport; purchase: PurchaseOrder }> {
    return this.http.post<{ import: ReceiptImport; purchase: PurchaseOrder }>(
      `${BASE}/inventory/receipt-imports/${id}/apply/`, { lines });
  }
}