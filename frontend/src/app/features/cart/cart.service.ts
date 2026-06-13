import { Injectable, signal, computed, effect } from '@angular/core';
import { MenuItem, Order } from '../../core/models';

/** Строка корзины. guestNo: 0 — общая позиция, 1..N — конкретный гость. */
export interface CartItem { item: MenuItem; qty: number; guestNo: number; }

const CART_KEY = 'waiter_cart';

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>(this.restore());

  /** Если задано — корзина пополняет существующую посадку, а не создаёт новую. */
  private _target = signal<Order | null>(this.restoreTarget());
  readonly target = this._target.asReadonly();

  constructor() {
    // Набранный заказ переживает перезагрузку страницы / выгрузку вкладки телефоном
    effect(() => {
      const items = this._items();
      const target = this._target();
      try {
        if (items.length) {
          localStorage.setItem(CART_KEY, JSON.stringify({ items, target }));
        } else {
          localStorage.removeItem(CART_KEY);
        }
      } catch { /* квота localStorage — не критично */ }
    });
  }

  private restore(): CartItem[] {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '{}').items ?? [];
    } catch { return []; }
  }

  private restoreTarget(): Order | null {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || '{}').target ?? null;
    } catch { return null; }
  }

  readonly items    = this._items.asReadonly();
  readonly total    = computed(() => this._items().reduce((s, c) => s + c.item.price * c.qty, 0));
  readonly count    = computed(() => this._items().reduce((s, c) => s + c.qty, 0));
  readonly hasItems = computed(() => this._items().length > 0);

  setTarget(order: Order | null): void { this._target.set(order); }

  /** Позиции одного блюда для разных гостей — это разные строки. */
  private find(items: CartItem[], itemId: number, guestNo: number): number {
    return items.findIndex(c => c.item.id === itemId && c.guestNo === guestNo);
  }

  add(item: MenuItem, guestNo = 0): void {
    const cur = this._items();
    const idx = this.find(cur, item.id, guestNo);
    if (idx >= 0) {
      const u = [...cur];
      u[idx] = { ...u[idx], qty: u[idx].qty + 1 };
      this._items.set(u);
    } else {
      this._items.set([...cur, { item, qty: 1, guestNo }]);
    }
  }

  remove(itemId: number, guestNo = 0): void {
    const cur = this._items();
    const idx = this.find(cur, itemId, guestNo);
    if (idx < 0) return;
    if (cur[idx].qty === 1) {
      this._items.set(cur.filter((_, i) => i !== idx));
    } else {
      const u = [...cur];
      u[idx] = { ...u[idx], qty: u[idx].qty - 1 };
      this._items.set(u);
    }
  }

  /** Количество блюда у конкретного гостя. */
  qty(itemId: number, guestNo = 0): number {
    return this._items().find(c => c.item.id === itemId && c.guestNo === guestNo)?.qty ?? 0;
  }

  clear(): void { this._items.set([]); this._target.set(null); }
}