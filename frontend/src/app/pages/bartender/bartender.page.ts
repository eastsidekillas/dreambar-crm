import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../features/cart/cart.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { KitchenTicket, KitchenItem, KitchenStatus, MenuByCategory, MenuItem } from '../../core/models';

const REFRESH_MS = 6000;

@Component({
  selector: 'app-bartender',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="flex flex-col" style="height:100dvh;background:#0f172a;color:#f1f5f9">

      <!-- ── Header ──────────────────────────────────────────────────── -->
      <header class="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
              style="background:#0a0f1e;border-bottom:1px solid #1e293b">
        <div class="flex items-center gap-3">
          <span class="text-2xl">🍸</span>
          <div class="leading-tight">
            <p class="font-bold">Бар</p>
            <p class="text-xs" style="color:#94a3b8">{{ auth.user()?.display_name }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <!-- Tab buttons -->
          <div class="flex rounded-lg overflow-hidden" style="border:1px solid #334155">
            <button (click)="tab.set('orders')"
              class="px-4 py-1.5 text-sm font-semibold transition-colors relative"
              [style]="tab() === 'orders' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              Заказы
              @if (active().length) {
                <span class="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                      style="background:#ef4444;color:white">{{ active().length }}</span>
              }
            </button>
            <button (click)="tab.set('new')"
              class="px-4 py-1.5 text-sm font-semibold transition-colors"
              [style]="tab() === 'new' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              + Свой заказ
            </button>
          </div>

          <button (click)="toggleSound()" class="text-xl px-2 py-1 rounded-lg" style="background:#1e293b">
            {{ soundOn() ? '🔔' : '🔕' }}
          </button>

          <div class="hidden sm:flex items-center gap-1.5 text-xs" style="color:#64748b">
            <span class="w-2 h-2 rounded-full" [style.background]="loading() ? '#f59e0b' : '#22c55e'"></span>
            {{ lastUpdate() }}
          </div>

          <button (click)="auth.logout()" class="text-sm px-3 py-1.5 rounded-lg"
                  style="background:#1e293b;color:#e2e8f0">Выйти</button>
        </div>
      </header>

      <!-- ── ЗАКАЗЫ (KDS) ────────────────────────────────────────────── -->
      @if (tab() === 'orders') {
        @if (noShift()) {
          <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
            <span class="text-6xl mb-4">😴</span>
            <p class="text-xl font-bold mb-1">Смена не открыта</p>
            <p style="color:#64748b">Заказы появятся, когда откроют смену</p>
          </div>
        } @else if (!active().length) {
          <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
            <span class="text-5xl mb-3">✅</span>
            <p class="text-lg font-bold mb-1">Нет напитков в работе</p>
            <p style="color:#64748b">Новые заказы появятся здесь автоматически</p>
          </div>
        } @else {
          <main class="p-3 grid gap-3"
                style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr));align-content:start">
            @for (t of active(); track t.order_id) {
              <div class="rounded-xl overflow-hidden flex flex-col"
                   style="background:#1e293b;border:2px solid"
                   [style.border-color]="urgencyColor(t.elapsed_min)">

                <!-- Ticket header -->
                <div class="px-3 py-2.5 flex items-center justify-between"
                     [style.background]="urgencyColor(t.elapsed_min) + '22'">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-lg" style="color:#f59e0b">#{{ t.order_id }}</span>
                    @if (t.table_number) {
                      <span class="text-sm font-bold px-2 py-0.5 rounded"
                            style="background:#334155;color:#f1f5f9">{{ t.table_number }}</span>
                    }
                    <span class="text-xs" style="color:#94a3b8">{{ t.waiter_name }}</span>
                  </div>
                  <span class="text-sm font-bold" [style.color]="urgencyColor(t.elapsed_min)">
                    ⏱ {{ t.elapsed_min }} мин
                  </span>
                </div>

                <!-- Drinks -->
                <div class="p-3 flex-1 space-y-2">
                  @for (it of t.items; track it.id) {
                    <div class="rounded-lg p-3 flex items-center justify-between gap-3"
                         [style.background]="itemBg(it.kitchen_status)"
                         [style.opacity]="it.kitchen_status === 'ready' ? '0.5' : '1'">
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="text-xl font-bold" style="color:#f59e0b">{{ it.quantity }}×</span>
                          <span class="font-semibold truncate">{{ it.name }}</span>
                        </div>
                        @if (it.volume) {
                          <p class="text-xs mt-0.5" style="color:#94a3b8">{{ it.volume }}</p>
                        }
                      </div>
                      <div class="flex-shrink-0">
                        @if (it.kitchen_status === 'new') {
                          <button (click)="setStatus(it, 'cooking')"
                                  class="px-4 py-2 rounded-lg font-bold text-sm"
                                  style="background:#f59e0b;color:#0f172a">▶ Начать</button>
                        } @else if (it.kitchen_status === 'cooking') {
                          <button (click)="setStatus(it, 'ready')"
                                  class="px-4 py-2 rounded-lg font-bold text-sm"
                                  style="background:#22c55e;color:#0f172a">✓ Готово</button>
                        } @else {
                          <span class="px-3 py-1.5 rounded-lg text-sm font-bold"
                                style="background:#15803d;color:white">✓ Готов</span>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- Mark all ready -->
                <button (click)="markAllReady(t)"
                        class="py-3 font-bold text-sm"
                        style="background:#15803d;color:white">
                  ✓✓ Все напитки готовы
                </button>
              </div>
            }
          </main>
        }

        <!-- Ready tickets (collapsed) -->
        @if (ready().length) {
          <section class="px-3 pb-4 mt-1">
            <button (click)="showReady.set(!showReady())"
                    class="flex items-center gap-2 mb-2 text-sm font-semibold"
                    style="color:#64748b">
              {{ showReady() ? '▾' : '▸' }} ✅ Готово к выдаче ({{ ready().length }})
            </button>
            @if (showReady()) {
              <div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
                @for (t of ready(); track t.order_id) {
                  <div class="rounded-lg p-3" style="background:#14532d;border:1px solid #166534">
                    <div class="flex items-center justify-between mb-1">
                      <span class="font-bold" style="color:#4ade80">#{{ t.order_id }}
                        @if (t.table_number) { · {{ t.table_number }} }
                      </span>
                    </div>
                    @for (it of t.items; track it.id) {
                      <p class="text-sm" style="color:#bbf7d0">{{ it.quantity }}× {{ it.name }}</p>
                    }
                  </div>
                }
              </div>
            }
          </section>
        }
      }

      <!-- ── СВОЙ ЗАКАЗ ───────────────────────────────────────────── -->
      @if (tab() === 'new') {
        <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

          <!-- Menu panel -->
          <div class="flex-1 min-h-0 overflow-y-auto p-3 space-y-4">
            <div class="flex items-center gap-3 mb-2">
              <input [(ngModel)]="barLabel" class="field flex-1" placeholder="Стол / зона / стойка"
                     style="background:#1e293b;border-color:#334155;color:#f1f5f9"/>
              <input [(ngModel)]="barGuests" type="number" min="1" class="field w-20"
                     placeholder="Гостей" style="background:#1e293b;border-color:#334155;color:#f1f5f9"/>
            </div>

            @for (cat of barMenu(); track cat.id) {
              <div>
                <p class="text-xs font-bold mb-2 uppercase tracking-wider" style="color:#64748b">
                  {{ cat.name }}
                </p>
                <div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
                  @for (item of cat.items; track item.id) {
                    <button (click)="addToCart(item)"
                            class="rounded-xl p-3 text-left transition-all active:scale-95"
                            style="background:#1e293b;border:1px solid #334155">
                      <p class="font-semibold text-sm leading-tight">{{ item.name }}</p>
                      @if (item.volume) {
                        <p class="text-xs mt-0.5" style="color:#64748b">{{ item.volume }}</p>
                      }
                      <p class="text-sm font-bold mt-1" style="color:#f59e0b">{{ item.price }} ₽</p>
                    </button>
                  }
                </div>
              </div>
            }
          </div>

          <!-- Cart panel -->
          <div class="flex-shrink-0 max-h-64 md:max-h-none w-full md:w-72 flex flex-col overflow-hidden"
               style="background:#0a0f1e;border-top:1px solid #1e293b;border-left:1px solid #1e293b">
            <div class="flex-shrink-0 px-4 py-3 font-bold" style="border-bottom:1px solid #1e293b">
              🧾 Заказ
            </div>

            <div class="flex-1 min-h-0 overflow-y-auto px-4 py-2 space-y-2">
              @for (line of cartLines(); track line.item.id) {
                <div class="flex items-center gap-2 py-1.5" style="border-bottom:1px solid #1e293b">
                  <div class="flex-1 min-w-0">
                    <p class="text-sm font-medium truncate">{{ line.item.name }}</p>
                    <p class="text-xs" style="color:#64748b">{{ line.item.price }} ₽</p>
                  </div>
                  <div class="flex items-center gap-1">
                    <button (click)="decCart(line.item)" class="w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center"
                            style="background:#1e293b">−</button>
                    <span class="w-6 text-center text-sm font-bold">{{ line.qty }}</span>
                    <button (click)="addToCart(line.item)" class="w-7 h-7 rounded-full font-bold text-sm flex items-center justify-center"
                            style="background:#1e293b">+</button>
                  </div>
                  <span class="text-sm font-bold w-16 text-right" style="color:#f59e0b">
                    {{ line.item.price * line.qty | number:'1.0-0' }} ₽
                  </span>
                </div>
              }
              @if (!cartLines().length) {
                <p class="text-sm py-4 text-center" style="color:#475569">Добавьте напитки</p>
              }
            </div>

            <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid #1e293b">
              <div class="flex items-center justify-between mb-3">
                <span style="color:#94a3b8">Итого</span>
                <span class="font-bold text-lg" style="color:#f59e0b">{{ cartTotal() | number:'1.0-0' }} ₽</span>
              </div>
              <button (click)="submitOrder()" [disabled]="!cartLines().length || submitting()"
                      class="w-full py-3 rounded-xl font-bold text-sm"
                      style="background:#f59e0b;color:#0f172a">
                {{ submitting() ? 'Отправка...' : 'Принять заказ' }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `
})
export class BartenderPage implements OnInit, OnDestroy {
  readonly auth  = inject(AuthService);
  private api    = inject(ApiService);
  private toast  = inject(ToastService);

  tab        = signal<'orders' | 'new'>('orders');
  active     = signal<KitchenTicket[]>([]);
  ready      = signal<KitchenTicket[]>([]);
  noShift    = signal(false);
  loading    = signal(false);
  lastUpdate = signal('—');
  showReady  = signal(false);
  soundOn    = signal(true);

  // own order
  barMenu    = signal<{ id: number; name: string; items: MenuItem[] }[]>([]);
  barLabel   = '';
  barGuests  = 1;
  private cart = signal<Map<number, { item: MenuItem; qty: number }>>(new Map());
  submitting = signal(false);

  cartLines = computed(() => [...this.cart().values()]);
  cartTotal = computed(() => this.cartLines().reduce((s, l) => s + l.item.price * l.qty, 0));

  private timer?: ReturnType<typeof setInterval>;
  private seenIds = new Set<number>();
  private primed  = false;
  private audioCtx?: AudioContext;

  ngOnInit() {
    this.load();
    this.loadMenu();
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

  load() {
    this.loading.set(true);
    this.api.getKitchenOrders('bar').subscribe({
      next: d => {
        this.noShift.set(d.shift === null);
        this.active.set(d.active);
        this.ready.set(d.ready);
        this.lastUpdate.set(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        this.loading.set(false);
        this.detectNew(d.active);
      },
      error: () => this.loading.set(false),
    });
  }

  loadMenu() {
    this.api.getMenuByCategory().subscribe(cats => {
      this.barMenu.set(cats.filter(c => c.type === 'bar'));
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

  setStatus(item: KitchenItem, status: KitchenStatus) {
    item.kitchen_status = status;
    this.api.setKitchenItemStatus(item.id, status).subscribe({
      next: () => { if (status === 'ready') this.load(); },
      error: () => this.load(),
    });
  }

  markAllReady(t: KitchenTicket) {
    this.active.update(list => list.filter(x => x.order_id !== t.order_id));
    this.api.markKitchenOrderReady(t.order_id, 'bar').subscribe({ next: () => this.load(), error: () => this.load() });
  }

  // ── own order ─────────────────────────────────────────────────────
  addToCart(item: MenuItem) {
    this.cart.update(m => {
      const next = new Map(m);
      const cur = next.get(item.id);
      next.set(item.id, { item, qty: (cur?.qty ?? 0) + 1 });
      return next;
    });
  }

  decCart(item: MenuItem) {
    this.cart.update(m => {
      const next = new Map(m);
      const cur = next.get(item.id);
      if (!cur) return next;
      if (cur.qty <= 1) next.delete(item.id);
      else next.set(item.id, { ...cur, qty: cur.qty - 1 });
      return next;
    });
  }

  submitOrder() {
    if (!this.cartLines().length || this.submitting()) return;
    this.submitting.set(true);
    this.api.getCurrentShift().subscribe({
      next: shift => {
        const label = this.barLabel.trim() || 'Стойка';
        this.api.createOrder({
          shift: shift.id,
          table_number: label,
          guests: this.barGuests || 1,
          notes: '',
          items: this.cartLines().map(l => ({ menu_item: l.item.id, quantity: l.qty })),
        }).subscribe({
          next: () => {
            this.submitting.set(false);
            this.cart.set(new Map());
            this.barLabel = '';
            this.barGuests = 1;
            this.tab.set('orders');
            this.toast.success('Заказ принят');
            this.load();
          },
          error: () => { this.submitting.set(false); this.toast.error('Ошибка при создании заказа'); },
        });
      },
      error: () => { this.submitting.set(false); this.toast.error('Нет открытой смены'); },
    });
  }

  itemBg(status: string): string {
    if (status === 'cooking') return '#422006';
    if (status === 'ready')   return '#14532d';
    return '#0f172a';
  }

  urgencyColor(min: number): string {
    if (min >= 10) return '#ef4444';
    if (min >= 5)  return '#f59e0b';
    return '#22c55e';
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
