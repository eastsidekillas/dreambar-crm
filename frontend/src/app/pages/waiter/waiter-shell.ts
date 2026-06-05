import { Component, OnInit, signal, computed, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { CartService } from '../../features/cart/cart.service';
import { CartDrawerComponent } from '../../widgets/cart-drawer/cart-drawer.component';
import { Shift } from '../../core/models';

interface Tab { path: string; label: string; icon: string; }

@Component({
  selector: 'app-waiter-shell',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet, CartDrawerComponent],
  template: `
    <div class="flex flex-col min-h-screen" style="background:var(--color-bg)">

      <!-- ── Header ───────────────────────────────────── -->
      <header class="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
              style="background:white;border-bottom:1px solid var(--color-border);box-shadow:0 1px 4px rgba(0,0,0,0.06)">
        <div class="flex items-center gap-2">
          <span class="text-xl">🍸</span>
          <div class="leading-tight">
            <p class="font-bold text-sm">BAR DREAM</p>
            <p class="text-xs" style="color:var(--color-muted)">{{ auth.user()?.display_name }} · {{ roleLabel() }}</p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          @if (shift()) {
            <span class="badge badge-green">
              <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
              Смена
            </span>
          } @else {
            <span class="badge badge-gray">Нет смены</span>
          }
          <button (click)="logout()" class="text-sm" style="color:var(--color-muted)">Выйти</button>
        </div>
      </header>

      <!-- ── Shift info bar ──────────────────────────── -->
      @if (shift()) {
        <div class="px-4 py-2 flex items-center justify-between text-xs"
             style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
          <span style="color:var(--color-gold-hover)">
            📅 {{ formatDate(shift()!.date) }} &nbsp;·&nbsp;
            {{ shift()!.orders_count }} зак. &nbsp;·&nbsp;
            {{ shift()!.tickets_count }} бил.
          </span>
          <span class="font-bold" style="color:var(--color-gold-hover)">
            {{ shift()!.total_revenue | number:'1.0-0' }} ₽
          </span>
        </div>
      } @else {
        <div class="px-4 py-2 flex items-center justify-between"
             style="background:#FEF3C7;border-bottom:1px solid #FDE68A">
          <span class="text-xs" style="color:var(--color-amber)">Смена не открыта.</span>
          <button (click)="openShift()" class="btn btn-primary btn-sm">Открыть смену</button>
        </div>
      }

      <!-- ── Content ─────────────────────────────────── -->
      <main class="flex-1 overflow-y-auto p-4" style="padding-bottom:80px">
        <router-outlet />
      </main>

      <!-- ── Cart bar (only roles that take orders) ──── -->
      @if (canOrder() && cart.hasItems()) {
        <div class="fixed z-30 left-4 right-4" style="bottom:68px">
          <button (click)="cartOpen.set(true)"
                  class="w-full flex items-center justify-between px-4 py-3 rounded-xl"
                  style="background:var(--color-gold);box-shadow:0 4px 16px rgba(184,146,42,0.4);color:white">
            <div class="flex items-center gap-2">
              <span class="text-lg">🛒</span>
              <span class="font-semibold text-sm">Корзина</span>
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
            <span class="text-xl leading-none">{{ tab.icon }}</span>
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

  /** Bartenders & waiters take orders; wardrobe only sells tickets. */
  canOrder = computed(() => {
    const r = this.auth.role();
    return r === 'waiter' || r === 'bartender' || r === 'admin';
  });

  roleLabel = computed(() => {
    const map: Record<string, string> = {
      admin: 'Администратор', waiter: 'Официант', bartender: 'Бармен', wardrobe: 'Гардероб',
    };
    return map[this.auth.role() ?? ''] ?? '';
  });

  /** Tabs depend on role. */
  tabs = computed<Tab[]>(() => {
    const order   = { path: '/waiter/order',   label: 'Заказ',   icon: '📋' };
    const tickets = { path: '/waiter/tickets', label: 'Билеты',  icon: '🎟' };
    const history = { path: '/waiter/history', label: 'История', icon: '📊' };
    const admin   = { path: '/admin',          label: 'Управление', icon: '⚙️' };

    switch (this.auth.role()) {
      case 'wardrobe':  return [tickets, history];
      case 'admin':     return [order, tickets, history, admin];
      default:          return [order, tickets, history]; // waiter, bartender
    }
  });

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadShift();
    if (!this.auth.user()?.role) this.auth.fetchProfile().subscribe();
  }

  loadShift() {
    this.api.getCurrentShift().subscribe({
      next: s => this.shift.set(s),
      error: () => this.shift.set(null)
    });
  }

  openShift() {
    this.api.createShift({}).subscribe({ next: s => this.shift.set(s) });
  }

  onSubmitOrder(tableNumber: string) {
    const s = this.shift();
    if (!s) { alert('Нет открытой смены'); this.drawerRef?.resetSubmitting(); return; }
    this.api.createOrder({
      shift: s.id, table_number: tableNumber, notes: '',
      items: this.cart.items().map(c => ({ menu_item: c.item.id, quantity: c.qty }))
    }).subscribe({
      next: order => {
        this.api.closeOrder(order.id).subscribe(() => this.loadShift());
        this.cart.clear();
        this.cartOpen.set(false);
        this.drawerRef?.resetSubmitting();
      },
      error: () => { this.drawerRef?.resetSubmitting(); alert('Ошибка при отправке заказа'); }
    });
  }

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }

  logout() { this.auth.logout(); }
}
