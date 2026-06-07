import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'waiter', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },

  {
    path: 'pin',
    loadComponent: () => import('./pages/pin/pin-login.page').then(m => m.PinLoginPage)
  },

  {
    path: 'role-select',
    loadComponent: () => import('./pages/role-select/role-select.page').then(m => m.RoleSelectPage),
    canActivate: [authGuard],
  },

  // ── Waiter (mobile-first) ────────────────────────────────────────
  {
    path: 'waiter',
    loadComponent: () => import('./pages/waiter/waiter-shell').then(m => m.WaiterShell),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'tables', pathMatch: 'full' },
      {
        path: 'order',
        loadComponent: () => import('./pages/waiter/order/order.page').then(m => m.OrderPage)
      },
      {
        path: 'tables',
        loadComponent: () => import('./pages/waiter/tables/tables.page').then(m => m.TablesPage)
      },
      {
        path: 'tickets',
        loadComponent: () => import('./pages/waiter/tickets/tickets.page').then(m => m.TicketsPage)
      },
      {
        path: 'history',
        loadComponent: () => import('./pages/waiter/history/history.page').then(m => m.HistoryPage)
      },
    ]
  },

  // ── Kitchen (KDS) ────────────────────────────────────────────────
  {
    path: 'kitchen',
    loadComponent: () => import('./pages/kitchen/kitchen.page').then(m => m.KitchenScreen),
    canActivate: [authGuard],
  },

  // ── Bartender ────────────────────────────────────────────────────
  {
    path: 'bartender',
    loadComponent: () => import('./pages/bartender/bartender.page').then(m => m.BartenderPage),
    canActivate: [authGuard],
  },

  // ── Admin ────────────────────────────────────────────────────────
  {
    path: 'admin',
    loadComponent: () => import('./pages/admin/admin-shell').then(m => m.AdminShell),
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () => import('./pages/admin/dashboard/dashboard.page').then(m => m.DashboardComponent)
      },
      {
        path: 'employees',
        loadComponent: () => import('./pages/admin/employees/employees.page').then(m => m.EmployeesComponent)
      },
      {
        path: 'shifts',
        loadComponent: () => import('./pages/admin/shifts/shifts-shell').then(m => m.ShiftsShell),
        children: [
          { path: '', redirectTo: 'active', pathMatch: 'full' },
          {
            path: 'active',
            loadComponent: () => import('./pages/admin/shifts/shifts-active.page').then(m => m.ShiftsActivePage)
          },
          {
            path: 'day',
            loadComponent: () => import('./pages/admin/shifts/shifts-day.page').then(m => m.ShiftsDayPage)
          },
          {
            path: 'receipts',
            loadComponent: () => import('./pages/admin/shifts/shifts-receipts.page').then(m => m.ShiftsReceiptsPage)
          },
        ]
      },
      {
        path: 'menu',
        loadComponent: () => import('./pages/admin/menu/menu.page').then(m => m.MenuManagementComponent)
      },
      {
        path: 'export',
        loadComponent: () => import('./pages/admin/export/export.page').then(m => m.ExportComponent)
      },
      {
        path: 'printers',
        loadComponent: () => import('./pages/admin/printers/printers.page').then(m => m.PrintersPage)
      },
      {
        path: 'reports',
        loadComponent: () => import('./pages/admin/reports/reports.page').then(m => m.ReportsComponent)
      },
      {
        path: 'forecast',
        loadComponent: () => import('./pages/admin/forecast/forecast.page').then(m => m.ForecastPage)
      },
      {
        path: 'inventory',
        loadComponent: () => import('./pages/admin/inventory/inventory.page').then(m => m.InventoryPage)
      },
      {
        path: 'purchases',
        loadComponent: () => import('./pages/admin/purchases/purchases.page').then(m => m.PurchasesPage)
      },
      {
        path: 'modifiers',
        loadComponent: () => import('./pages/admin/modifiers/modifiers.page').then(m => m.ModifiersPage)
      },
    ]
  },

  { path: '**', redirectTo: 'waiter' }
];
