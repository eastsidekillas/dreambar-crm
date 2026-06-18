import { Component, OnInit, OnDestroy, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderApi } from '../../entities/order';
import { ShiftApi } from '../../entities/shift';
import { AuthService } from '../../core/services/auth.service';
import { ToastService, TouchKeyboardComponent } from '../../shared/ui';
import { KitchenTicket } from '../../core/models';
import {
  LucideGlassWater, LucideUtensilsCrossed, LucideBell, LucideBellOff, LucideCalendar, LucideArrowLeftRight,
} from '@lucide/angular';
import { BarOrdersTab } from './tabs/orders.tab';
import { BarKitchenMonitorTab } from './tabs/kitchen-monitor.tab';
import { BarNewOrderTab } from './tabs/new-order.tab';
import { BarReservationsTab } from './tabs/reservations.tab';

const REFRESH_MS = 6000;

type Tab = 'orders' | 'kitchen' | 'new' | 'resv';

@Component({
  selector: 'app-bartender',
  standalone: true,
  imports: [CommonModule, TouchKeyboardComponent,
    BarOrdersTab, BarKitchenMonitorTab, BarNewOrderTab, BarReservationsTab,
    LucideGlassWater, LucideUtensilsCrossed, LucideBell, LucideBellOff, LucideCalendar, LucideArrowLeftRight],
  template: `
    <div class="flex flex-col" style="height:100dvh;background:#0f172a;color:#f1f5f9">

      <!-- ── Header ──────────────────────────────────────────────────── -->
      <header class="sticky top-0 z-30 px-4 pb-3 flex items-center justify-between"
              style="padding-top:calc(0.75rem + env(safe-area-inset-top,0px));background:#0a0f1e;border-bottom:1px solid #1e293b">
        <div class="flex items-center gap-3">
          <svg lucideGlassWater [size]="24" style="color:#f1f5f9"></svg>
          <div class="leading-tight">
            <p class="font-bold">Бар</p>
            <p class="text-xs" style="color:#94a3b8">{{ auth.user()?.display_name }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Tab buttons — touch-sized -->
          <div class="flex rounded-xl overflow-x-auto" style="border:1px solid #334155">
            <button (click)="tab.set('orders')"
              class="relative flex flex-col items-center justify-center px-4 font-semibold transition-colors flex-shrink-0"
              style="min-height:52px;min-width:72px;font-size:0.82rem"
              [style]="tab() === 'orders' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              <span>Заказы</span>
              @if (active().length) {
                <span class="absolute top-1 right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                      style="background:#ef4444;color:white">{{ active().length }}</span>
              }
            </button>
            <button (click)="openKitchenTab()"
              class="relative flex flex-col items-center justify-center px-4 font-semibold transition-colors flex-shrink-0"
              style="min-height:52px;min-width:72px;font-size:0.82rem;border-left:1px solid #334155"
              [style]="tab() === 'kitchen' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              <span class="flex items-center gap-1"><svg lucideUtensilsCrossed [size]="14"></svg> Кухня</span>
              @if (kitchenUnseenCount()) {
                <span class="absolute top-1 right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                      style="background:#22c55e;color:white">{{ kitchenUnseenCount() }}</span>
              }
            </button>
            <button (click)="tab.set('new')"
              class="flex flex-col items-center justify-center px-4 font-semibold transition-colors flex-shrink-0"
              style="min-height:52px;min-width:72px;font-size:0.82rem;border-left:1px solid #334155"
              [style]="tab() === 'new' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              <span>+ Новый</span>
            </button>
            <button (click)="tab.set('resv')"
              class="relative flex flex-col items-center justify-center px-4 font-semibold transition-colors flex-shrink-0"
              style="min-height:52px;min-width:72px;font-size:0.82rem;border-left:1px solid #334155"
              [style]="tab() === 'resv' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              <span class="flex items-center gap-1"><svg lucideCalendar [size]="14"></svg> Брони</span>
              @if (resvTodayCount()) {
                <span class="absolute top-1 right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                      style="background:#8b5cf6;color:white">{{ resvTodayCount() }}</span>
              }
            </button>
          </div>

          @if (auth.hasRoleChoice()) {
            <button (click)="auth.switchRole()" title="Сменить роль / интерфейс"
                    class="flex items-center justify-center rounded-xl"
                    style="background:#1e293b;min-width:48px;min-height:48px">
              <svg lucideArrowLeftRight [size]="20" style="color:#94a3b8"></svg>
            </button>
          }

          <button (click)="toggleSound()"
                  class="flex items-center justify-center rounded-xl"
                  style="background:#1e293b;min-width:48px;min-height:48px">
            @if (soundOn()) {
              <svg lucideBell [size]="20" style="color:#f1f5f9"></svg>
            } @else {
              <svg lucideBellOff [size]="20" style="color:#64748b"></svg>
            }
          </button>

          <div class="hidden sm:flex items-center gap-1.5 text-xs" style="color:#64748b">
            <span class="w-2 h-2 rounded-full" [style.background]="loading() ? '#f59e0b' : '#22c55e'"></span>
            {{ lastUpdate() }}
          </div>

          <button (click)="auth.logout()"
                  class="hidden sm:flex items-center justify-center text-sm px-4 rounded-xl"
                  style="background:#1e293b;color:#e2e8f0;min-height:48px">
            Выйти
          </button>
        </div>
      </header>

      <!-- ── Вкладки ────────────────────────────────────────────────── -->
      @if (tab() === 'orders') {
        <bar-orders-tab [active]="active()" [ready]="ready()"
                        [noShift]="noShift()" [openingShift]="openingShift()"
                        (openShift)="openShift()" (changed)="load()" />
      }

      @if (tab() === 'kitchen') {
        <bar-kitchen-monitor-tab [active]="kitchenActive()" [ready]="kitchenReady()" [noShift]="noShift()" />
      }

      <!-- new/resv держим живыми, чтобы корзина и формы переживали смену вкладок -->
      <bar-new-order-tab [visible]="tab() === 'new'" (submitted)="onOrderSubmitted()" />
      <bar-reservations-tab [visible]="tab() === 'resv'" (todayCount)="resvTodayCount.set($event)" />

      <bd-touch-keyboard />
    </div>
  `,
})
export class BartenderPage implements OnInit, OnDestroy {
  readonly auth    = inject(AuthService);
  private orderApi = inject(OrderApi);
  private shiftApi = inject(ShiftApi);
  private toast    = inject(ToastService);

  tab          = signal<Tab>('orders');
  active       = signal<KitchenTicket[]>([]);
  ready        = signal<KitchenTicket[]>([]);
  noShift      = signal(false);
  openingShift = signal(false);
  loading      = signal(false);
  lastUpdate   = signal('—');
  soundOn      = signal(true);

  // kitchen readiness (read-only view for bartender)
  kitchenActive      = signal<KitchenTicket[]>([]);
  kitchenReady       = signal<KitchenTicket[]>([]);
  kitchenUnseenCount = signal(0);
  private kitchenReadySeenIds = new Set<number>();

  resvTodayCount = signal(0);

  private timer?: ReturnType<typeof setInterval>;
  private seenIds = new Set<number>();
  private primed  = false;
  private audioCtx?: AudioContext;

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.load(), REFRESH_MS);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.audioCtx?.close();
  }

  @HostListener('document:click')
  unlockAudio() {
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
  }

  /** Запросы в полёте: пока не завершились, новый тик поллинга пропускается,
   *  чтобы в медленной сети запросы не наслаивались друг на друга. */
  private pollBusy = 0;

  load() {
    if (this.pollBusy > 0) return;
    this.pollBusy = 2;
    this.loading.set(true);
    this.orderApi.getKitchenOrders('bar').subscribe({
      next: d => {
        this.pollBusy--;
        this.noShift.set(d.shift === null);
        this.active.set(d.active);
        this.ready.set(d.ready);
        this.lastUpdate.set(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        this.loading.set(false);
        this.detectNew(d.active);
      },
      error: () => { this.pollBusy--; this.loading.set(false); },
    });
    this.orderApi.getKitchenOrders('kitchen').subscribe({
      next: d => {
        this.pollBusy--;
        this.kitchenActive.set(d.active);
        this.kitchenReady.set(d.ready);
        const unseen = d.ready.filter(t => !this.kitchenReadySeenIds.has(t.order_id)).length;
        this.kitchenUnseenCount.set(unseen);
      },
      error: () => { this.pollBusy--; },
    });
  }

  onOrderSubmitted() {
    this.tab.set('orders');
    this.load();
  }

  openKitchenTab() {
    this.tab.set('kitchen');
    this.kitchenReady().forEach(t => this.kitchenReadySeenIds.add(t.order_id));
    this.kitchenUnseenCount.set(0);
  }

  openShift() {
    if (this.openingShift()) return;
    this.openingShift.set(true);
    // Сначала проверяем — вдруг смену уже открыли с другого устройства
    this.shiftApi.getCurrentShift().subscribe({
      next: () => { this.openingShift.set(false); this.load(); },
      error: () => {
        this.shiftApi.createShift({}).subscribe({
          next: () => {
            this.openingShift.set(false);
            this.toast.success('Смена открыта');
            this.load();
          },
          error: err => {
            this.openingShift.set(false);
            this.toast.apiError(err, 'Не удалось открыть смену');
          },
        });
      },
    });
  }

  private detectNew(active: KitchenTicket[]) {
    let hasNew = false;
    for (const t of active) {
      if (!this.seenIds.has(t.order_id)) { this.seenIds.add(t.order_id); hasNew = true; }
    }
    if (hasNew && this.primed && this.soundOn()) this.beep();
    this.primed = true;
  }

  toggleSound() {
    this.soundOn.update(v => !v);
    if (this.soundOn()) { this.ensureAudio(); this.beep(); }
  }

  private ensureAudio() {
    try {
      this.audioCtx ??= new (window.AudioContext || (window as any).webkitAudioContext)();
      if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    } catch { /* ignore */ }
  }

  private beep() {
    this.ensureAudio();
    const ctx = this.audioCtx;
    if (!ctx) return;
    const tone = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine'; o.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.02);
    };
    tone(660, 0, 0.2); tone(990, 0.15, 0.3);
  }
}
