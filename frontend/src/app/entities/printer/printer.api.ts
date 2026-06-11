import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Printer, ReceiptSettings } from '../../core/models';
import { API_BASE as BASE } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class PrinterApi {
  private http = inject(HttpClient);

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
  getReceiptSettings(): Observable<ReceiptSettings> {
    return this.http.get<ReceiptSettings>(`${BASE}/printers/receipt-settings/`);
  }
  updateReceiptSettings(data: Partial<ReceiptSettings>): Observable<ReceiptSettings> {
    return this.http.patch<ReceiptSettings>(`${BASE}/printers/receipt-settings/`, data);
  }
}