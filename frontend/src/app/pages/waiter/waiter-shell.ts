import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed, inject, viewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { Perm } from '../../shared/lib/permissions';
import { ShiftApi } from '../../entities/shift';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Shift } from '../../core/models';
import { ROLE_LABEL } from '../../shared/lib/roles';
import {
  LucideDynamicIcon,
  LucideUtensilsCrossed, LucideTicket, LucideReceipt,
  LucideSettings, LucideCircleUserRound,
  LucideArrowUpDown, LucideEllipsis, LucideCheck, LucideBan,
} from '@lucide/angular';
import { WaiterViewService, WaiterSort } from './waiter-view.service';
import { RefreshService } from '../../core/services/refresh.service';
import { BdBottomSheetComponent, PullToRefreshDirective } from '../../shared/ui';

interface Tab { path: string; label: string; icon: LucideIconInput; }

@Component({
  selector: 'app-waiter-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, LucideDynamicIcon,
    LucideArrowUpDown, LucideEllipsis, LucideCheck, LucideBan, LucideSettings,
    BdBottomSheetComponent, PullToRefreshDirective],
  template: `
    <div class="flex flex-col" style="height:100dvh;background:var(--color-bg)">

      <!-- ── Header (на экране стола скрыт — у него своя шапка) ── -->
      @if (!onOrderDetail()) {
      <header class="flex-shrink-0 z-40 px-3 flex items-center gap-2"
              style="min-height:54px;padding-top:env(safe-area-inset-top,0px);background:var(--color-bg)">

        <!-- Иконка сотрудника: круг с буквой имени → профиль -->
        <a routerLink="/waiter/profile" title="Профиль: мои показатели, PIN, выход"
           class="flex-shrink-0 relative" style="text-decoration:none">
          <span class="flex items-center justify-center rounded-full text-sm font-bold"
                style="width:38px;height:38px;background:linear-gradient(135deg,var(--color-gold),var(--color-gold-hover));color:white">
            {{ initial() }}
          </span>
          @if (shift()) {
            <span class="absolute bottom-0 right-0 rounded-full"
                  style="width:11px;height:11px;background:var(--color-green);border:2px solid var(--color-bg)"></span>
          }
        </a>

        @if (onTablesRoute()) {
          <div class="flex-1"></div>
          <!-- Переключатель Мои / Все (по центру) -->
          <div class="flex rounded-full" style="padding:3px;background:var(--color-surface2);border:1px solid var(--color-border)">
            <button (click)="view.filter.set('mine')"
                    class="rounded-full text-sm font-semibold" style="padding:4px 14px"
                    [style.background]="view.filter() === 'mine' ? 'white' : 'transparent'"
                    [style.color]="view.filter() === 'mine' ? 'var(--color-text)' : 'var(--color-muted)'"
                    [style.box-shadow]="view.filter() === 'mine' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'">Мои</button>
            <button (click)="view.filter.set('all')"
                    class="rounded-full text-sm font-semibold" style="padding:4px 14px"
                    [style.background]="view.filter() === 'all' ? 'white' : 'transparent'"
                    [style.color]="view.filter() === 'all' ? 'var(--color-text)' : 'var(--color-muted)'"
                    [style.box-shadow]="view.filter() === 'all' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'">Все</button>
            <button (click)="view.filter.set('reservations')"
                    class="rounded-full text-sm font-semibold" style="padding:4px 14px"
                    [style.background]="view.filter() === 'reservations' ? 'white' : 'transparent'"
                    [style.color]="view.filter() === 'reservations' ? 'var(--color-text)' : 'var(--color-muted)'"
                    [style.box-shadow]="view.filter() === 'reservations' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none'">Брони</button>
          </div>

          <div class="flex-1"></div>

          <!-- Сортировка → нижняя шторка -->
          <button (click)="view.sortSheetOpen.set(true)" title="Сортировка"
                  class="flex-shrink-0 flex items-center justify-center rounded-xl"
                  style="width:38px;height:38px;background:var(--color-surface2);border:1px solid var(--color-border);color:var(--color-text)">
            <svg lucideArrowUpDown [size]="18"></svg>
          </button>
          <!-- Ещё → меню: стоп-лист, настройки -->
          <button (click)="moreOpen.set(true)" title="Ещё"
                  class="flex-shrink-0 flex items-center justify-center rounded-xl"
                  style="width:38px;height:38px;background:var(--color-surface2);border:1px solid var(--color-border);color:var(--color-text)">
            <svg lucideEllipsis [size]="18"></svg>
          </button>
        } @else {
          @if (headerBack()) {
            <button (click)="goTables()"
                    class="flex items-center gap-0.5 text-sm font-bold pl-1.5 pr-2.5 py-1 rounded-lg"
                    style="color:var(--color-gold-hover);background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
              <span style="font-size:1.1rem;line-height:1">‹</span> Столы
            </button>
          }
          <div class="flex-1"></div>
          @if (canOpenShift() && !shift()) {
            <button (click)="openShift()" class="btn btn-primary btn-sm">Открыть смену</button>
          }
        }
      </header>
      }

      <!-- ── Content ─────────────────────────────────── -->
      <main #scrollMain class="flex-1 min-h-0 overflow-y-auto p-3"
            [bdPullToRefresh]="refresh.loading()" (refresh)="refresh.trigger()"
            [style.padding-bottom]="showNav() ? '80px' : 'env(safe-area-inset-bottom)'">
        <router-outlet />
      </main>

      <!-- ── Bottom nav (только роли с >2 разделами: гардероб/админ) ── -->
      @if (showNav()) {
      <nav class="fixed bottom-0 left-0 right-0 z-40 safe-bottom flex"
           style="background:var(--color-surface);border-top:1px solid var(--color-border);box-shadow:0 -2px 12px rgba(0,0,0,0.06)">
        @for (tab of tabs(); track tab.path) {
          <a [routerLink]="tab.path" routerLinkActive #rla="routerLinkActive"
             class="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px] transition-colors"
             [style.color]="rla.isActive ? 'var(--color-gold)' : 'var(--color-muted)'"
             [style.border-top]="rla.isActive ? '2px solid var(--color-gold)' : '2px solid transparent'"
             style="text-decoration:none">
            <svg [lucideIcon]="tab.icon" [size]="20"></svg>
            <span class="text-xs font-medium">{{ tab.label }}</span>
          </a>
        }
      </nav>
      }

      <!-- ── Меню «Ещё»: стоп-лист, настройки ─────────── -->
      @if (moreOpen()) {
        <bd-bottom-sheet title="Ещё" (closed)="moreOpen.set(false)">
          <div class="pb-2">
            <button (click)="goMore('/waiter/stop-list')"
                    class="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
                    style="border-top:1px solid var(--color-border)">
              <svg lucideBan [size]="18" style="color:var(--color-red)"></svg> Стоп-лист
            </button>
            <button (click)="goMore('/waiter/settings')"
                    class="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
                    style="border-top:1px solid var(--color-border)">
              <svg lucideSettings [size]="18" style="color:var(--color-muted)"></svg> Настройки
            </button>
          </div>
        </bd-bottom-sheet>
      }

      <!-- ── Шторка сортировки ────────────────────────── -->
      @if (view.sortSheetOpen()) {
        <bd-bottom-sheet title="Сортировка" (closed)="view.sortSheetOpen.set(false)">
          <div class="pb-2">
            @for (opt of sortOptions; track opt.value) {
              <button (click)="view.sort.set(opt.value); view.sortSheetOpen.set(false)"
                      class="w-full flex items-center justify-between px-4 py-3.5 text-left"
                      style="border-top:1px solid var(--color-border)">
                <span class="text-sm font-medium"
                      [style.color]="view.sort() === opt.value ? 'var(--color-gold-hover)' : 'var(--color-text)'">{{ opt.label }}</span>
                @if (view.sort() === opt.value) { <svg lucideCheck [size]="18" style="color:var(--color-gold-hover)"></svg> }
              </button>
            }
          </div>
        </bd-bottom-sheet>
      }

    </div>
  `
})
export class WaiterShell implements OnInit {
  shift    = signal<Shift | null>(null);
  currentUrl = signal('');
  moreOpen = signal(false);

  /** Скролл-контейнер общий для всех страниц официанта → при переходе сбрасываем
      позицию, иначе заказ открывается прокрученным (и липкая шапка на iOS «висит»). */
  private scrollMain = viewChild<ElementRef<HTMLElement>>('scrollMain');

  /** Нижнее меню — только у гардероба (ему нужно переключаться между билетами/чеками/профилем).
      У официанта/бармена нижнего меню НЕТ: Столы это «домой», Профиль — в шапке справа. */
  showNav = computed(() => this.auth.role() === 'wardrobe');

  /** Кнопка «‹ Столы» в шапке: когда нижнего меню нет и мы не на Столах
      и не на экране заказа (у него своя кнопка назад) — напр. на Профиле. */
  headerBack = computed(() => {
    if (this.showNav()) return false;
    const u = this.currentUrl().split('?')[0];
    return u !== '/waiter/tables' && !u.startsWith('/waiter/order');
  });

  auth = inject(AuthService);
  view = inject(WaiterViewService);
  refresh = inject(RefreshService);
  private perm = inject(PermissionService);

  /** Первая буква имени — для иконки сотрудника. */
  initial = computed(() => (this.auth.user()?.display_name || this.auth.user()?.username || '?')[0].toUpperCase());

  /** На плане зала показываем фильтр «Мои/Все» + сортировку. */
  onTablesRoute = computed(() => this.currentUrl().split('?')[0] === '/waiter/tables');

  /** Экран заказа стола — у него своя шапка, общую (с иконкой) скрываем. */
  onOrderDetail = computed(() => this.currentUrl().split('?')[0].startsWith('/waiter/order/'));

  sortOptions: { value: WaiterSort; label: string }[] = [
    { value: 'number', label: 'По номеру стола' },
    { value: 'table',  label: 'По столу' },
    { value: 'status', label: 'По статусу' },
  ];

  /** Кто может открыть смену (бармен/админ). В этом интерфейсе — только если зашёл админ. */
  canOpenShift = computed(() => this.perm.can(Perm.SHIFT_OPEN));

  roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? ''] ?? '');

  /** Tabs depend on role. */
  tabs = computed<Tab[]>(() => {
    const tables  = { path: '/waiter/tables',  label: 'Столы',      icon: LucideUtensilsCrossed };
    const tickets = { path: '/waiter/tickets', label: 'Билеты',     icon: LucideTicket };
    const history = { path: '/waiter/history', label: 'Чеки',       icon: LucideReceipt };
    const profile = { path: '/waiter/profile', label: 'Профиль',    icon: LucideCircleUserRound };
    const admin   = { path: '/admin',          label: 'Управление', icon: LucideSettings };

    switch (this.auth.role()) {
      case 'wardrobe':  return [tickets, history, profile];
      case 'admin':     return [tables, tickets, admin];
      // Официант/бармен: всё про стол — внутри экрана стола. В навигации только план зала и профиль.
      default:          return [tables, profile]; // waiter, bartender
    }
  });

  constructor(private shiftApi: ShiftApi, private router: Router, private toast: ToastService) {}

  ngOnInit() {
    this.currentUrl.set(this.router.url);
    this.router.events.pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url: string = e.urlAfterRedirects;
        this.currentUrl.set(url);
        // Контейнер общий и сохраняет прокрутку. Сбрасываем только при входе в заказ,
        // иначе он откроется прокрученным (и липкая шапка на iOS «висит»).
        // Список столов прокрутку сохраняет.
        if (url.split('?')[0].startsWith('/waiter/order/')) {
          const el = this.scrollMain()?.nativeElement;
          if (el) el.scrollTop = 0;
        }
      });
    this.loadShift();
    // role или permissions могут отсутствовать у уже залогиненных планшетов
    // (профиль закэширован до появления прав в /auth/me) — тогда подтягиваем свежий.
    const u = this.auth.user();
    if (!u?.role || !u?.permissions) this.auth.fetchProfile().subscribe();
  }

  loadShift() {
    this.shiftApi.getCurrentShift().subscribe({
      next: s => this.shift.set(s),
      error: () => this.shift.set(null)
    });
  }

  goTables() { this.router.navigate(['/waiter/tables']); }
  goMore(path: string) { this.moreOpen.set(false); this.router.navigate([path]); }

  openShift() {
    this.shiftApi.createShift({}).subscribe({
      next: s => this.shift.set(s),
      error: err => this.toast.apiError(err, 'Не удалось открыть смену'),
    });
  }
}
