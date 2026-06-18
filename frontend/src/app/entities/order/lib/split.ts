import { OrderItem } from '../../../core/models';
import { GuestGroup } from './bill';

/** Один чек при раздельной оплате: какие гости/позиции в него входят. */
export interface SplitBill { billNo: number; guests: number[]; items: OrderItem[]; total: number; }

/** Сгруппировать гостей в чеки по карте «гость → номер чека». */
export function splitBills(groups: GuestGroup[], guestBillMap: Record<number, number>): SplitBill[] {
  const bills = new Map<number, { guests: number[]; items: OrderItem[]; total: number }>();
  for (const grp of groups) {
    const bn = guestBillMap[grp.guest] ?? 1;
    if (!bills.has(bn)) bills.set(bn, { guests: [], items: [], total: 0 });
    const b = bills.get(bn)!;
    b.guests.push(grp.guest);
    b.items.push(...grp.items);
    b.total += grp.total;
  }
  return [...bills.entries()].sort(([a], [b]) => a - b).map(([billNo, data]) => ({ billNo, ...data }));
}

/** Доступные номера чеков: использованные + следующий, если ещё есть кого выделять. */
export function billChoices(guestBillMap: Record<number, number>, groupCount: number): number[] {
  const used = new Set(Object.values(guestBillMap));
  const max = used.size ? Math.max(...used) : 0;
  const nums = [...used].sort((a, b) => a - b);
  if (max < groupCount) nums.push(max + 1);
  return nums;
}