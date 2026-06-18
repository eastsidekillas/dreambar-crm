import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';
import { Order } from '../models';
import { API_BASE as BASE } from '../../shared/api';
import { OrderOp, opToRequest, applyOps } from '../../entities/order/lib/order-ops';
import { ConnectivityService } from './connectivity.service';
import { LoggerService } from './logger.service';

/** Сетевой сбой (нет связи / сервер молчит), а не ответ сервера с ошибкой. */
export function isNetworkError(err: unknown): boolean {
  return (err as any)?.name === 'TimeoutError' || (err instanceof HttpErrorResponse && err.status === 0);
}

const LS_OPS = 'db_offline_ops';
const LS_BASE = 'db_offline_base';

/**
 * Офлайн-движок официанта (Слой 2). Держит:
 *  - `base` — последнее серверное состояние активных заказов;
 *  - `ops`  — неотправленные операции (durable, localStorage);
 *  - `orders` = base + ops (то, что видит UI).
 *
 * Мутации идут online-first (через OrderApi-gateway); при сетевом сбое операция
 * кладётся сюда и применяется оптимистично, а на реконнекте флашится по порядку
 * с тем же Idempotency-Key (сервер не создаёт дублей). Деньги/печать сюда не попадают.
 *
 * Персист — localStorage (синхронно, данные маленькие и ограниченные; проще и
 * безопаснее IndexedDB для нашего объёма).
 */
@Injectable({ providedIn: 'root' })
export class OfflineService {
  private http = inject(HttpClient);
  private connectivity = inject(ConnectivityService);
  private logger = inject(LoggerService);

  private base = signal<Order[]>(this.load<Order[]>(LS_BASE, []));
  private ops = signal<OrderOp[]>(this.load<OrderOp[]>(LS_OPS, []));

  /** Состояние для UI: серверная база + неотправленные операции поверх. */
  readonly orders = computed(() => applyOps(this.base(), this.ops()));
  /** Сколько операций ждёт синхронизации (для индикатора). */
  readonly pendingCount = computed(() => this.ops().length);

  private flushing = false;

  constructor() {
    // Персист при любом изменении.
    effect(() => localStorage.setItem(LS_OPS, JSON.stringify(this.ops())));
    effect(() => localStorage.setItem(LS_BASE, JSON.stringify(this.base())));
    // Реконнект → флаш.
    effect(() => { if (!this.connectivity.offline()) this.flush(); });
    window.addEventListener('online', () => this.flush());
    this.flush();   // вдруг остались операции с прошлой сессии
  }

  // ── чтение/запись состояния ────────────────────────────────────────
  orderById(id: number): Order | undefined { return this.orders().find(o => o.id === id); }

  /** Заменить серверную базу (после успешного getActiveOrders). */
  setBase(list: Order[]) { this.base.set(list); }

  /** Успешная онлайн-мутация вернула свежий заказ — обновляем базу. */
  patchOrder(order: Order) {
    this.base.update(list => {
      const i = list.findIndex(o => o.id === order.id);
      if (i === -1) return [...list, order];
      const copy = [...list]; copy[i] = order; return copy;
    });
  }

  // ── очередь ─────────────────────────────────────────────────────────
  newIdem(): string {
    return (crypto as any)?.randomUUID?.()
      ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  }
  /** Следующий временный id позиции (отрицательный, не пересекается с серверными). */
  nextTempItemId(): number {
    const min = this.ops().reduce((m, op) => op.kind === 'addItem' ? Math.min(m, op.tempItemId) : m, 0);
    return min - 1;
  }

  enqueue(op: OrderOp) { this.ops.update(list => [...list, op]); }

  // Правки ещё не синхронизированной позиции (tempItemId<0): меняем саму
  // операцию addItem, а не шлём новую — так не нужен ремап temp→real id.
  cancelTempItem(tempItemId: number) {
    this.ops.update(list => list.filter(op => !(op.kind === 'addItem' && op.tempItemId === tempItemId)));
  }
  updateTempItem(tempItemId: number, data: { quantity: number; comment: string }) {
    this.ops.update(list => list.map(op =>
      op.kind === 'addItem' && op.tempItemId === tempItemId
        ? { ...op, quantity: data.quantity, comment: data.comment } : op));
  }
  setTempItemGuest(tempItemId: number, guestNo: number) {
    this.ops.update(list => list.map(op =>
      op.kind === 'addItem' && op.tempItemId === tempItemId ? { ...op, guestNo } : op));
  }

  // ── флаш ────────────────────────────────────────────────────────────
  async flush(): Promise<void> {
    if (this.flushing || !this.ops().length) return;
    this.flushing = true;
    try {
      while (this.ops().length) {
        const op = this.ops()[0];
        const { method, url, body } = opToRequest(op, BASE);
        let drop = true;
        try {
          await lastValueFrom(this.http.request(method, url, { body, headers: { 'Idempotency-Key': op.idem } }));
        } catch (e) {
          if (isNetworkError(e)) { drop = false; break; }   // связь снова пропала — позже
          // 4xx/5xx — операцию не переиграть (иначе вечный цикл): выкидываем + лог.
          this.logger.warn(`Офлайн-операция ${op.kind} отброшена при синхронизации`);
        }
        if (drop) this.ops.update(list => list.filter(o => o.idem !== op.idem));
      }
    } finally {
      this.flushing = false;
    }
    // Заменяем оптимистику реальными данными сервера (без мигания).
    try {
      const list = await lastValueFrom(this.http.get<Order[]>(`${BASE}/orders/active/`));
      this.setBase(list);
    } catch { /* всё ещё офлайн — обновимся при следующем поллинге */ }
  }

  private load<T>(key: string, fallback: T): T {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) as T : fallback; }
    catch { return fallback; }
  }
}