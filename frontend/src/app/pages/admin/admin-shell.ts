import type { LucideIconInput } from '@lucide/angular';
import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { Shift } from '../../core/models';
import { filter } from 'rxjs/operators';
import {
  LucideDynamicIcon,
  LucideLayoutDashboard, LucideCalendar, LucideTrendingUp, LucidePackage,
  LucideUtensilsCrossed, LucideMap, LucideUsers, LucideTrash2, LucideSettings,
  LucideChefHat, LucideSmartphone, LucideLogOut, LucideGlassWater,
} from '@lucide/angular';

interface NavItem  { type: 'link';  path: string; label: string; icon: LucideIconInput; desc?: string; }
interface NavGroup { type: 'group'; label: string; icon: LucideIconInput; badge?: string; desc?: string;
                     children: { path: string; label: string; desc?: string }[]; }
type NavEntry = NavItem | NavGroup;

/** Заголовок и описание раздела для шапки (поиск по самому длинному префиксу). */
const PAGE_META: { prefix: string; title: string; desc: string }[] = [
  { prefix: '/admin/dashboard',      title: 'Дашборд',         desc: 'Сводка: выручка, текущая смена, топ продаж' },
  { prefix: '/admin/shifts/active',  title: 'Активные смены',  desc: 'Открытие и закрытие смены, выручка в реальном времени' },
  { prefix: '/admin/shifts/day',     title: 'Итоги дня',       desc: 'Показатели и выручка по каждому дню' },
  { prefix: '/admin/shifts/receipts',title: 'Детали по чекам', desc: 'Все чеки смены с позициями и способами оплаты' },
  { prefix: '/admin/shifts',         title: 'Смены',           desc: 'Управление сменами' },
  { prefix: '/admin/reports',        title: 'Отчёты',          desc: 'Продажи по категориям, позициям и способам оплаты' },
  { prefix: '/admin/forecast',       title: 'Прогноз',         desc: 'Ожидаемая выручка на основе прошлых смен' },
  { prefix: '/admin/export',         title: 'Экспорт в Excel', desc: 'Сводные отчёты и отчёты по сменам в формате .xlsx' },
  { prefix: '/admin/inventory',      title: 'Склад · Продукты',desc: 'Остатки, рецептуры и движения по складу' },
  { prefix: '/admin/purchases',      title: 'Закупки',         desc: 'Приход товара на склад' },
  { prefix: '/admin/menu',           title: 'Меню',            desc: 'Позиции, цены, станции приготовления' },
  { prefix: '/admin/modifiers',      title: 'Модификаторы',    desc: 'Добавки и опции к позициям меню' },
  { prefix: '/admin/reservations',   title: 'Бронирования',    desc: 'Брони столов и депозиты гостей' },
  { prefix: '/admin/tables',         title: 'Столы',           desc: 'Схема зала: столы и зоны' },
  { prefix: '/admin/employees',      title: 'Сотрудники',      desc: 'Роли, PIN-коды и права доступа' },
  { prefix: '/admin/audit',          title: 'Аудит',           desc: 'Журнал удалённых позиций заказов' },
  { prefix: '/admin/printers',       title: 'Принтеры',        desc: 'Чековые принтеры и настройка печати' },
];

const ROLE_LABEL: Record<string, string> = {
  admin: 'Администратор', waiter: 'Официант', bartender: 'Бармен',
  kitchen: 'Кухня', wardrobe: 'Гардероб',
};

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, LucideDynamicIcon,
    LucideChefHat, LucideSmartphone, LucideLogOut, LucideGlassWater],
  styles: [`
    .nav-link {
      display: flex; align-items: center; gap: 10px;
      padding: 9px 12px; border-radius: 10px;
      font-size: 0.875rem; font-weight: 500;
      color: var(--color-muted); text-decoration: none;
      position: relative; transition: background .15s, color .15s;
      border: none; background: transparent; cursor: pointer;
      width: 100%; text-align: left;
    }
    .nav-link:hover { background: var(--color-surface2); color: var(--color-text); }
    .nav-link.active { background: var(--color-gold-light); color: var(--color-gold-hover); }
    .nav-link.active::before {
      content: ''; position: absolute; left: -12px; top: 8px; bottom: 8px;
      width: 3px; border-radius: 0 3px 3px 0; background: var(--color-gold);
    }
    .nav-child {
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px; border-radius: 8px; font-size: 0.85rem;
      color: var(--color-muted); text-decoration: none;
      transition: background .15s, color .15s;
    }
    .nav-child:hover { background: var(--color-surface2); color: var(--color-text); }
    .nav-child.active { background: var(--color-gold-light); color: var(--color-gold-hover); font-weight: 600; }

    .shift-chip {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 7px 14px; border-radius: 999px;
      font-size: 0.8rem; font-weight: 600; text-decoration: none;
      border: 1.5px solid var(--color-border-mid); color: var(--color-muted);
      background: var(--color-surface2); white-space: nowrap;
      transition: box-shadow .15s, transform .15s;
    }
    .shift-chip:hover { box-shadow: 0 2px 8px rgba(0,0,0,.08); transform: translateY(-1px); }
    .shift-chip.open { border-color: #86efac; background: #f0fdf4; color: #166534; }
    .shift-chip .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--color-light); flex-shrink: 0; }
    .shift-chip.open .dot { background: #22c55e; animation: pulse 1.6s ease-in-out infinite; }
    @keyframes pulse { 50% { opacity: .35; } }

    .avatar {
      width: 34px; height: 34px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, var(--color-gold), var(--color-gold-hover));
      color: #fff; font-weight: 700; font-size: 0.9rem; flex-shrink: 0;
    }
    .icon-btn {
      display: flex; align-items: center; justify-content: center;
      width: 34px; height: 34px; border-radius: 10px;
      border: none; background: transparent; cursor: pointer;
      color: var(--color-muted); transition: background .15s, color .15s;
    }
    .icon-btn:hover { background: var(--color-red-bg); color: var(--color-red); }
  `],
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
              <svg lucideGlassWater [size]="18" style="color:white"></svg>
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
                <a [routerLink]="entry.path" routerLinkActive="active"
                   class="nav-link" [title]="entry.desc || entry.label">
                  <svg [lucideIcon]="entry.icon" [size]="16" class="flex-shrink-0"></svg>
                  {{ entry.label }}
                </a>
              }

              <!-- Expandable group -->
              @if (entry.type === 'group') {
                <div>
                  <button (click)="toggle(entry.label)"
                          class="nav-link" [class.active]="isGroupActive(entry)"
                          [title]="entry.desc || entry.label">
                    <svg [lucideIcon]="entry.icon" [size]="16" class="flex-shrink-0"></svg>
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

                  @if (expanded().has(entry.label)) {
                    <div class="ml-6 mt-0.5 space-y-0.5">
                      @for (child of entry.children; track child.path) {
                        <a [routerLink]="child.path" routerLinkActive="active"
                           class="nav-child" [title]="child.desc || child.label">
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
            <a routerLink="/kitchen" class="nav-link" title="Перейти на экран кухни (заказы для поваров)">
              <svg lucideChefHat [size]="16"></svg> Экран кухни</a>
            <a routerLink="/waiter" class="nav-link" title="Перейти в интерфейс официанта (столы и заказы)">
              <svg lucideSmartphone [size]="16"></svg> Режим официанта</a>
            <button (click)="logout()" class="nav-link" style="color:var(--color-red)"
                    title="Выйти из аккаунта">
              <svg lucideLogOut [size]="16"></svg> Выйти
            </button>
          </div>
        </aside>

        <!-- ── Main content ─────────────────────────────────────── -->
        <div class="flex-1 min-h-screen flex flex-col min-w-0">

          <!-- Desktop header -->
          <header class="hidden md:flex sticky top-0 z-30 items-center gap-4 px-6 flex-shrink-0"
                  style="background:rgba(255,255,255,.92);backdrop-filter:blur(8px);
                         border-bottom:1px solid var(--color-border);height:64px">
            <div class="flex-1 min-w-0">
              <h1 class="text-base font-bold leading-tight truncate">{{ pageTitle() }}</h1>
              <p class="text-xs truncate" style="color:var(--color-muted)">{{ pageDesc() }}</p>
            </div>

            <a routerLink="/admin/shifts/active" class="shift-chip" [class.open]="!!shift()"
               [title]="shift() ? 'Открыть управление текущей сменой' : 'Перейти к открытию смены'">
              <span class="dot"></span>
              @if (shift()) {
                Смена открыта · {{ shiftDate() }}
              } @else {
                Смена закрыта
              }
            </a>

            <div class="flex items-center gap-2.5 pl-4" style="border-left:1px solid var(--color-border)">
              <div class="avatar">{{ userInitial() }}</div>
              <div class="leading-tight">
                <p class="text-sm font-semibold leading-none">{{ userName() }}</p>
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ userRole() }}</p>
              </div>
              <button (click)="logout()" class="icon-btn" title="Выйти из аккаунта">
                <svg lucideLogOut [size]="16"></svg>
              </button>
            </div>
          </header>

          <!-- Mobile header -->
          <header class="md:hidden sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
                  style="background:white;border-bottom:1px solid var(--color-border);box-shadow:0 1px 4px rgba(0,0,0,0.06)">
            <div class="flex items-center gap-2 min-w-0">
              <svg lucideGlassWater [size]="18" class="flex-shrink-0"></svg>
              <span class="font-bold text-sm truncate">{{ pageTitle() }}</span>
              @if (shift()) {
                <span class="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Смена открыта"></span>
              }
            </div>
            <button (click)="logout()" class="text-sm flex-shrink-0" style="color:var(--color-muted)">Выйти</button>
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
                <svg [lucideIcon]="item.icon" [size]="20"></svg>
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
  shift    = signal<Shift | null>(null);

  private url = signal<string>('');
  private pageMeta = computed(() => {
    const u = this.url();
    let best: { prefix: string; title: string; desc: string } | null = null;
    for (const m of PAGE_META) {
      if (u.startsWith(m.prefix) && (!best || m.prefix.length > best.prefix.length)) best = m;
    }
    return best ?? { prefix: '', title: 'Управление', desc: 'BAR DREAM' };
  });
  pageTitle = computed(() => this.pageMeta().title);
  pageDesc  = computed(() => this.pageMeta().desc);

  nav: NavEntry[] = [
    { type: 'link', path: '/admin/dashboard', label: 'Дашборд', icon: LucideLayoutDashboard,
      desc: 'Сводка: выручка, смена, топ продаж' },
    {
      type: 'group',
      label: 'Смены',
      icon: LucideCalendar,
      desc: 'Открытие смен, итоги дня и чеки',
      children: [
        { path: '/admin/shifts/active',   label: 'Активные смены',  desc: 'Открыть или закрыть смену' },
        { path: '/admin/shifts/day',      label: 'Итоги дня',       desc: 'Выручка по дням' },
        { path: '/admin/shifts/receipts', label: 'Детали по чекам', desc: 'Все чеки с позициями' },
      ],
    },
    {
      type: 'group',
      label: 'Аналитика',
      icon: LucideTrendingUp,
      desc: 'Отчёты, прогноз и экспорт',
      children: [
        { path: '/admin/reports',  label: 'Отчёты',          desc: 'Продажи по категориям и позициям' },
        { path: '/admin/forecast', label: 'Прогноз',         desc: 'Ожидаемая выручка' },
        { path: '/admin/export',   label: 'Экспорт в Excel', desc: 'Скачать отчёты в .xlsx' },
      ],
    },
    {
      type: 'group',
      label: 'Склад',
      icon: LucidePackage,
      desc: 'Остатки и закупки',
      children: [
        { path: '/admin/inventory', label: 'Продукты', desc: 'Остатки и рецептуры' },
        { path: '/admin/purchases', label: 'Закупки',  desc: 'Приход товара' },
      ],
    },
    {
      type: 'group',
      label: 'Меню',
      icon: LucideUtensilsCrossed,
      desc: 'Позиции и модификаторы',
      children: [
        { path: '/admin/menu',      label: 'Позиции меню', desc: 'Цены и станции приготовления' },
        { path: '/admin/modifiers', label: 'Модификаторы', desc: 'Добавки к позициям' },
      ],
    },
    { type: 'link', path: '/admin/reservations', label: 'Бронирования', icon: LucideCalendar,
      desc: 'Брони столов и депозиты' },
    { type: 'link', path: '/admin/tables',       label: 'Столы',        icon: LucideMap,
      desc: 'Схема зала' },
    { type: 'link', path: '/admin/employees',    label: 'Сотрудники',   icon: LucideUsers,
      desc: 'Роли и PIN-коды' },
    { type: 'link', path: '/admin/audit',        label: 'Аудит',        icon: LucideTrash2,
      desc: 'Журнал удалённых позиций' },
    {
      type: 'group',
      label: 'Настройки',
      icon: LucideSettings,
      desc: 'Оборудование и система',
      children: [
        { path: '/admin/printers', label: 'Принтеры', desc: 'Чековые принтеры' },
      ],
    },
  ];

  mobileNav = [
    { path: '/admin/dashboard',     label: 'Дашборд', icon: LucideLayoutDashboard },
    { path: '/admin/shifts/active', label: 'Смены',   icon: LucideCalendar },
    { path: '/admin/inventory',     label: 'Склад',   icon: LucidePackage },
    { path: '/admin/reports',       label: 'Отчёты',  icon: LucideTrendingUp },
    { path: '/admin/menu',          label: 'Меню',    icon: LucideUtensilsCrossed },
  ];

  constructor(private auth: AuthService, private router: Router, private api: ApiService) {
    this.url.set(this.router.url);
    this.loadShift();

    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url: string = e.urlAfterRedirects ?? e.url ?? '';
      this.url.set(url);
      this.loadShift();
      const expand = (label: string) => {
        const s = new Set(this.expanded()); s.add(label); this.expanded.set(s);
      };
      if (url.includes('/admin/shifts')) expand('Смены');
      if (url.includes('/admin/inventory') || url.includes('/admin/purchases')) expand('Склад');
      if (url.includes('/admin/menu') || url.includes('/admin/modifiers')) expand('Меню');
      if (url.includes('/admin/reports') || url.includes('/admin/forecast') || url.includes('/admin/export')) expand('Аналитика');
      if (url.includes('/admin/printers')) expand('Настройки');
    });
  }

  private loadShift() {
    this.api.getCurrentShift().subscribe({
      next: s => this.shift.set(s),
      error: () => this.shift.set(null),
    });
  }

  shiftDate(): string {
    const s = this.shift();
    return s ? new Date(s.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' }) : '';
  }

  userName(): string {
    const u = this.auth.user();
    return u?.display_name || u?.first_name || u?.username || '—';
  }
  userInitial(): string { return (this.userName()[0] || '?').toUpperCase(); }
  userRole(): string {
    return ROLE_LABEL[this.auth.role() ?? ''] ?? 'Администратор';
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