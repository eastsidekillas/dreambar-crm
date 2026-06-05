import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'waiter', pathMatch: 'full' },

  {
    path: 'login',
    loadComponent: () => import('./pages/login/login.page').then(m => m.LoginPage)
  },

  // ── Waiter (mobile-first) ────────────────────────────────────────
  {
    path: 'waiter',
    loadComponent: () => import('./pages/waiter/waiter-shell').then(m => m.WaiterShell),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'order', pathMatch: 'full' },
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
        loadComponent: () => import('./pages/admin/shifts/shifts.page').then(m => m.ShiftsComponent)
      },
      {
        path: 'menu',
        loadComponent: () => import('./pages/admin/menu/menu.page').then(m => m.MenuManagementComponent)
      },
      {
        path: 'export',
        loadComponent: () => import('./pages/admin/export/export.page').then(m => m.ExportComponent)
      },
    ]
  },

  { path: '**', redirectTo: 'waiter' }
];
