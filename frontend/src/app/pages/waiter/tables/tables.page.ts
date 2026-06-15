import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderApi } from '../../../entities/order';
import { ReservationApi } from '../../../entities/reservation';
import { ShiftApi } from '../../../entities/shift';
import { TableApi } from '../../../entities/table';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../features/cart/cart.service';
import { Order, Zone, Reservation } from '../../../core/models';
import { ReservationsSheet } from './reservations-sheet';
import { NewTableSheet } from './new-table-sheet';
import * as bill from './order-bill';
import { LucideCalendar, LucideUsers, LucideUtensilsCrossed, LucidePlus } from '@lucide/angular';

const POLL_MS = 10_000;

/** План зала: сетка столов со статусами. Управление заказами — на странице «Заказы». */
@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, ReservationsSheet, NewTableSheet,
    LucideCalendar, LucideUsers, LucideUtensilsCrossed, LucidePlus],
  template: `
    <div class="space-y-3 pb-4">

      <!-- ══ ZONE GRID ═══════════════════════════════════════════════ -->
      @if (zones().length) {
        <div class="flex gap-2 overflow-x-auto pb-0.5" style="scrollbar-width:none">
          <button (click)="selectedZoneId.set(null)"
                  class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium"
                  [style]="selectedZoneId() === null
                    ? 'background:var(--color-gold);color:white'
                    : 'background:var(--color-surface2);color:var(--color-muted)'">
            Все
          </button>
          @for (z of zones(); track z.id) {
            <button (click)="selectedZoneId.set(z.id)"
                    class="flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium"
                    [style]="selectedZoneId() === z.id
                      ? 'background:' + z.color + ';color:white'
                      : 'background:var(--color-surface2);color:var(--color-muted)'">
              {{ z.name }}
            </button>
          }
        </div>

        @for (z of filteredZones(); track z.id) {
          @if (z.tables.length) {
            <div>
              @if (filteredZones().length > 1) {
                <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">{{ z.name }}</p>
              }
              <div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(88px,1fr))">
                @for (t of z.tables; track t.id) {
                  @let status = tableStatus(t.number);
                  @let order  = tableOrder(t.number);
                  @let resv   = tableReservation(t.number);

                  <button (click)="onTableTap(t.number)"
                          class="rounded-xl p-2.5 text-center transition-all active:scale-95 w-full"
                          [style]="tableCardStyle(status)"
                          [style.box-shadow]="isReadyTable(t.number) ? '0 0 0 2.5px #16a34a' : null">
                    <p class="font-bold text-sm leading-none">{{ t.number }}</p>

                    @if (status === 'free') {
                      <p class="text-xs mt-1" style="color:var(--color-muted)">свободен</p>
                      @if (resv) {
                        <p class="text-xs mt-0.5 font-medium flex items-center justify-center gap-0.5" style="color:#2563eb">
                          <svg lucideCalendar [size]="10"></svg> {{ fmtTime(resv.time_start) }}
                        </p>
                      }
                    } @else if (status === 'occupied' && order) {
                      @if (order.waiter === currentUserId()) {
                        <p class="text-xs mt-1 font-semibold" style="color:var(--color-gold-hover)">
                          {{ unpaidTotal(order) | number:'1.0-0' }} ₽
                        </p>
                        <p class="text-xs" style="color:var(--color-muted)">{{ elapsed(order) }}</p>
                        @if (readyCount(order) > 0) {
                          <span class="inline-block px-1 rounded text-xs font-bold mt-0.5"
                                style="background:#16a34a;color:white">✓{{ readyCount(order) }}</span>
                        }
                      } @else {
                        <p class="text-xs mt-1" style="color:var(--color-muted)">занят</p>
                      }
                    } @else if (status === 'reserved' && resv) {
                      <p class="text-xs mt-1 font-medium truncate" style="color:#1d4ed8">{{ resv.name }}</p>
                      <p class="text-xs" style="color:#2563eb">{{ fmtTime(resv.time_start) }}</p>
                      <p class="text-xs flex items-center justify-center gap-0.5" style="color:var(--color-muted)"><svg lucideUsers [size]="10"></svg> {{ resv.guests_count }}</p>
                    }
                  </button>
                }
              </div>
            </div>
          }
        }
      } @else {
        <div class="text-center py-16">
          <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Столы не настроены</p>
        </div>
      }

      <!-- ══ Брони на сегодня ════════════════════════════════════════ -->
      @if (todayReservations().length) {
        <div class="flex gap-2">
          <button (click)="resvSheet.set(true)"
                  class="flex items-center gap-1.5 px-3 rounded-xl font-semibold text-sm"
                  style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #93c5fd;height:44px">
            <svg lucideCalendar [size]="16"></svg> Брони на сегодня · {{ todayReservations().length }}
          </button>
        </div>
      }
    </div>

    <!-- ══ FAB: открыть стол ═══════════════════════════════════════ -->
    <button (click)="openNewTable()" title="Открыть стол"
            class="fixed z-30 flex items-center justify-center rounded-full"
            style="right:16px;bottom:76px;width:56px;height:56px;background:var(--color-gold);color:white;box-shadow:0 4px 16px rgba(184,146,42,0.4)">
      <svg lucidePlus [size]="28"></svg>
    </button>

    <!-- ── Reservations sheet ────────────────────────────────────── -->
    @if (resvSheet()) {
      <reservations-sheet [reservations]="resvSorted()" (closed)="resvSheet.set(false)" />
    }

    <!-- ── New table dialog ──────────────────────────────────────── -->
    @if (newTable()) {
      <new-table-sheet [zones]="zones()" [occupied]="occupiedSet()" [reservations]="todayReservations()"
                       [prefill]="ntPrefill()" [shiftId]="shiftId"
                       (created)="onCreated($event)" (closed)="closeNewTable()" />
    }
  `
})
export class TablesPage implements OnInit, OnDestroy {
  private orderApi = inject(OrderApi);
  private reservationApi = inject(ReservationApi);
  private shiftApi = inject(ShiftApi);
  private tableApi = inject(TableApi);
  private auth   = inject(AuthService);
  private cart   = inject(CartService);
  private router = inject(Router);

  orders = signal<Order[]>([]);
  zones  = signal<Zone[]>([]);
  todayReservations = signal<Reservation[]>([]);
  selectedZoneId    = signal<number | null>(null);

  shiftId: number | null = null;   // доступен из шаблона для new-table-sheet
  newTable  = signal(false);
  ntPrefill = signal<string[]>([]);
  resvSheet = signal(false);

  // расчёт из общего util — для ячеек сетки
  unpaidTotal = bill.unpaidTotal;
  readyCount  = bill.readyCount;
  elapsed     = bill.elapsed;

  currentUserId = computed(() => this.auth.user()?.id);

  filteredZones = computed(() => {
    const id = this.selectedZoneId();
    return id === null ? this.zones() : this.zones().filter(z => z.id === id);
  });

  resvSorted = computed(() =>
    [...this.todayReservations()].sort((a, b) => a.time_start.localeCompare(b.time_start)));

  /** Все занятые столы — для шторки открытия (нельзя открыть занятый). */
  occupiedSet = computed<Set<string>>(() => {
    const s = new Set<string>();
    for (const ord of this.orders())
      for (const t of this.orderTables(ord)) s.add(t);
    return s;
  });

  private pollTimer?: ReturnType<typeof setInterval>;
  private pollBusy = false;

  ngOnInit() {
    this.load();
    this.shiftApi.getCurrentShift().subscribe({ next: s => this.shiftId = s?.id ?? null, error: () => {} });
    this.pollTimer = setInterval(() => this.load(), POLL_MS);

    this.tableApi.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
    const today = new Date().toISOString().split('T')[0];
    this.reservationApi.getReservations({ date: today }).subscribe({
      next: r => this.todayReservations.set(r.filter(x => ['pending', 'confirmed', 'arrived'].includes(x.status))),
      error: () => {},
    });
  }
  ngOnDestroy() { if (this.pollTimer) clearInterval(this.pollTimer); }

  load() {
    if (this.pollBusy) return;
    this.pollBusy = true;
    this.orderApi.getActiveOrders().subscribe({
      next: o => { this.pollBusy = false; this.orders.set(o); },
      error: () => { this.pollBusy = false; },
    });
  }

  // ── Table helpers ─────────────────────────────────────────────────
  private orderTables(o: Order): string[] {
    return o.table_number.split('+').map(s => s.trim()).filter(Boolean);
  }
  tableStatus(num: string): 'free' | 'occupied' | 'reserved' {
    if (this.orders().some(o => this.orderTables(o).includes(num))) return 'occupied';
    if (this.todayReservations().some(r => r.table_number === num)) return 'reserved';
    return 'free';
  }
  tableOrder(num: string): Order | null {
    return this.orders().find(o => this.orderTables(o).includes(num)) ?? null;
  }
  tableReservation(num: string): Reservation | null {
    return this.todayReservations().find(r => r.table_number === num) ?? null;
  }
  tableCardStyle(status: 'free' | 'occupied' | 'reserved'): string {
    if (status === 'occupied')
      return 'background:var(--color-gold-light);border:1.5px solid var(--color-gold-mid)';
    if (status === 'reserved')
      return 'background:#eff6ff;border:1.5px solid #93c5fd';
    return 'background:var(--color-surface2);border:1px solid var(--color-border)';
  }
  /** Свой занятый стол с готовыми блюдами — подсветить. */
  isReadyTable(num: string): boolean {
    const o = this.tableOrder(num);
    return !!o && o.waiter === this.currentUserId() && bill.readyCount(o) > 0;
  }
  fmtTime(t: string): string { return t?.slice(0, 5) ?? ''; }

  onTableTap(num: string) {
    if (this.tableStatus(num) === 'occupied') {
      const o = this.tableOrder(num);
      if (o && o.waiter === this.currentUserId()) {
        this.router.navigate(['/waiter/orders'], { queryParams: { order: o.id } });
      }
      // занят другим — ничего
    } else {
      this.openNewTable(num);   // свободный / с бронью → открыть
    }
  }

  // ── New table ─────────────────────────────────────────────────────
  openNewTable(prefilledTable = '') {
    this.ntPrefill.set(prefilledTable ? [prefilledTable] : []);
    this.newTable.set(true);
  }
  closeNewTable() { this.newTable.set(false); }

  onCreated(order: Order) {
    this.cart.setTarget(order);
    this.newTable.set(false);
    this.router.navigate(['/waiter/order']);
  }
}