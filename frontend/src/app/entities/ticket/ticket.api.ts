import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntryTicket } from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class TicketApi {
  private http = inject(HttpClient);

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
}