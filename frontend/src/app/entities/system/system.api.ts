import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SystemStatus } from '../../core/models';
import { API_BASE as BASE } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class SystemApi {
  private http = inject(HttpClient);

  /** Публичный статус — без авторизации, для опроса и заглушки на всех экранах. */
  getStatus(): Observable<SystemStatus> {
    return this.http.get<SystemStatus>(`${BASE}/system/status/`);
  }

  /** Остановить систему (нужно право system.control). */
  stop(message?: string): Observable<SystemStatus> {
    return this.http.post<SystemStatus>(`${BASE}/system/stop/`, { message: message ?? '' });
  }

  /** Возобновить работу. */
  resume(): Observable<SystemStatus> {
    return this.http.post<SystemStatus>(`${BASE}/system/resume/`, {});
  }
}