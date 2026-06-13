import { Injectable, signal, computed, effect, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { ApiService } from './api.service';
import { NetworkService } from './network.service';
import { Order, OrderItem } from '../models';

const STORAGE_KEY = 'dreambar_outbox_v2';
const SEQ_KEY = 'dreambar_outbox_seq';
const FLUSH_INTERVAL_MS = 12_000;

/** Позиция, ожидающая отправки на сервер. */
export interface PendingItem {
  localItemId: number;        // отрицательный, стабильный id для UI/track
  menu_item: number;
  menu_item_name: string;
  menu_item_type: string;
  quantity: number;
  unit_price: number;
  guest_no: number;
}

type OpStatus = 'pending' | 'error';

/** Открытие нового стола офлайн (вместе с первыми позициями). */
interface CreateOp {
  kind: 'create';
  cid: string;
  localId: number;            // отрицательный, используется как Order.id локально
  shift: number;
  table_number: string;
  guests: number;
  notes: string;
  items: PendingItem[];
  status: OpStatus;
  error?: string;
  createdAt: number;
}

/** Дозаказ к уже существующему (серверному) столу. */
interface AddOp {
  kind: 'add';
  cid: string;
  orderId: number;            // реальный серверный id заказа
  table_number: string;
  items: PendingItem[];
  status: OpStatus;
  error?: string;
  createdAt: number;
}

type Op = CreateOp | AddOp;

export interface CartLikeItem {
  menu_item: number;
  menu_item_name: string;
  menu_item_type?: string;
  quantity: number;
  unit_price: number;
  guest_no: number;
}

function isNetworkError(e: unknown): boolean {
  return e instanceof HttpErrorResponse && e.status === 0;
}

/**
 * Офлайн-очередь действий официанта.
 *
 * Поддерживает только БЕЗОПАСНЫЕ для повторной отправки операции:
 * открытие стола и дозаказ. Закрытие счёта и печать остаются ОНЛАЙН
 * (иначе риск двойных чеков). Очередь персистится в localStorage и
 * автоматически досылается при возврате сети.
 */
@Injectable({ providedIn: 'root' })
export class OutboxService {
  private readonly api = inject(ApiService);
  private readonly net = inject(NetworkService);

  private readonly _ops = signal<Op[]>(this.load());
  private flushing = false;
  /** localId офлайн-стола → реальный серверный id после синхронизации. */
  private readonly syncedMap = new Map<number, number>();

  /** Сколько действий ждёт синхронизации. */
  readonly pendingCount = computed(
    () => this._ops().filter((o) => o.status === 'pending').length,
  );
  /** Есть ли действия, которые сервер отклонил (требуют внимания). */
  readonly hasErrors = computed(() => this._ops().some((o) => o.status === 'error'));

  /** Счётчик успешных синхронизаций — экраны обновляют список при изменении. */
  readonly synced = signal(0);

  /** Офлайн-столы (ещё не созданы на сервере) в виде Order для отрисовки. */
  readonly offlineOrders = computed<Order[]>(() =>
    this._ops()
      .filter((o): o is CreateOp => o.kind === 'create')
      .map((op) => this.opToOrder(op)),
  );

  constructor() {
    // Досылаем очередь, как только появилась сеть.
    effect(() => {
      if (this.net.online() && this.pendingCount() > 0) void this.flush();
    });
    if (typeof window !== 'undefined') {
      setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    }
  }

  // ── Очередь: добавление ───────────────────────────────────────────

  /** Открыть стол офлайн. Возвращает локальный id (отрицательный). */
  queueCreate(p: {
    shift: number;
    table_number: string;
    guests: number;
    notes: string;
    items: CartLikeItem[];
  }): number {
    const localId = this.nextSeq();
    const op: CreateOp = {
      kind: 'create',
      cid: this.cid(),
      localId,
      shift: p.shift,
      table_number: p.table_number,
      guests: p.guests,
      notes: p.notes,
      items: p.items.map((it) => this.toPending(it)),
      status: 'pending',
      createdAt: Date.now(),
    };
    this._ops.update((list) => [...list, op]);
    this.persist();
    void this.flush();
    return localId;
  }

  /** Дозаказ к серверному столу офлайн. */
  queueAdd(orderId: number, tableNumber: string, items: CartLikeItem[]): void {
    const op: AddOp = {
      kind: 'add',
      cid: this.cid(),
      orderId,
      table_number: tableNumber,
      items: items.map((it) => this.toPending(it)),
      status: 'pending',
      createdAt: Date.now(),
    };
    this._ops.update((list) => [...list, op]);
    this.persist();
    void this.flush();
  }

  /**
   * Дозаказ к офлайн-столу (ещё не синхронизированному): дописываем в его
   * create-операцию. Если стол уже успел синхронизироваться, переадресуем
   * дозаказ на реальный серверный id. Возвращает false только если стол
   * вообще не найден.
   */
  addToOfflineOrder(localId: number, tableNumber: string, items: CartLikeItem[]): boolean {
    let found = false;
    this._ops.update((list) =>
      list.map((o) => {
        if (o.kind === 'create' && o.localId === localId) {
          found = true;
          return { ...o, items: [...o.items, ...items.map((it) => this.toPending(it))] };
        }
        return o;
      }),
    );
    if (found) {
      this.persist();
      return true;
    }
    // Стол уже создан на сервере, пока официант набирал дозаказ.
    const realId = this.syncedMap.get(localId);
    if (realId != null) {
      this.queueAdd(realId, tableNumber, items);
      return true;
    }
    return false;
  }

  // ── Очередь: редактирование (офлайн-столы) ────────────────────────

  updateOfflineOrder(
    localId: number,
    data: { table_number?: string; guests?: number; notes?: string },
  ): void {
    this._ops.update((list) =>
      list.map((o) =>
        o.kind === 'create' && o.localId === localId ? { ...o, ...data } : o,
      ),
    );
    this.persist();
  }

  /** Удалить позицию из несинхронизированного стола / дозаказа. */
  removePendingItem(localItemId: number): void {
    this._ops.update((list) =>
      list
        .map((o) => ({ ...o, items: o.items.filter((it) => it.localItemId !== localItemId) }))
        // create-операции без позиций оставляем (пустой стол), add-операции без позиций удаляем
        .filter((o) => o.kind === 'create' || o.items.length > 0),
    );
    this.persist();
  }

  /** Отменить офлайн-стол целиком (до синхронизации). */
  cancelOfflineOrder(localId: number): void {
    this._ops.update((list) =>
      list.filter((o) => !(o.kind === 'create' && o.localId === localId)),
    );
    this.persist();
  }

  /** Позиции дозаказов (к серверным столам), ещё не отправленные. */
  pendingItemsForOrder(orderId: number): OrderItem[] {
    const out: OrderItem[] = [];
    for (const o of this._ops()) {
      if (o.kind === 'add' && o.orderId === orderId) {
        for (const it of o.items) out.push(this.synthItem(it));
      }
    }
    return out;
  }

  isOfflineId(id: number): boolean {
    return id < 0;
  }

  // ── Синхронизация ─────────────────────────────────────────────────

  async flush(): Promise<void> {
    // Гейтим по navigator.onLine (а не по сигналу online): сигнал может
    // временно «залипнуть» из-за кэшированных service worker'ом GET-ответов,
    // а попытка реальной мутации сама уточнит доступность сервера.
    if (this.flushing || !this.isReachable()) return;
    const queue = this._ops().filter((o) => o.status === 'pending');
    if (!queue.length) return;

    this.flushing = true;
    try {
      for (const op of queue) {
        if (!this.isReachable()) break;
        try {
          if (op.kind === 'create') await this.processCreate(op);
          else await this.processAdd(op);
        } catch (e) {
          if (isNetworkError(e)) break; // сеть пропала — повторим позже
          this.markError(op.cid, this.errMsg(e)); // сервер отклонил — не зацикливаемся
        }
      }
    } finally {
      this.flushing = false;
      this.persist();
    }
    // Операции, добавленные во время прохода (например, дозаказ к только что
    // созданному столу), досылаем следующим проходом.
    if (this.isReachable() && this.pendingCount() > 0) {
      setTimeout(() => void this.flush(), 0);
    }
  }

  private isReachable(): boolean {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }

  private async processCreate(op: CreateOp): Promise<void> {
    const sentIds = new Set(op.items.map((it) => it.localItemId));
    const order = await firstValueFrom(
      this.api.createOrder({
        shift: op.shift,
        table_number: op.table_number,
        guests: op.guests,
        notes: op.notes,
        items: op.items.map((it) => ({
          menu_item: it.menu_item,
          quantity: it.quantity,
          guest_no: it.guest_no,
        })),
      }),
    );
    this.syncedMap.set(op.localId, order.id);
    // Позиции, добавленные пока шёл запрос (которых не было в отправленном
    // наборе), переносим в дозаказ к новому столу.
    const current = this._ops().find((o) => o.cid === op.cid) as CreateOp | undefined;
    const extra = current ? current.items.filter((it) => !sentIds.has(it.localItemId)) : [];
    this.removeOp(op.cid);
    if (extra.length) {
      this.queueAdd(
        order.id,
        op.table_number,
        extra.map((it) => this.fromPending(it)),
      );
    }
  }

  private async processAdd(op: AddOp): Promise<void> {
    // По одной позиции, удаляя успешно отправленные — чтобы при разрыве не было дублей.
    while (true) {
      const cur = this._ops().find((o) => o.cid === op.cid) as AddOp | undefined;
      if (!cur || !cur.items.length) break;
      const it = cur.items[0];
      await firstValueFrom(
        this.api.addItemToOrder(cur.orderId, it.menu_item, it.quantity, it.guest_no),
      );
      this._ops.update((list) =>
        list.map((o) =>
          o.cid === op.cid ? { ...o, items: o.items.slice(1) } : o,
        ),
      );
      this.persist();
    }
    this.removeOp(op.cid);
  }

  // ── Внутреннее ────────────────────────────────────────────────────

  private opToOrder(op: CreateOp): Order {
    const items = op.items.map((it) => this.synthItem(it));
    const total = items.reduce((s, i) => s + +i.subtotal, 0);
    const iso = new Date(op.createdAt).toISOString();
    return {
      id: op.localId,
      shift: op.shift,
      waiter: 0,
      waiter_name: '',
      table_number: op.table_number,
      guests: op.guests,
      status: 'open',
      created_at: iso,
      updated_at: iso,
      closed_at: null,
      notes: op.notes,
      reservation: null,
      reservation_info: null,
      items,
      receipts: [],
      total,
      is_paid: false,
      _offline: true,
      _syncError: op.status === 'error',
    };
  }

  private synthItem(it: PendingItem): OrderItem {
    return {
      id: it.localItemId,
      menu_item: it.menu_item,
      menu_item_name: it.menu_item_name,
      menu_item_type: it.menu_item_type,
      quantity: it.quantity,
      unit_price: it.unit_price,
      subtotal: it.unit_price * it.quantity,
      guest_no: it.guest_no,
      receipt: null,
      kitchen_status: 'new',
      _pending: true,
    };
  }

  private toPending(it: CartLikeItem): PendingItem {
    return {
      localItemId: this.nextSeq(),
      menu_item: it.menu_item,
      menu_item_name: it.menu_item_name,
      menu_item_type: it.menu_item_type ?? '',
      quantity: it.quantity,
      unit_price: it.unit_price,
      guest_no: it.guest_no,
    };
  }

  private fromPending(it: PendingItem): CartLikeItem {
    return {
      menu_item: it.menu_item,
      menu_item_name: it.menu_item_name,
      menu_item_type: it.menu_item_type,
      quantity: it.quantity,
      unit_price: it.unit_price,
      guest_no: it.guest_no,
    };
  }

  private markError(cid: string, msg: string): void {
    this._ops.update((list) =>
      list.map((o) => (o.cid === cid ? { ...o, status: 'error', error: msg } : o)),
    );
  }

  private removeOp(cid: string): void {
    this._ops.update((list) => list.filter((o) => o.cid !== cid));
    this.persist();
    this.synced.update((n) => n + 1);
  }

  private errMsg(e: unknown): string {
    if (e instanceof HttpErrorResponse) {
      const d: any = e.error;
      return (d?.detail || d?.non_field_errors?.[0] || e.message || 'Ошибка сервера') as string;
    }
    return 'Ошибка синхронизации';
  }

  // ── localStorage ──────────────────────────────────────────────────

  private load(): Op[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this._ops()));
    } catch {
      /* квота переполнена — игнорируем */
    }
  }

  private nextSeq(): number {
    let n = -1;
    try {
      n = (parseInt(localStorage.getItem(SEQ_KEY) || '0', 10) || 0) - 1;
      localStorage.setItem(SEQ_KEY, String(n));
    } catch {
      n = -Date.now();
    }
    return n;
  }

  private cid(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}