import { Order } from '../../../core/models';
import { unpaidItems } from './bill';

/** Состояние заказа для подписи/пилюли (label + цвета). */
export interface OrderStatusView {
  key: 'paid' | 'draft' | 'sent' | 'cooking' | 'ready';
  label: string;
  color: string;
  bg: string;
}

const PAID:    OrderStatusView = { key: 'paid',    label: 'Оплачен',     color: '#1d4ed8',                 bg: '#eff6ff' };
const DRAFT:   OrderStatusView = { key: 'draft',   label: 'Новый заказ', color: 'var(--color-gold-hover)', bg: 'var(--color-gold-light)' };
const SENT:    OrderStatusView = { key: 'sent',    label: 'Отправлен',   color: '#4338ca',                 bg: '#eef2ff' };
const COOKING: OrderStatusView = { key: 'cooking', label: 'Готовится',   color: '#92400e',                 bg: '#fffbeb' };
const READY:   OrderStatusView = { key: 'ready',   label: 'Готов',       color: '#166534',                 bg: '#dcfce7' };

/** Единый статус заказа: Оплачен / Новый заказ (черновик) / Отправлен / Готовится / Готов.
 * `is_sent === false` — черновая, ещё не ушедшая на кухню позиция. */
export function orderStatus(o: Order): OrderStatusView {
  if (o.status === 'closed' || o.is_paid) return PAID;
  const items = unpaidItems(o);
  if (!items.length) return o.receipts.length ? PAID : DRAFT;
  if (items.every(i => i.kitchen_status === 'ready')) return READY;
  if (items.some(i => i.kitchen_status === 'cooking' || i.kitchen_status === 'ready')) return COOKING;
  if (items.some(i => i.is_sent === false)) return DRAFT;   // есть неотправленные черновики
  return SENT;                                              // всё ушло на кухню, готовка не началась
}