export { OrderApi } from './order.api';
export type { BillSpec } from './order.api';

// Доменные расчёты заказа (счёт по гостям, готовность, время). Namespace `bill` + именованные.
export * as bill from './lib/bill';
export { unpaidItems, unpaidTotal, readyCount, elapsed, guestLabel, guestGroups, isEmpty } from './lib/bill';
export type { GuestGroup } from './lib/bill';

// Разделение счёта (раздельная оплата). Namespace `split`.
export * as split from './lib/split';
export type { SplitBill } from './lib/split';

// Единый статус заказа (Новый/Отправлен/Готовится/Готов/Оплачен).
export { orderStatus } from './lib/status';
export type { OrderStatusView } from './lib/status';