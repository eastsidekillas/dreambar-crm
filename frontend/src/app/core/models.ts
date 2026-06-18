export type Role = 'admin' | 'waiter' | 'bartender' | 'kitchen' | 'wardrobe';

export interface VenueTable {
  id: number;
  zone: number;
  zone_name: string;
  number: string;
  seats: number;
  is_active: boolean;
  note: string;
}

export interface Zone {
  id: number;
  name: string;
  color: string;
  sort: number;
  /** VIP-зона: в ней брони берут депозит. */
  requires_deposit: boolean;
  /** Минимальный депозит (₽). 0 — депозит опционален, >0 — минимум обязателен. */
  min_deposit: number;
  tables: VenueTable[];
}

export type KitchenStatus = 'new' | 'cooking' | 'ready';

export interface KitchenItem {
  id: number;
  name: string;
  volume: string;
  quantity: number;
  kitchen_status: KitchenStatus;
  /** Выбранные модификаторы (названия) — показываем на кухонном экране. */
  modifiers?: string[];
}

/** Посуда к столу (не позиция заказа, в чек не входит). */
export interface GlasswareLine {
  kind: string;
  label?: string;       // подпись с бэка (kind_label) — для тикета
  kind_label?: string;  // подпись с бэка (OrderSerializer)
  count: number;
}

export interface KitchenTicket {
  order_id: number;
  table_number: string;
  waiter_name: string;
  source: 'bar' | 'table';
  notes: string;
  glassware?: GlasswareLine[];
  created_at: string;
  elapsed_min: number;
  items: KitchenItem[];
}

export interface KitchenData {
  shift: number | null;
  date?: string;
  active: KitchenTicket[];
  ready: KitchenTicket[];
  ready_today: number;
}

export interface User {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  display_name?: string;
  is_staff?: boolean;
  role?: Role;
  allowed_roles?: Role[];
  has_pin?: boolean;
  must_change_password?: boolean;
  /** Эффективные права по матрице ролей (с backend). '*' = полный доступ (админ). */
  permissions?: string[];
}

export interface Employee {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  role_label: string;
  allowed_roles: Role[];
  is_active: boolean;
  has_pin?: boolean;
  must_change_password?: boolean;
}

export interface StaffMember {
  id: number;
  display_name: string;
  role: Role;
  role_label: string;
  has_pin: boolean;
}

export interface EmployeeActivity {
  user_id: number;
  username: string;
  display_name: string;
  role: Role;
  role_label: string;
  orders_count: number;
  tickets_count: number;
  bar_revenue: number;
  kitchen_revenue: number;
  hookah_revenue: number;
  ticket_revenue: number;
  total_revenue: number;
  avg_check: number;
  total_guests: number;
  deleted_count: number;
  deleted_amount: number;
}

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface Shift {
  id: number;
  date: string;
  opened_by: number;
  opened_by_name: string;
  opened_at: string;
  closed_at: string | null;
  is_open: boolean;
  notes: string;
  total_revenue: number;
  orders_count: number;
  tickets_count: number;
}

export interface Menu {
  id: number;
  name: string;
  is_active: boolean;
  created_at: string;
  sections_count: number;
  items_count: number;
}

export interface MenuSection {
  id: number;
  menu: number;
  menu_name: string;
  name: string;
  station_type: 'bar' | 'kitchen' | 'hookah';
  icon: string;
  sort_order: number;
  is_active: boolean;
}

export interface MenuCategory {
  id: number;
  name: string;
  section: number;
  section_name: string;
  station_type: 'bar' | 'kitchen' | 'hookah';
  print_station: string;
  is_active: boolean;
  sort_order: number;
}

export interface MenuItem {
  id: number;
  name: string;
  volume: string;
  description: string;
  price: number;
  cost_price: number;
  is_active: boolean;
  is_out_of_stock: boolean;
  sort_order: number;
  category: number;
  category_name: string;
  category_type: 'bar' | 'kitchen' | 'hookah';
  print_station: string;
  /** Есть ли у позиции группы модификаторов (тогда при добавлении показываем выбор). */
  has_modifiers?: boolean;
}

export interface MenuByCategory {
  id: number;
  name: string;
  section_id: number;
  section_name: string;
  station_type: 'bar' | 'kitchen' | 'hookah';
  print_station: string;
  items: MenuItem[];
}

export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'mixed';

export interface OrderItem {
  id: number;
  menu_item: number;
  menu_item_name: string;
  menu_item_type: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  guest_no: number;
  receipt: number | null;
  kitchen_status: 'new' | 'cooking' | 'ready';
  comment?: string;
  is_sent?: boolean;
  created_at?: string;
}

export interface ReceiptItem {
  id: number;
  menu_item_name: string;
  menu_item_volume: string;
  menu_item_type: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface Receipt {
  id: number;
  order: number;
  shift: number;
  number: number;
  code: string;
  table_number: string;
  waiter: number;
  waiter_name: string;
  payment_method: PaymentMethod;
  payment_label: string;
  total: number;
  deposit_amount: number;
  deposit_method: string;
  deposit_method_label: string;
  refund_amount: number;
  issued_at: string;
  items: ReceiptItem[];
}

export interface ReservationInfo {
  id: number;
  name: string;
  phone: string;
  guests_count: number;
  deposit_amount: string;
  deposit_method: string;
  deposit_method_label: string;
  deposit_paid: boolean;
  status: string;
  wishes: string;
}

export interface Order {
  id: number;
  shift: number;
  waiter: number;
  waiter_name: string;
  table_number: string;
  guests: number;
  status: 'open' | 'closed' | 'cancelled';
  created_at: string;
  updated_at: string;
  closed_at: string | null;
  notes: string;
  reservation: number | null;
  reservation_info: ReservationInfo | null;
  deposit_amount: number;
  deposit_method: string;
  deposit_method_label: string;
  guest_names?: Record<string, string>;
  items: OrderItem[];
  receipts: Receipt[];
  glassware: GlasswareLine[];
  total: number;
  is_paid: boolean;
}

export type ReservationStatus = 'pending' | 'confirmed' | 'arrived' | 'completed' | 'cancelled';

export interface Reservation {
  id: number;
  name: string;
  phone: string;
  date: string;
  time_start: string;
  time_end: string | null;
  table: number | null;
  table_number: string;
  guests_count: number;
  wishes: string;
  deposit_amount: number;
  deposit_method: 'cash' | 'transfer' | '';
  deposit_method_label: string;
  deposit_paid: boolean;
  status: ReservationStatus;
  status_label: string;
  notes: string;
  created_at: string;
  created_by: number | null;
  created_by_name: string | null;
}

export interface EntryTicket {
  id: number;
  shift: number;
  bracelet_number: string;
  price: number;
  sold_at: string;
  created_by: number;
  created_by_name: string;
}

export interface DashboardData {
  period_days: number;
  total_revenue: number;
  by_category: {
    bar: number;
    kitchen: number;
    hookah: number;
    tickets: number;
  };
  total_orders: number;
  total_guests: number;
  total_tickets: number;
  shifts_count: number;
  current_shift: CurrentShiftData | null;
}

export interface CurrentShiftData {
  id: number;
  date: string;
  bar: number;
  kitchen: number;
  hookah: number;
  tickets: number;
  orders_count: number;
  tickets_count: number;
}

export interface ShiftAnalytics {
  shift_id: number;
  date: string;
  is_open: boolean;
  bar: number;
  kitchen: number;
  hookah: number;
  tickets: number;
  total: number;
  orders_count: number;
  tickets_count: number;
}

export interface TopItem {
  menu_item__id: number;
  menu_item__name: string;
  menu_item__category__section__station_type: string;
  total_qty: number;
  total_revenue: number;
}

export interface MonthlyData {
  month: string;
  bar: number;
  kitchen: number;
  hookah: number;
  tickets: number;
  total: number;
}

export interface ShiftDetail {
  shift_id: number;
  date: string;
  is_open: boolean;
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  by_category: { bar: number; kitchen: number; hookah: number; tickets: number };
  by_payment: { method: string; label: string; amount: number }[];
  summary: {
    total_revenue: number;
    orders_count: number;
    receipts_count: number;
    guests_count: number;
    avg_check: number;
    deleted_count: number;
    deleted_amount: number;
  };
  employees: { user_id: number; display_name: string; orders_count: number; revenue: number }[];
  top_items: { name: string; volume: string; type: string; qty: number; revenue: number }[];
}

export interface SalesReport {
  summary: {
    total_revenue: number;
    total_cogs: number;
    gross_profit: number;
    gross_margin: number;
    orders_count: number;
    receipts_count: number;
    guests_count: number;
    avg_check: number;
    deleted_count: number;
    deleted_amount: number;
  };
  by_category: { bar: number; kitchen: number; hookah: number; tickets: number };
  by_payment: { method: string; label: string; amount: number }[];
  top_items: { id: number; name: string; volume: string; type: string; qty: number; revenue: number; cost: number; profit: number }[];
  by_shift: { shift_id: number; date: string; is_open: boolean; revenue: number; orders_count: number; receipts_count: number }[];
}

export const PRODUCT_UNITS = ['мл', 'л', 'г', 'кг', 'шт', 'уп'] as const;
export type ProductUnit = typeof PRODUCT_UNITS[number];

export interface PurchaseOrderItem {
  id: number;
  order: number;
  product: number;
  product_name: string;
  product_unit: string;
  qty_ordered: number;
  qty_received: number;
  unit_price: number;
  subtotal: number;
}

export interface PurchaseOrder {
  id: number;
  status: 'draft' | 'ordered' | 'received';
  status_label: string;
  store: string;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  received_at: string | null;
  notes: string;
  total: number;
  items: PurchaseOrderItem[];
}

export type ReceiptImportStatus = 'wait' | 'process' | 'done' | 'error' | 'applied';

/** Строка чека магазина с подсказкой сопоставления товару склада. */
export interface ReceiptImportLine {
  name: string;
  quantity: number;
  price: number;
  sum: number;
  product: number | null;
  remember?: boolean;
}

export interface ReceiptImport {
  id: number;
  qr: string;
  hash: string;
  status: ReceiptImportStatus;
  status_label: string;
  error: string;
  store: string;
  total: number | null;
  purchased_at: string;
  purchase: number | null;
  created_at: string;
  lines?: ReceiptImportLine[];
}

export interface StockReportDiscrepancyRow {
  product_id: number;
  product_name: string;
  unit: string;
  quantity: number;
  value: number;
}

export interface StockReport {
  spent: number;          // потрачено (приходы по закупочной цене)
  cost_of_sales: number;  // прошло — себестоимость продаж
  writeoffs: number;      // ручные списания
  revenue: number;        // выручка по чекам
  profit: number;         // заработано
  discrepancy: number;    // расхождение по инвентаризации (минус = недостача)
  discrepancy_rows: StockReportDiscrepancyRow[];
}

export interface Modifier {
  id: number;
  group: number;
  name: string;
  price_delta: number;
  sort_order: number;
  is_active: boolean;
}

export interface ModifierGroup {
  id: number;
  name: string;
  is_required: boolean;
  max_selections: number;
  sort_order: number;
  is_active: boolean;
  modifiers: Modifier[];
}

export interface MenuItemModifierGroup {
  id: number;
  menu_item: number;
  modifier_group: number;
  modifier_group_name: string;
  is_required: boolean;
  /** Макс. число выбранных (0 = без лимита, 1 = одиночный выбор). */
  max_selections: number;
  modifiers: Modifier[];
  sort_order: number;
}

export interface Product {
  id: number;
  name: string;
  unit: ProductUnit;
  pack_size: number;
  purchase_price: number;
  stock_quantity: number;
  min_stock: number | null;
  is_low: boolean;
  is_active: boolean;
}

export type MovementReason = 'sale' | 'manual_in' | 'manual_out' | 'adjustment';

export interface InventoryMovement {
  id: number;
  product: number;
  product_name: string;
  product_unit: string;
  quantity: number;
  reason: MovementReason;
  order_item: number | null;
  shift: number | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
  note: string;
}

export interface MenuItemComponent {
  id: number;
  menu_item: number;
  product: number;
  product_name: string;
  product_unit: string;
  quantity: number;
}

export interface ConsumptionRow {
  product_id: number;
  product_name: string;
  unit: string;
  pack_size: number;
  purchase_price: number;
  stock_quantity: number;
  total_units: number;
  total_packs: number;
  packs_to_buy: number;
  total_cost: number;
}

export interface ForecastHour {
  hour: number;
  revenue: number;
  receipts: number;
}

export interface ForecastDay {
  date: string;
  weekday: number;
  weekday_name: string;
  samples: number;
  revenue: number;
  receipts_count: number;
  avg_check: number;
  by_category: { bar: number; kitchen: number; hookah: number; tickets: number };
  by_hour: ForecastHour[];
}

export interface DeletedOrderItem {
  id: number;
  deleted_at: string;
  deleted_by: number | null;
  deleted_by_name: string | null;
  order: number | null;
  shift: number | null;
  table_number: string;
  menu_item_name: string;
  menu_item_volume: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  kitchen_status: string;
}

export type PrinterConnection = 'network' | 'agent';

export interface ReceiptSettings {
  title: string;
  subtitle: string;
  footer: string;
  qr_data: string;
  qr_label: string;
  print_second_copy: boolean;
}

export interface Printer {
  id: number;
  name: string;
  station: '' | 'bar' | 'waiter';
  connection: PrinterConnection;
  host: string;
  port: number;
  agent_key: string;
  width: number;
  is_default: boolean;
  is_active: boolean;
}
