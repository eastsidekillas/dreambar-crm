import { Order, OrderItem } from '../../../core/models';

/**
 * Операции заказа для офлайн-очереди (Слой 2). Каждая операция:
 *  - знает свой HTTP-запрос ({@link opToRequest}) — единый источник эндпоинтов;
 *  - умеет оптимистично применяться к локальному состоянию ({@link applyOps}).
 *
 * Только аддитивные/безопасные операции существующего заказа. Деньги
 * (checkout/close/печать) и операции с риском конфликта (split/move/create)
 * сюда НЕ попадают — они строго онлайн.
 */
export type OrderOp =
  | { kind: 'addItem'; idem: string; orderId: number; tempItemId: number; menuItemId: number;
      quantity: number; guestNo: number; modifierIds: number[]; name: string; price: number; type: string;
      comment: string; addedAt: string }
  | { kind: 'updateItem'; idem: string; orderId: number; itemId: number; quantity: number; comment: string }
  | { kind: 'removeItem'; idem: string; orderId: number; itemId: number }
  | { kind: 'setItemGuest'; idem: string; orderId: number; itemId: number; guestNo: number }
  | { kind: 'setGlassware'; idem: string; orderId: number; glKind: string; count: number }
  | { kind: 'renameGuest'; idem: string; orderId: number; guestNo: number; name: string }
  | { kind: 'setGuests'; idem: string; orderId: number; guests: number }
  | { kind: 'send'; idem: string; orderId: number };

export interface OpRequest { method: 'POST' | 'DELETE' | 'PATCH'; url: string; body: any; }

/** Единое отображение операции в HTTP-запрос (используется и онлайн, и при флаше). */
export function opToRequest(op: OrderOp, base: string): OpRequest {
  switch (op.kind) {
    case 'addItem': {
      const body: any = { menu_item: op.menuItemId, quantity: op.quantity, guest_no: op.guestNo };
      if (op.modifierIds.length) body.modifiers = op.modifierIds;
      if (op.comment) body.comment = op.comment;
      return { method: 'POST', url: `${base}/orders/${op.orderId}/add_item/`, body };
    }
    case 'updateItem':
      return { method: 'POST', url: `${base}/orders/${op.orderId}/item/${op.itemId}/update/`, body: { quantity: op.quantity, comment: op.comment } };
    case 'removeItem':
      return { method: 'DELETE', url: `${base}/orders/${op.orderId}/remove_item/${op.itemId}/`, body: null };
    case 'setItemGuest':
      return { method: 'POST', url: `${base}/orders/${op.orderId}/item/${op.itemId}/guest/`, body: { guest_no: op.guestNo } };
    case 'setGlassware':
      return { method: 'POST', url: `${base}/orders/${op.orderId}/glassware/`, body: { kind: op.glKind, count: op.count } };
    case 'renameGuest':
      return { method: 'POST', url: `${base}/orders/${op.orderId}/guest/rename/`, body: { guest_no: op.guestNo, name: op.name } };
    case 'setGuests':
      return { method: 'PATCH', url: `${base}/orders/${op.orderId}/`, body: { guests: op.guests } };
    case 'send':
      return { method: 'POST', url: `${base}/orders/${op.orderId}/send/`, body: {} };
  }
}

// ── Оптимистичное применение ─────────────────────────────────────────────────

function cloneOrders(orders: Order[]): Order[] {
  return orders.map(o => ({ ...o, items: o.items.map(i => ({ ...i })), glassware: o.glassware.map(g => ({ ...g })) }));
}
function recalc(o: Order) {
  o.total = o.items.filter(i => i.receipt == null).reduce((s, i) => s + Number(i.subtotal), 0);
}
function find(orders: Order[], id: number): Order | undefined { return orders.find(o => o.id === id); }

function applyOp(orders: Order[], op: OrderOp): Order[] {
  const o = find(orders, op.orderId);
  if (!o) return orders;
  switch (op.kind) {
    case 'addItem': {
      const item: OrderItem = {
        id: op.tempItemId, menu_item: op.menuItemId, menu_item_name: op.name, menu_item_type: op.type,
        quantity: op.quantity, unit_price: op.price, subtotal: op.price * op.quantity,
        guest_no: op.guestNo, receipt: null, kitchen_status: 'new', comment: op.comment, is_sent: false,
        created_at: op.addedAt,
      };
      o.items = [...o.items, item];
      recalc(o); break;
    }
    case 'updateItem': {
      const it = o.items.find(i => i.id === op.itemId);
      if (it) { it.quantity = op.quantity; it.comment = op.comment; it.subtotal = it.unit_price * op.quantity; recalc(o); }
      break;
    }
    case 'removeItem':
      o.items = o.items.filter(i => i.id !== op.itemId); recalc(o); break;
    case 'setItemGuest': {
      const it = o.items.find(i => i.id === op.itemId);
      if (it) it.guest_no = op.guestNo;
      break;
    }
    case 'setGlassware': {
      const gl = o.glassware.find(g => g.kind === op.glKind);
      if (op.count <= 0) o.glassware = o.glassware.filter(g => g.kind !== op.glKind);
      else if (gl) gl.count = op.count;
      else o.glassware = [...o.glassware, { kind: op.glKind, count: op.count }];
      break;
    }
    case 'renameGuest': {
      const names = { ...(o.guest_names ?? {}) };
      if (op.name) names[String(op.guestNo)] = op.name; else delete names[String(op.guestNo)];
      o.guest_names = names; break;
    }
    case 'setGuests':
      o.guests = op.guests; break;
    case 'send':
      o.items = o.items.map(i => ({ ...i, is_sent: true })); break;
  }
  return orders;
}

/** Состояние для UI = серверная база + неотправленные операции поверх. */
export function applyOps(base: Order[], ops: OrderOp[]): Order[] {
  return ops.reduce((acc, op) => applyOp(acc, op), cloneOrders(base));
}