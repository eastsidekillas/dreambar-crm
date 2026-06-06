import { Component, OnInit, OnDestroy, signal, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { KitchenTicket, KitchenItem, KitchenStatus } from '../../core/models';

const REFRESH_MS = 8000;

@Component({
  selector: 'app-kitchen',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen flex flex-col" style="background:#1C1917;color:#F5F3EE">

      <!-- Header -->
      <header class="sticky top-0 z-30 px-4 py-3 flex items-center justify-between"
              style="background:#0C0A09;border-bottom:1px solid #44403C">
        <div class="flex items-center gap-2">
          <span class="text-2xl">🍳</span>
          <div class="leading-tight">
            <p class="font-bold">Кухня</p>
            <p class="text-xs" style="color:#A8A29E">{{ auth.user()?.display_name }}</p>
          </div>
        </div>

        <div class="flex items-center gap-3 sm:gap-4">
          <div class="text-center">
            <p class="text-lg sm:text-xl font-bold leading-none" style="color:#FBBF24">{{ active().length }}</p>
            <p class="text-xs" style="color:#A8A29E">в работе</p>
          </div>
          <div class="text-center">
            <p class="text-lg sm:text-xl font-bold leading-none" style="color:#4ADE80">{{ readyToday() }}</p>
            <p class="text-xs" style="color:#A8A29E">готово</p>
          </div>

          <!-- Sound toggle -->
          <button (click)="toggleSound()"
                  class="text-xl px-2 py-1.5 rounded-lg" style="background:#292524"
                  [title]="soundOn() ? 'Звук включён' : 'Звук выключен'">
            {{ soundOn() ? '🔔' : '🔕' }}
          </button>

          <div class="hidden sm:flex items-center gap-1.5 text-xs" style="color:#A8A29E">
            <span class="w-2 h-2 rounded-full" [style.background]="loading() ? '#FBBF24' : '#4ADE80'"></span>
            {{ lastUpdate() }}
          </div>
          <button (click)="logout()" class="text-sm px-3 py-1.5 rounded-lg"
                  style="background:#292524;color:#E7E5E4">Выйти</button>
        </div>
      </header>

      <!-- No shift -->
      @if (noShift()) {
        <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
          <span class="text-6xl mb-4">😴</span>
          <p class="text-xl font-bold mb-1">Смена не открыта</p>
          <p style="color:#A8A29E">Заказы появятся, когда откроют смену</p>
        </div>
      } @else {

        <!-- Active -->
        @if (!active().length) {
          <div class="flex flex-col items-center justify-center text-center px-4 py-12">
            <span class="text-5xl mb-3">✅</span>
            <p class="text-lg font-bold mb-1">Нет блюд в работе</p>
            <p style="color:#A8A29E">Новые заказы появятся здесь автоматически</p>
          </div>
        } @else {
          <main class="p-3 grid gap-3"
                style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));align-content:start">
            @for (t of active(); track t.order_id) {
              <div class="rounded-xl overflow-hidden flex flex-col"
                   style="background:#292524;border:2px solid"
                   [style.border-color]="urgencyColor(t.elapsed_min)">

                <div class="px-3 py-2 flex items-center justify-between"
                     [style.background]="urgencyColor(t.elapsed_min)">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-lg" style="color:#1C1917">#{{ t.order_id }}</span>
                    <!-- Источник: бар или стол -->
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full"
                          [style]="t.source === 'bar'
                            ? 'background:#7C3AED;color:white'
                            : 'background:rgba(0,0,0,0.2);color:#1C1917'">
                      {{ t.source === 'bar' ? '🍸 Бар' : '🪑 Стол' }}
                    </span>
                    @if (t.table_number) {
                      <span class="text-sm font-semibold px-2 py-0.5 rounded"
                            style="background:rgba(0,0,0,0.15);color:#1C1917">{{ t.table_number }}</span>
                    }
                  </div>
                  <span class="font-bold text-sm" style="color:#1C1917">⏱ {{ t.elapsed_min }} мин</span>
                </div>

                <div class="px-3 pt-2 text-xs" style="color:#A8A29E">Принял: {{ t.waiter_name }}</div>

                <div class="p-3 flex-1 space-y-2">
                  @for (it of t.items; track it.id) {
                    <div class="rounded-lg p-2.5"
                         [style.background]="it.kitchen_status === 'cooking' ? '#422006' : '#1C1917'"
                         [style.opacity]="it.kitchen_status === 'ready' ? '0.45' : '1'">
                      <div class="flex items-center justify-between mb-2">
                        <div class="flex items-center gap-2">
                          <span class="font-bold text-lg" style="color:#FBBF24">{{ it.quantity }}×</span>
                          <span class="font-semibold">{{ it.name }}</span>
                        </div>
                        @if (it.kitchen_status === 'cooking') {
                          <span class="text-xs px-2 py-0.5 rounded-full" style="background:#F59E0B;color:#1C1917">готовится</span>
                        } @else if (it.kitchen_status === 'ready') {
                          <span class="text-xs px-2 py-0.5 rounded-full" style="background:#22C55E;color:#1C1917">✓ готов</span>
                        }
                      </div>
                      @if (it.volume) { <p class="text-xs mb-2" style="color:#A8A29E">{{ it.volume }}</p> }
                      <div class="flex gap-2">
                        @if (it.kitchen_status === 'new') {
                          <button (click)="setStatus(it, 'cooking')"
                                  class="flex-1 py-2 rounded-lg font-semibold text-sm"
                                  style="background:#F59E0B;color:#1C1917">▶ В работу</button>
                        } @else if (it.kitchen_status === 'cooking') {
                          <button (click)="setStatus(it, 'ready')"
                                  class="flex-1 py-2 rounded-lg font-semibold text-sm"
                                  style="background:#22C55E;color:#1C1917">✓ Готово</button>
                        }
                      </div>
                    </div>
                  }
                </div>

                <button (click)="markAllReady(t)" class="py-2.5 font-semibold text-sm"
                        style="background:#16A34A;color:white">✓✓ Весь заказ готов</button>
              </div>
            }
          </main>
        }

        <!-- Ready column -->
        @if (ready().length) {
          <section class="px-3 pb-6 mt-2">
            <button (click)="showReady.set(!showReady())"
                    class="flex items-center gap-2 mb-3 text-sm font-semibold"
                    style="color:#A8A29E">
              <span>{{ showReady() ? '▾' : '▸' }}</span>
              ✅ Готовые заказы ({{ ready().length }})
            </button>

            @if (showReady()) {
              <div class="grid gap-2"
                   style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
                @for (t of ready(); track t.order_id) {
                  <div class="rounded-lg p-3" style="background:#1A2E1F;border:1px solid #2F5239">
                    <div class="flex items-center justify-between mb-2">
                      <div class="flex items-center gap-2">
                        <span class="font-bold" style="color:#4ADE80">#{{ t.order_id }}</span>
                        <span class="text-xs font-semibold px-1.5 py-0.5 rounded-full"
                              [style]="t.source === 'bar'
                                ? 'background:#7C3AED;color:white'
                                : 'background:#334155;color:#CBD5E1'">
                          {{ t.source === 'bar' ? '🍸 Бар' : '🪑 Стол' }}
                        </span>
                        @if (t.table_number) {
                          <span class="text-xs" style="color:#A8A29E">{{ t.table_number }}</span>
                        }
                      </div>
                      <span class="text-xs" style="color:#4ADE80">✓ готов</span>
                    </div>
                    <div class="space-y-0.5 mb-2">
                      @for (it of t.items; track it.id) {
                        <p class="text-sm" style="color:#D6D3D1">{{ it.quantity }}× {{ it.name }}</p>
                      }
                    </div>
                    <button (click)="returnToWork(t)"
                            class="w-full py-1.5 rounded-lg text-sm font-medium"
                            style="background:#292524;color:#FBBF24;border:1px solid #57534E">
                      ↩ Вернуть в работу
                    </button>
                  </div>
                }
              </div>
            }
          </section>
        }
      }
    </div>
  `
})
export class KitchenScreen implements OnInit, OnDestroy {
  api  = inject(ApiService);
  auth = inject(AuthService);

  active     = signal<KitchenTicket[]>([]);
  ready      = signal<KitchenTicket[]>([]);
  readyToday = signal(0);
  noShift    = signal(false);
  loading    = signal(false);
  lastUpdate = signal('—');
  showReady  = signal(false);
  soundOn    = signal(true);

  private timer?: ReturnType<typeof setInterval>;
  private seenIds = new Set<number>();
  private primed = false;          // skip beep on very first load
  private audioCtx?: AudioContext;

  ngOnInit() {
    this.load();
    this.timer = setInterval(() => this.load(), REFRESH_MS);
  }

  ngOnDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.audioCtx?.close();
  }

  // Any click on the page unlocks the audio context (browser autoplay policy)
  @HostListener('document:click')
  unlockAudio() {
    if (this.audioCtx?.state === 'suspended') this.audioCtx.resume();
  }

  load() {
    this.loading.set(true);
    this.api.getKitchenOrders().subscribe({
      next: d => {
        this.noShift.set(d.shift === null);
        this.active.set(d.active);
        this.ready.set(d.ready);
        this.readyToday.set(d.ready_today);
        this.lastUpdate.set(new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }));
        this.loading.set(false);
        this.detectNewOrders(d.active);
      },
      error: () => this.loading.set(false)
    });
  }

  private detectNewOrders(active: KitchenTicket[]) {
    let hasNew = false;
    for (const t of active) {
      if (!this.seenIds.has(t.order_id)) {
        this.seenIds.add(t.order_id);
        hasNew = true;
      }
    }
    if (hasNew && this.primed && this.soundOn()) this.beep();
    this.primed = true;
  }

  toggleSound() {
    this.soundOn.update(v => !v);
    if (this.soundOn()) { this.ensureAudio(); this.beep(); } // tap doubles as unlock + preview
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
    // pleasant two-tone "ding-dong"
    const tone = (freq: number, start: number, dur: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.value = freq;
      const t0 = ctx.currentTime + start;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.start(t0); o.stop(t0 + dur + 0.02);
    };
    tone(880, 0, 0.22);
    tone(1175, 0.18, 0.3);
  }

  setStatus(item: KitchenItem, status: KitchenStatus) {
    item.kitchen_status = status;                  // optimistic
    this.api.setKitchenItemStatus(item.id, status).subscribe({
      next: () => { if (status === 'ready') this.load(); },
      error: () => this.load()
    });
  }

  markAllReady(t: KitchenTicket) {
    this.active.update(list => list.filter(x => x.order_id !== t.order_id)); // optimistic
    this.api.markKitchenOrderReady(t.order_id, 'kitchen').subscribe({
      next: () => this.load(),
      error: () => this.load()
    });
  }

  returnToWork(t: KitchenTicket) {
    // send every kitchen item back to "cooking"
    this.ready.update(list => list.filter(x => x.order_id !== t.order_id)); // optimistic
    let pending = t.items.length;
    for (const it of t.items) {
      this.api.setKitchenItemStatus(it.id, 'cooking').subscribe({
        next: () => { if (--pending === 0) this.load(); },
        error: () => this.load()
      });
    }
  }

  urgencyColor(min: number): string {
    if (min >= 15) return '#EF4444';   // red
    if (min >= 8)  return '#F59E0B';   // amber
    return '#4ADE80';                  // green
  }

  logout() { this.auth.logout(); }
}
