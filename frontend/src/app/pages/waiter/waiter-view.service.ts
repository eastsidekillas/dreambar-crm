import { Injectable, signal } from '@angular/core';

/** Фильтр плана зала: мои столы / все столы / брони. */
export type WaiterFilter = 'mine' | 'all' | 'reservations';
/** Сортировка плана зала. */
export type WaiterSort = 'number' | 'table' | 'status';

/** Общее состояние шапки официанта (фильтр/сортировка) — задаётся в шапке, читается планом зала. */
@Injectable({ providedIn: 'root' })
export class WaiterViewService {
  filter        = signal<WaiterFilter>('all');
  sort          = signal<WaiterSort>('number');
  sortSheetOpen = signal(false);
}