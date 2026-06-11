import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Reservation, ReservationStatus } from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class ReservationApi {
  private http = inject(HttpClient);

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
}