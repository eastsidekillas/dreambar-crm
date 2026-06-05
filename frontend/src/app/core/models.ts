export type Role = 'admin' | 'waiter' | 'bartender' | 'kitchen' | 'wardrobe';

export type KitchenStatus = 'new' | 'cooking' | 'ready';

export interface KitchenItem {
  id: number;
  name: string;
  volume: string;
  quantity: number;
  kitchen_status: KitchenStatus;
}

export interface KitchenTicket {
  order_id: number;
  table_number: string;
  waiter_name: string;
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
}

export interface Employee {
  id: number;
  username: string;
  display_name: string;
  role: Role;
  role_label: string;
  is_active: boolean;
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

export interface MenuCategory {
  id: number;
  name: string;
  type: 'bar' | 'kitchen' | 'hookah';
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
  sort_order: number;
  category: number;
  category_name: string;
  category_type: 'bar' | 'kitchen' | 'hookah';
}

export interface MenuByCategory {
  id: number;
  name: string;
  type: 'bar' | 'kitchen' | 'hookah';
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
  guest_no: number;          // 0 = общая позиция, 1..N — гость
  receipt: number | null;
}

export interface ReceiptItem {
  id: number;
  menu_item_name: string;
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
  issued_at: string;
  items: ReceiptItem[];
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
  items: OrderItem[];
  receipts: Receipt[];
  total: number;
  is_paid: boolean;
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
  menu_item__category__type: string;
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
