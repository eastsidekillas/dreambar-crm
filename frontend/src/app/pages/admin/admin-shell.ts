import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { filter } from 'rxjs/operators';

interface NavItem  { type: 'link';  path: string; label: string; icon: string; }
interface NavGroup { type: 'group'; label: string; icon: string; badge?: string; children: { path: string; label: string }[]; }
type NavEntry = NavItem | NavGroup;

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="min-h-screen" style="background:var(--color-bg)">
      <div class="flex">

        <!-- ── Desktop sidebar ──────────────────────────────────── -->
        <aside class="hidden md:flex flex-col w-56 min-h-screen sticky top-0 h-screen overflow-y-auto"
               style="background:white;border-right:1px solid var(--color-border)">

          <div class="px-5 py-5 flex items-center gap-2 flex-shrink-0"
               style="border-bottom:1px solid var(--color-border)">
            <div class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                 style="background:var(--color-gold)">
              <span class="text-sm">🍸</span>
            </div>
            <div>
              <p class="font-bold text-sm leading-none">BAR DREAM</p>
              <p class="text-xs" style="color:var(--color-muted)">Управление</p>
            </div>
          </div>

          <nav class="flex-1 px-3 py-4 space-y-0.5">
            @for (entry of nav; track entry.label) {

              <!-- Simple link -->
              @if (entry.type === 'link') {
                <a [routerLink]="entry.path" routerLinkActive #rla="routerLinkActive"
                   class="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                   [style.background]="rla.isActive ? 'var(--color-gold-light)' : 'transparent'"
                   [style.color]="rla.isActive ? 'var(--color-gold-hover)' : 'var(--color-muted)'"
                   style="text-decoration:none">
                  <span class="text-base flex-shrink-0">{{ entry.icon }}</span>
                  {{ entry.label }}
                </a>
              }

              <!-- Expandable group -->
              @if (entry.type === 'group') {
                <div>
                  <!-- Group header -->
                  <button (click)="toggle(entry.label)"
                    class="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                    [style.background]="isGroupActive(entry) ? 'var(--color-gold-light)' : 'transparent'"
                    [style.color]="isGroupActive(entry) ? 'var(--color-gold-hover)' : 'var(--color-muted)'"
                    style="border:none;cursor:pointer;text-align:left">
                    <span class="text-base flex-shrink-0">{{ entry.icon }}</span>
                    <span class="flex-1">{{ entry.label }}</span>
                    @if (entry.badge) {
                      <span class="text-xs font-semibold px-1.5 py-0.5 rounded"
                            style="background:var(--color-gold);color:#000;font-size:9px">
                        {{ entry.badge }}
                      </span>
                    }
                    <span class="text-xs ml-1 transition-transform"
                          [style.transform]="expanded().has(entry.label) ? 'rotate(90deg)' : 'rotate(0deg)'">
                      ›
                    </span>
                  </button>

                  <!-- Children -->
                  @if (expanded().has(entry.label)) {
                    <div class="ml-6 mt-0.5 space-y-0.5">
                      @for (child of entry.children; track child.path) {
                        <a [routerLink]="child.path" routerLinkActive #crla="routerLinkActive"
                           class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-all"
                           [style.background]="crla.isActive ? 'var(--color-gold-light)' : 'transparent'"
                           [style.color]="crla.isActive ? 'var(--color-gold-hover)' : 'var(--color-muted)'"
                           style="text-decoration:none">
                          <span style="width:4px;height:4px;border-radius:50%;background:currentColor;flex-shrink:0"></span>
                          {{ child.label }}
                        </a>
                      }
                    </div>
                  }
                </div>
              }

            }
          </nav>

          <div class="px-3 py-4 flex-shrink-0" style="border-top:1px solid var(--color-border)">
            <a routerLink="/kitchen"
               class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full mb-1"
               style="color:var(--color-muted);text-decoration:none">🍳 Экран кухни</a>
            <a routerLink="/waiter"
               class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full mb-1"
               style="color:var(--color-muted);text-decoration:none">📱 Режим официанта</a>
            <button (click)="logout()"
                    class="flex items-center gap-2 px-3 py-2 rounded-lg text-sm w-full"
                    style="color:var(--color-red);background:none;border:none;cursor:pointer">
              🚪 Выйти
            </button>
          </div>
        </aside>

        <!-- ── Main content ─────────────────────────────────────── -->
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

          <!-- Mobile bottom nav (flat: groups → first child) -->
          <nav class="md:hidden fixed bottom-0 left-0 right-0 z-40 flex safe-bottom"
               style="background:white;border-top:1px solid var(--color-border);box-shadow:0 -2px 8px rgba(0,0,0,0.06)">
            @for (item of mobileNav; track item.path) {
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
  `,
})
export class AdminShell {
  expanded = signal<Set<string>>(new Set(['Аналитика']));

  nav: NavEntry[] = [
    { type: 'link', path: '/admin/dashboard', label: 'Дашборд',    icon: '📊' },
    {
      type: 'group',
      label: 'Смены',
      icon: '📅',
      children: [
        { path: '/admin/shifts/active',   label: 'Активные смены' },
        { path: '/admin/shifts/day',      label: 'Итоги дня' },
        { path: '/admin/shifts/receipts', label: 'Детали по чекам' },
      ],
    },
    {
      type: 'group',
      label: 'Аналитика',
      icon: '📈',
      children: [
        { path: '/admin/reports',  label: 'Отчёты' },
        { path: '/admin/forecast', label: 'Прогноз' },
      ],
    },
    {
      type: 'group',
      label: 'Склад',
      icon: '📦',
      children: [
        { path: '/admin/inventory', label: 'Продукты' },
        { path: '/admin/purchases', label: 'Закупки' },
      ],
    },
    {
      type: 'group',
      label: 'Меню',
      icon: '🍽',
      children: [
        { path: '/admin/menu',      label: 'Позиции меню' },
        { path: '/admin/modifiers', label: 'Модификаторы' },
      ],
    },
    { type: 'link', path: '/admin/reservations', label: 'Бронирования', icon: '📅' },
    { type: 'link', path: '/admin/employees',   label: 'Сотрудники',   icon: '👥' },
    { type: 'link', path: '/admin/audit',        label: 'Аудит',        icon: '🗑' },
    {
      type: 'group',
      label: 'Настройки',
      icon: '⚙️',
      children: [
        { path: '/admin/printers', label: 'Принтеры' },
      ],
    },
  ];

  mobileNav = [
    { path: '/admin/dashboard',     label: 'Дашборд', icon: '📊' },
    { path: '/admin/shifts/active', label: 'Смены',   icon: '📅' },
    { path: '/admin/inventory',     label: 'Склад',   icon: '📦' },
    { path: '/admin/reports',       label: 'Отчёты',  icon: '📈' },
    { path: '/admin/menu',          label: 'Меню',    icon: '🍽' },
  ];

  constructor(private auth: AuthService, private router: Router) {
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects ?? e.url ?? '';
      if (url.includes('/admin/shifts')) {
        const s = new Set(this.expanded()); s.add('Смены'); this.expanded.set(s);
      }
      if (url.includes('/admin/inventory') || url.includes('/admin/purchases')) {
        const s = new Set(this.expanded()); s.add('Склад'); this.expanded.set(s);
      }
      if (url.includes('/admin/menu') || url.includes('/admin/modifiers')) {
        const s = new Set(this.expanded()); s.add('Меню'); this.expanded.set(s);
      }
      if (url.includes('/admin/reports') || url.includes('/admin/forecast')) {
        const s = new Set(this.expanded());
        s.add('Аналитика');
        this.expanded.set(s);
      }
      if (url.includes('/admin/printers')) {
        const s = new Set(this.expanded());
        s.add('Настройки');
        this.expanded.set(s);
      }
    });
  }

  toggle(label: string) {
    const s = new Set(this.expanded());
    s.has(label) ? s.delete(label) : s.add(label);
    this.expanded.set(s);
  }

  isGroupActive(entry: NavGroup): boolean {
    return entry.children.some(c => this.router.isActive(c.path, { paths: 'subset', queryParams: 'ignored', fragment: 'ignored', matrixParams: 'ignored' }));
  }

  logout() { this.auth.logout(); }
}
