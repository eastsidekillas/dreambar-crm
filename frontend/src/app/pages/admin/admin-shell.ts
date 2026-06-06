import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="min-h-screen" style="background:var(--color-bg)">
      <div class="flex">

        <!-- Sidebar — desktop -->
        <aside class="hidden md:flex flex-col w-56 min-h-screen sticky top-0 h-screen"
               style="background:white;border-right:1px solid var(--color-border)">
          <!-- Logo -->
          <div class="px-5 py-5 flex items-center gap-2" style="border-bottom:1px solid var(--color-border)">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center" style="background:var(--color-gold)">
              <span class="text-sm">🍸</span>
            </div>
            <div>
              <p class="font-bold text-sm leading-none">BAR DREAM</p>
              <p class="text-xs" style="color:var(--color-muted)">Управление</p>
            </div>
          </div>

          <!-- Nav -->
          <nav class="flex-1 px-3 py-4 space-y-1">
            @for (item of navItems; track item.path) {
              <a [routerLink]="item.path" routerLinkActive #rla="routerLinkActive"
                 class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                 [style.background]="rla.isActive ? 'var(--color-gold-light)' : 'transparent'"
                 [style.color]="rla.isActive ? 'var(--color-gold-hover)' : 'var(--color-muted)'"
                 style="text-decoration:none">
                <span class="text-base">{{ item.icon }}</span>
                {{ item.label }}
              </a>
            }
          </nav>

          <!-- Footer -->
          <div class="px-3 py-4" style="border-top:1px solid var(--color-border)">
            <a routerLink="/kitchen"
               class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full mb-1"
               style="color:var(--color-muted);text-decoration:none">
              🍳 Экран кухни
            </a>
            <a routerLink="/waiter"
               class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full mb-1"
               style="color:var(--color-muted);text-decoration:none">
              📱 Режим официанта
            </a>
            <button (click)="logout()"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full"
                    style="color:var(--color-red);background:none;border:none;cursor:pointer">
              🚪 Выйти
            </button>
          </div>
        </aside>

        <!-- Main -->
        <div class="flex-1 min-h-screen flex flex-col">

          <!-- Mobile header -->
          <header class="md:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
                  style="background:white;border-bottom:1px solid var(--color-border);box-shadow:0 1px 4px rgba(0,0,0,0.06)">
            <div class="flex items-center gap-2">
              <span>🍸</span>
              <span class="font-bold text-sm">BAR DREAM — Управление</span>
            </div>
            <button (click)="logout()" class="text-sm" style="color:var(--color-muted)">Выйти</button>
          </header>

          <!-- Mobile bottom nav -->
          <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 flex safe-bottom"
               style="background:white;border-top:1px solid var(--color-border);box-shadow:0 -2px 8px rgba(0,0,0,0.06)">
            @for (item of navItems; track item.path) {
              <a [routerLink]="item.path" routerLinkActive #rla="routerLinkActive"
                 class="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 min-h-[56px]"
                 [style.color]="rla.isActive ? 'var(--color-gold)' : 'var(--color-muted)'"
                 [style.border-top]="rla.isActive ? '2px solid var(--color-gold)' : '2px solid transparent'"
                 style="text-decoration:none">
                <span class="text-xl leading-none">{{ item.icon }}</span>
                <span class="text-xs font-medium">{{ item.label }}</span>
              </a>
            }
          </nav>

          <main class="flex-1 p-4 md:p-6 pb-20 md:pb-8">
            <router-outlet />
          </main>
        </div>
      </div>
    </div>
  `
})
export class AdminShell {
  navItems = [
    { path: '/admin/dashboard', label: 'Дашборд',    icon: '📊' },
    { path: '/admin/employees', label: 'Сотрудники', icon: '👥' },
    { path: '/admin/shifts',    label: 'Смены',      icon: '📅' },
    { path: '/admin/menu',      label: 'Меню',       icon: '🍽' },
    { path: '/admin/printers',  label: 'Принтеры',   icon: '🖨' },
    { path: '/admin/export',    label: 'Экспорт',    icon: '📥' },
  ];
  constructor(private auth: AuthService) {}
  logout() { this.auth.logout(); }
}
