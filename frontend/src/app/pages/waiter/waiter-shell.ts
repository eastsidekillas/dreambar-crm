import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed, inject, ViewChild } from '@angular/core';
import { formatDate as fmtDate } from '../../shared/lib/formatters';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PermissionService } from '../../core/services/permission.service';
import { Perm } from '../../shared/lib/permissions';
import { OrderApi } from '../../entities/order';
import { ShiftApi } from '../../entities/shift';
import { CartService } from '../../features/cart/cart.service';
import { CartDrawerComponent, CartSubmit } from '../../widgets/cart-drawer/cart-drawer.component';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { Shift } from '../../core/models';
import { ROLE_LABEL } from '../../shared/lib/roles';
import {
  LucideDynamicIcon,
  LucideClipboardList, LucideUtensilsCrossed, LucideTicket, LucideReceipt,
  LucideSettings, LucideShoppingCart, LucideCircleUserRound,
} from '@lucide/angular';

interface Tab { path: string; label: string; icon: LucideIconInput; }

@Component({
  selector: 'app-waiter-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, CartDrawerComponent, LucideDynamicIcon,
    LucideShoppingCart],
  template: `
    <div class="flex flex-col" style="height:100dvh;background:var(--color-bg)">

      <!-- ── Header ───────────────────────────────────── -->
      <header class="flex-shrink-0 z-40 px-4 flex items-center justify-between"
              style="height:52px;background:white;border-bottom:1px solid var(--color-border)">

        <!-- Left: shift status -->
        <div class="flex items-center gap-2">
          @if (shift()) {
            <span class="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full"
                  style="background:var(--color-green-bg);color:var(--color-green)">
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background:var(--color-green)"></span>
              {{ formatDate(shift()!.date) }}
            </span>
          } @else {
            <button (click)="openShift()" class="btn btn-primary btn-sm">Открыть смену</button>
          }
        </div>

        <!-- Right: profile chip -->
        <a routerLink="/waiter/profile" title="Профиль: мои показатели, PIN, выход"
           class="flex items-center gap-2 px-2 py-1 rounded-xl"
           style="text-decoration:none;border:1px solid var(--color-border);background:var(--color-bg)">
          <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                style="background:linear-gradient(135deg,var(--color-gold),var(--color-gold-hover));color:white">
            {{ (auth.user()?.display_name || auth.user()?.username || '?')[0].toUpperCase() }}
          </span>
          <span class="text-sm font-medium truncate max-w-28" style="color:var(--color-text)">
            {{ auth.user()?.display_name || auth.user()?.username }}
          </span>
        </a>
      </header>

      <!-- ── Content ─────────────────────────────────── -->
      <main class="flex-1 min-h-0 overflow-y-auto p-3" style="padding-bottom:80px">
        <router-outlet />
      </main>

      <!-- ── Cart bar (only roles that take orders) ──── -->
      @if (canOrder() && cart.hasItems()) {
        <div class="fixed z-30 left-4 right-4" style="bottom:68px">
          <button (click)="cartOpen.set(true)"
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                  style="background:var(--color-gold);box-shadow:0 4px 16px rgba(184,146,42,0.4);color:white">
            <div class="flex items-center gap-2">
              <svg lucideShoppingCart [size]="18" style="color:white"></svg>
              <span class="font-semibold text-sm">
                {{ cart.target() ? 'Дозаказ · ' + (cart.target()!.table_number || 'Стол') : 'Корзина' }}
              </span>
              <span class="text-xs px-2 py-0.5 rounded-full font-bold" style="background:rgba(255,255,255,0.25)">
                {{ cart.count() }} поз.
              </span>
            </div>
            <div class="flex items-center gap-2">
              <span class="font-bold">{{ cart.total() | number:'1.0-0' }} ₽</span>
              <span>→</span>
            </div>
          </button>
        </div>
      }

      <!-- ── Bottom nav ───────────────────────────────── -->
      <nav class="fixed bottom-0 left-0 right-0 z-40 safe-bottom flex"
           style="background:white;border-top:1px solid var(--color-border);box-shadow:0 -2px 12px rgba(0,0,0,0.06)">
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

      <!-- ── Cart drawer ──────────────────────────────── -->
      <cart-drawer #drawer [open]="cartOpen()"
        (close)="cartOpen.set(false)"
        (submit)="onSubmitOrder($event)" />

    </div>
  `
})
export class WaiterShell implements OnInit {
  @ViewChild('drawer') drawerRef!: CartDrawerComponent;

  shift    = signal<Shift | null>(null);
  cartOpen = signal(false);

  cart = inject(CartService);
  auth = inject(AuthService);
  private perm = inject(PermissionService);

  /** Кто может вести заказы — по праву из матрицы (официант/бармен/админ; гардероб — нет). */
  canOrder = computed(() => this.perm.can(Perm.ORDER_CREATE));

  roleLabel = computed(() => ROLE_LABEL[this.auth.role() ?? ''] ?? '');

  /** Tabs depend on role. */
  tabs = computed<Tab[]>(() => {
    const order   = { path: '/waiter/order',   label: 'Меню',       icon: LucideClipboardList };
    const tables  = { path: '/waiter/tables',  label: 'Столы',      icon: LucideUtensilsCrossed };
    const tickets = { path: '/waiter/tickets', label: 'Билеты',     icon: LucideTicket };
    const history = { path: '/waiter/history', label: 'Чеки',       icon: LucideReceipt };
    const profile = { path: '/waiter/profile', label: 'Профиль',    icon: LucideCircleUserRound };
    const admin   = { path: '/admin',          label: 'Управление', icon: LucideSettings };

    switch (this.auth.role()) {
      case 'wardrobe':  return [tickets, history, profile];
      case 'admin':     return [tables, order, tickets, history, admin];
      default:          return [tables, order, history, profile]; // waiter, bartender
    }
  });

  constructor(private orderApi: OrderApi, private shiftApi: ShiftApi, private router: Router, private toast: ToastService) {}

  ngOnInit() {
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

  openShift() {
    this.shiftApi.createShift({}).subscribe({
      next: s => this.shift.set(s),
      error: err => this.toast.apiError(err, 'Не удалось открыть смену'),
    });
  }

  onSubmitOrder(payload: CartSubmit) {
    const target = this.cart.target();
    if (target) { this.appendToSession(target.id); return; }

    const s = this.shift();
    if (!s) { this.toast.error('Нет открытой смены'); this.drawerRef?.resetSubmitting(); return; }
    // Новая посадка: заказ остаётся ОТКРЫТЫМ, пока компания сидит за столом.
    this.orderApi.createOrder({
      shift: s.id, table_number: payload.table, guests: payload.guests, notes: '',
      items: this.cart.items().map(c => ({ menu_item: c.item.id, quantity: c.qty, guest_no: c.guestNo }))
    }).subscribe({
      next: () => {
        this.afterSubmit();
        this.toast.success('Стол открыт');
        this.router.navigate(['/waiter/tables']);
      },
      error: () => { this.drawerRef?.resetSubmitting(); this.toast.error('Ошибка при открытии стола'); }
    });
  }

  /** Дозаказ: добавляем позиции корзины в уже открытую посадку. */
  private appendToSession(orderId: number) {
    const calls = this.cart.items().map(c => this.orderApi.addItemToOrder(orderId, c.item.id, c.qty, c.guestNo));
    forkJoin(calls.length ? calls : [of(null)]).subscribe({
      next: () => {
        this.afterSubmit();
        this.toast.success('Добавлено к столу');
        this.router.navigate(['/waiter/tables']);
      },
      error: () => { this.drawerRef?.resetSubmitting(); this.toast.error('Ошибка при добавлении'); }
    });
  }

  private afterSubmit() {
    this.loadShift();
    this.cart.clear();
    this.cartOpen.set(false);
    this.drawerRef?.resetSubmitting();
  }

  formatDate(d: string): string { return fmtDate(d); }
}
