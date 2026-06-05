import { Injectable, signal, computed } from '@angular/core';
import { MenuItem } from '../../core/models';

export interface CartItem { item: MenuItem; qty: number; }

@Injectable({ providedIn: 'root' })
export class CartService {
  private _items = signal<CartItem[]>([]);

  readonly items    = this._items.asReadonly();
  readonly total    = computed(() => this._items().reduce((s, c) => s + c.item.price * c.qty, 0));
  readonly count    = computed(() => this._items().reduce((s, c) => s + c.qty, 0));
  readonly hasItems = computed(() => this._items().length > 0);

  add(item: MenuItem): void {
    const cur = this._items();
    const idx = cur.findIndex(c => c.item.id === item.id);
    if (idx >= 0) {
      const u = [...cur];
      u[idx] = { ...u[idx], qty: u[idx].qty + 1 };
      this._items.set(u);
    } else {
      this._items.set([...cur, { item, qty: 1 }]);
    }
  }

  remove(itemId: number): void {
    const cur = this._items();
    const idx = cur.findIndex(c => c.item.id === itemId);
    if (idx < 0) return;
    if (cur[idx].qty === 1) {
      this._items.set(cur.filter(c => c.item.id !== itemId));
    } else {
      const u = [...cur];
      u[idx] = { ...u[idx], qty: u[idx].qty - 1 };
      this._items.set(u);
    }
  }

  qty(itemId: number): number {
    return this._items().find(c => c.item.id === itemId)?.qty ?? 0;
  }

  clear(): void { this._items.set([]); }
}
