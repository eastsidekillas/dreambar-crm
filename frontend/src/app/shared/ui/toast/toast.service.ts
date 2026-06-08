import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'info' | 'warn';

export interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private nextId = 0;

  show(message: string, type: ToastType = 'success', duration = 3000) {
    const id = ++this.nextId;
    this.toasts.update(list => [...list.slice(-2), { id, message, type }]);
    setTimeout(() => this.dismiss(id), duration);
  }

  dismiss(id: number) {
    this.toasts.update(list => list.filter(t => t.id !== id));
  }

  success(msg: string)  { this.show(msg, 'success', 3000); }
  info(msg: string)     { this.show(msg, 'info',    3500); }
  warn(msg: string)     { this.show(msg, 'warn',    4000); }
  error(msg: string)    { this.show(msg, 'error',   5000); }

  /** Извлекает сообщение из ошибки DRF и показывает toast. */
  apiError(err: any, fallback = 'Ошибка сервера') {
    this.error(extractApiError(err, fallback));
  }
}

export function extractApiError(err: any, fallback = 'Ошибка сервера'): string {
  const data = err?.error;
  if (!data) return err?.message || fallback;
  if (typeof data === 'string' && data.length < 300) return data;
  if (data.detail)               return String(data.detail);
  if (data.non_field_errors?.length) return String(data.non_field_errors[0]);
  const firstVal = Object.values(data)[0];
  if (Array.isArray(firstVal) && firstVal.length) return String(firstVal[0]);
  if (typeof firstVal === 'string')               return firstVal;
  return fallback;
}
