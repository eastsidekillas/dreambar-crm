import { Order, OrderItem } from '../../../core/models';

/** Группа позиций одного гостя в неоплаченной части заказа. */
export interface GuestGroup { guest: number; items: OrderItem[]; total: number; }

/** Неоплаченные позиции заказа (ещё не в чеке). */
export function unpaidItems(o: Order): OrderItem[] {
  return o.items.filter(i => i.receipt == null);
}

export function unpaidTotal(o: Order): number {
  return unpaidItems(o).reduce((s, i) => s + +i.subtotal, 0);
}

/** Сколько неоплаченных позиций уже готовы на кухне. */
export function readyCount(o: Order): number {
  return o.items.filter(i => i.receipt == null && i.kitchen_status === 'ready').length;
}

export function elapsed(o: Order): string {
  const min = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
  return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч ${min % 60} мин`;
}

export function guestLabel(guest: number): string {
  return guest === 0 ? 'Общий' : 'Гость ' + guest;
}

/** Неоплаченные позиции, сгруппированные по гостю (отсортировано). */
export function guestGroups(o: Order): GuestGroup[] {
  const byGuest = new Map<number, OrderItem[]>();
  for (const it of unpaidItems(o)) {
    (byGuest.get(it.guest_no) ?? byGuest.set(it.guest_no, []).get(it.guest_no)!).push(it);
  }
  return [...byGuest.keys()].sort((a, b) => a - b).map(guest => {
    const items = byGuest.get(guest)!;
    return { guest, items, total: items.reduce((s, i) => s + +i.subtotal, 0) };
  });
}

/** Пустой стол — по нему ничего не заказывали (нет позиций и чеков). */
export function isEmpty(o: Order): boolean {
  return o.items.length === 0 && o.receipts.length === 0;
}