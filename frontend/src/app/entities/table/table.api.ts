import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Zone, VenueTable } from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class TableApi {
  private http = inject(HttpClient);

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