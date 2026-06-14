/**
 * Каталог прав — имена должны совпадать с backend (apps/users/permissions_matrix.py, класс Perm).
 *
 * Здесь НЕТ матрицы «роль → права»: она живёт только на backend и приходит готовой
 * в /auth/me ответе (поле `permissions`). Фронт лишь спрашивает «есть ли право X».
 */
export const Perm = {
  ORDER_CREATE:       'order.create',
  ORDER_VIEW_ALL:     'order.view_all',
  ORDER_EDIT_ANY:     'order.edit_any',

  SHIFT_OPEN:         'shift.open',
  SHIFT_CLOSE:        'shift.close',
  SHIFT_REOPEN:       'shift.reopen',

  KITCHEN_VIEW:       'kitchen.view',
  KITCHEN_UPDATE:     'kitchen.update_status',

  MENU_MANAGE:        'menu.manage',
  MENU_TOGGLE_STOCK:  'menu.toggle_stock',
  TABLE_MANAGE:       'table.manage',
  INVENTORY_MANAGE:   'inventory.manage',

  TICKET_SELL:        'ticket.sell',
  TICKET_MANAGE:      'ticket.manage',

  RESERVATION_VIEW:   'reservation.view',
  RESERVATION_MANAGE: 'reservation.manage',
  EMPLOYEE_MANAGE:    'employee.manage',
  ANALYTICS_FINANCE:  'analytics.finance',
  PRINTER_MANAGE:     'printer.manage',
} as const;

export type Permission = typeof Perm[keyof typeof Perm];

/** Право-джокер: полный доступ (админ). */
export const WILDCARD = '*';