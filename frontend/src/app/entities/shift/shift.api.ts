import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Shift } from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class ShiftApi {
  private http = inject(HttpClient);

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
}