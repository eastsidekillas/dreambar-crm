import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Employee, EmployeeActivity, Order, StaffMember, TokenResponse } from '../../core/models';
import { API_BASE as BASE } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class EmployeeApi {
  private http = inject(HttpClient);

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
  setMyPin(pin: string, currentPin?: string): Observable<{ detail: string; has_pin: boolean }> {
    const body: any = { pin };
    if (currentPin) body.current_pin = currentPin;
    return this.http.post<{ detail: string; has_pin: boolean }>(`${BASE}/auth/me/pin/`, body);
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
}