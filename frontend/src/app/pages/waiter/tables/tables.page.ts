import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { OrderApi } from '../../../entities/order';
import { ReservationApi } from '../../../entities/reservation';
import { ShiftApi } from '../../../entities/shift';
import { TableApi, tableSegments } from '../../../entities/table';
import { AuthService } from '../../../core/services/auth.service';
import { RefreshService } from '../../../core/services/refresh.service';
import { Order, Zone, Reservation, VenueTable } from '../../../core/models';
import { WaiterViewService } from '../waiter-view.service';
import { ToastService } from '../../../shared/ui';
import { ReservationsSheet } from './reservations-sheet';
import { NewTableSheet } from './new-table-sheet';
import { TableTile } from './table-tile';
import { bill } from '../../../entities/order';
import { LucideCalendar, LucideUtensilsCrossed, LucidePlus } from '@lucide/angular';

const POLL_MS = 10_000;

/** План зала: сетка столов со статусами. Управление заказами — на странице «Заказы». */
@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, ReservationsSheet, NewTableSheet, TableTile,
    LucideCalendar, LucideUtensilsCrossed, LucidePlus],
  template: `
    <div class="space-y-3 pb-4">

      <h1 class="text-xl font-bold px-0.5 pt-0.5">Заказы</h1>

      <!-- ══ ZONE GRID (свободные столы скрыты — открытие через «+») ════ -->
      @if (zones().length) {
        @for (z of filteredZones(); track z.id) {
          @if (visibleTables(z).length) {
            <div>
              <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">{{ z.name }}</p>
              <div class="grid grid-cols-2 gap-2.5">
                @for (t of visibleTables(z); track t.id) {
                  <ng-container [ngTemplateOutlet]="tile" [ngTemplateOutletContext]="{ num: t.number }" />
                }
              </div>
            </div>
          }
        }

        @if (!anyVisibleTables()) {
          <div class="text-center py-16">
            <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
            <p style="color:var(--color-muted)">{{ view.filter() === 'mine' ? 'У вас нет открытых столов' : view.filter() === 'reservations' ? 'Нет броней на сегодня' : 'Нет открытых столов' }}</p>
            <p class="text-xs mt-1" style="color:var(--color-light)">Нажмите «+», чтобы открыть стол</p>
          </div>
        }
      } @else {
        <div class="text-center py-16">
          <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Столы не настроены</p>
        </div>
      }

      <!-- ══ Карточка стола (переиспользуемая) ═════════════════════════ -->
      <ng-template #tile let-num="num">
        @let status = tableStatus(num);
        @let order  = tableOrder(num);
        @let resv   = tableReservation(num);
        @let mine   = status === 'occupied' && order && order.waiter === currentUserId();

        <table-tile [num]="num" [status]="status" [order]="order" [resv]="resv"
                    [mine]="!!mine" (tap)="onTableTap($event)" />
      </ng-template>

      <!-- ══ Брони на сегодня (на табе «Брони» не дублируем) ═══════════ -->
      @if (todayReservations().length && view.filter() !== 'reservations') {
        <button (click)="resvSheet.set(true)"
                class="w-full flex items-center gap-2.5 px-3.5 py-3 rounded-xl font-semibold text-sm"
                style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #93c5fd">
          <svg lucideCalendar [size]="18" class="flex-shrink-0"></svg>
          <span class="flex-1 text-left">Брони на сегодня</span>
          <span class="px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0"
                style="background:#dbeafe;color:#1d4ed8">{{ todayReservations().length }}</span>
        </button>
      }
    </div>

    <!-- ══ FAB: открыть стол ═══════════════════════════════════════ -->
    <button (click)="openNewTable()" title="Открыть стол"
            class="fixed z-30 flex items-center justify-center rounded-full"
            style="right:16px;bottom:calc(16px + env(safe-area-inset-bottom));width:56px;height:56px;background:var(--color-gold);color:white;box-shadow:0 4px 16px rgba(184,146,42,0.4)">
      <svg lucidePlus [size]="28"></svg>
    </button>

    <!-- ── Reservations sheet ────────────────────────────────────── -->
    @if (resvSheet()) {
      <reservations-sheet [reservations]="resvSorted()" (arrive)="markArrived($event)" (closed)="resvSheet.set(false)" />
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
  private router = inject(Router);
  private toast  = inject(ToastService);
  view = inject(WaiterViewService);

  orders = signal<Order[]>([]);
  zones  = signal<Zone[]>([]);
  todayReservations = signal<Reservation[]>([]);
  selectedZoneId    = signal<number | null>(null);

  shiftId: number | null = null;   // доступен из шаблона для new-table-sheet
  newTable  = signal(false);
  ntPrefill = signal<string[]>([]);
  resvSheet = signal(false);

  currentUserId = computed(() => this.auth.user()?.id);

  filteredZones = computed(() => {
    const id = this.selectedZoneId();
    return id === null ? this.zones() : this.zones().filter(z => z.id === id);
  });

  /** Есть ли хоть один видимый стол (с учётом фильтра) — для пустого состояния. */
  anyVisibleTables = computed(() => this.zones().some(z => this.visibleTables(z).length > 0));

  /** Столы зоны: только активные (занятые/брони, без свободных) + фильтр «Мои/Все» + сортировка. */
  visibleTables(z: Zone): VenueTable[] {
    const me = this.currentUserId();
    // Свободные столы скрыты — их открывают через «+».
    // Объединённый заказ (11+12) показываем один раз — на первом (главном) столе.
    let ts = z.tables.filter(t =>
      this.tableStatus(t.number) !== 'free' && !this.isSecondaryMember(t.number));
    const f = this.view.filter();
    if (f === 'mine') {
      ts = ts.filter(t => { const o = this.tableOrder(t.number); return !!o && o.waiter === me; });
    } else if (f === 'reservations') {
      ts = ts.filter(t => this.tableStatus(t.number) === 'reserved');
    }
    return [...ts].sort((a, b) => this.tableCompare(a.number, b.number));
  }

  /** Стол — НЕ главный в объединённом заказе (11+12): его представляет первый стол. */
  private isSecondaryMember(num: string): boolean {
    const o = this.tableOrder(num);
    if (!o) return false;
    const parts = this.orderTables(o);
    return parts.length > 1 && parts[0] !== num;
  }

  private statusRank(num: string): number {
    const o = this.tableOrder(num);
    const mine = !!o && o.waiter === this.currentUserId();
    if (mine && bill.readyCount(o!) > 0) return 0;   // готовы блюда
    if (mine) return 1;                              // мой занятый
    const st = this.tableStatus(num);
    if (st === 'reserved') return 2;
    if (st === 'free') return 3;
    return 4;                                        // занят другим
  }
  private numCompare(a: string, b: string): number {
    const na = parseInt(a, 10), nb = parseInt(b, 10);
    if (isNaN(na) && isNaN(nb)) return a.localeCompare(b, 'ru', { numeric: true });
    if (isNaN(na)) return 1;
    if (isNaN(nb)) return -1;
    return na !== nb ? na - nb : a.localeCompare(b, 'ru', { numeric: true });
  }
  private tableCompare(a: string, b: string): number {
    switch (this.view.sort()) {
      case 'status': { const d = this.statusRank(a) - this.statusRank(b); return d || this.numCompare(a, b); }
      case 'table':  return a.localeCompare(b, 'ru', { numeric: true });
      default:       return this.numCompare(a, b);   // 'number'
    }
  }

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

  private refreshSvc = inject(RefreshService);
  private readonly onPullRefresh = () => this.reloadAll();

  ngOnInit() {
    this.load();
    this.shiftApi.getCurrentShift().subscribe({ next: s => this.shiftId = s?.id ?? null, error: () => {} });
    this.pollTimer = setInterval(() => this.load(), POLL_MS);

    this.loadZones();
    this.loadReservations();
    this.refreshSvc.register(this.onPullRefresh);
  }
  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.refreshSvc.unregister(this.onPullRefresh);
  }

  load(done?: () => void) {
    if (this.pollBusy) { done?.(); return; }
    this.pollBusy = true;
    this.orderApi.getActiveOrders().subscribe({
      next: o => { this.pollBusy = false; this.orders.set(o); done?.(); },
      error: () => { this.pollBusy = false; done?.(); },
    });
  }

  private loadZones() {
    this.tableApi.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
  }

  private loadReservations() {
    const today = new Date().toISOString().split('T')[0];
    this.reservationApi.getReservations({ date: today }).subscribe({
      next: r => this.todayReservations.set(r.filter(x => ['pending', 'confirmed', 'arrived'].includes(x.status))),
      error: () => {},
    });
  }

  /** Официант отмечает, что гость по брони пришёл. */
  markArrived(r: Reservation) {
    this.reservationApi.setReservationStatus(r.id, 'arrived').subscribe({
      next: u => {
        this.todayReservations.update(list => list.map(x => x.id === u.id ? u : x));
        this.toast.success(`Гость пришёл — ${u.name}`);
      },
      error: err => this.toast.apiError(err, 'Не удалось отметить приход'),
    });
  }

  /** Pull-to-refresh: перегрузить всё, спрятать спиннер по завершении заказов. */
  private reloadAll() {
    this.pollBusy = false;          // не дать поллингу заблокировать ручное обновление
    this.loadZones();
    this.loadReservations();
    this.load(() => this.refreshSvc.done());
  }

  // ── Table helpers ─────────────────────────────────────────────────
  private orderTables(o: Order): string[] {
    return tableSegments(o.table_number);
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
  onTableTap(num: string) {
    if (this.tableStatus(num) === 'occupied') {
      const o = this.tableOrder(num);
      if (o && o.waiter === this.currentUserId()) {
        this.router.navigate(['/waiter/order', o.id]);   // свой стол → экран заказа
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
    this.newTable.set(false);
    this.router.navigate(['/waiter/order', order.id], { queryParams: { seg: 'menu' } });
  }
}