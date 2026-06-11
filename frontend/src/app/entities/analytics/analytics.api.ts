import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  DashboardData, ShiftAnalytics, TopItem, MonthlyData,
  ShiftDetail, SalesReport, ForecastDay, DeletedOrderItem,
} from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class AnalyticsApi {
  private http = inject(HttpClient);

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

  // ── Audit ────────────────────────────────────────────────────────
  getDeletedItems(params?: { shift?: number; deleted_by?: number; date_from?: string; date_to?: string }): Observable<DeletedOrderItem[]> {
    let p = new HttpParams().set('page_size', '500');
    if (params?.shift)       p = p.set('shift', params.shift);
    if (params?.deleted_by)  p = p.set('deleted_by', params.deleted_by);
    if (params?.date_from)   p = p.set('date_from', params.date_from);
    if (params?.date_to)     p = p.set('date_to', params.date_to);
    return unpage(this.http.get<DeletedOrderItem[] | Paginated<DeletedOrderItem>>(`${BASE}/audit/deleted-items/`, { params: p }));
  }

  // ── Exports (.xlsx) ──────────────────────────────────────────────
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