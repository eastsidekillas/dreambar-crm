import { Component, Input, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { OrderApi } from '../../../entities/order';
import { TableApi, tableSegments } from '../../../entities/table';
import { ReservationApi } from '../../../entities/reservation';
import { bill } from '../../../entities/order';
import { Order, Zone, Reservation } from '../../../core/models';
import { LIST_TAB_HOST } from './bar-ui';

const POLL_MS = 10_000;

/** Вкладка «Столы» на баре: план зала со статусом (свободен / занят / бронь).
 *  Только просмотр — бармен видит занятость, не управляет заказами официантов. */
@Component({
  selector: 'bar-tables-tab',
  standalone: true,
  imports: [CommonModule],
  host: { style: LIST_TAB_HOST },
  template: `
    <div class="px-3 py-3" style="color:#e2e8f0">
      @for (z of zones(); track z.id) {
        @if (z.tables.length) {
          <div class="mb-4">
            <p class="text-xs font-semibold mb-2" style="color:#94a3b8">{{ z.name }}</p>
            <div class="grid gap-2" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">
              @for (t of z.tables; track t.id) {
                @let o = orderOf(t.number);
                @let resv = !o && reservedSet().has(t.number);
                <div class="rounded-xl px-2 py-2 flex flex-col items-center justify-center text-center"
                     style="min-height:70px;border:1.5px solid"
                     [style.background]="o ? (readyOf(o) ? '#14532d' : '#3a2a0a') : (resv ? '#0c2a4d' : '#1e293b')"
                     [style.border-color]="o ? (readyOf(o) ? '#22c55e' : '#f59e0b') : (resv ? '#3b82f6' : '#334155')">
                  <span class="font-bold leading-tight" style="font-size:1.1rem">{{ t.number }}</span>
                  @if (o) {
                    <span class="text-xs mt-0.5 leading-none" style="color:#fcd34d">{{ o.total | number:'1.0-0' }} ₽</span>
                    <span class="text-[10px] mt-0.5 leading-none truncate w-full" style="color:#94a3b8">{{ o.waiter_name }}</span>
                  } @else if (resv) {
                    <span class="text-[10px] mt-1 leading-none" style="color:#93c5fd">бронь</span>
                  } @else {
                    <span class="text-[10px] mt-1 leading-none" style="color:#64748b">свободен</span>
                  }
                </div>
              }
            </div>
          </div>
        }
      }
      @if (!anyTables()) {
        <p class="text-center py-16 text-sm" style="color:#64748b">Столы не настроены</p>
      }
    </div>
  `,
})
export class BarTablesTab implements OnInit, OnDestroy {
  /** Грузим/поллим только когда вкладка видима. */
  @Input() set visible(v: boolean) {
    this._visible = v;
    if (v) { this.load(); this.startPoll(); } else { this.stopPoll(); }
  }
  private _visible = false;

  private orderApi = inject(OrderApi);
  private tableApi = inject(TableApi);
  private reservationApi = inject(ReservationApi);

  orders = signal<Order[]>([]);
  zones  = signal<Zone[]>([]);
  todayResv = signal<Reservation[]>([]);
  private timer?: ReturnType<typeof setInterval>;

  anyTables = computed(() => this.zones().some(z => z.tables.length));

  /** Занятые сегменты столов (из открытых заказов). */
  private occupied = computed(() => {
    const map = new Map<string, Order>();
    for (const o of this.orders())
      for (const seg of tableSegments(o.table_number)) map.set(seg, o);
    return map;
  });
  /** Забронированные на сегодня столы (активные брони). */
  reservedSet = computed(() => {
    const s = new Set<string>();
    for (const r of this.todayResv())
      for (const seg of tableSegments(r.table_number)) s.add(seg);
    return s;
  });

  orderOf(num: string): Order | undefined { return this.occupied().get(num); }
  readyOf(o: Order): boolean { return bill.readyCount(o) > 0; }

  ngOnInit() { this.tableApi.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} }); }
  ngOnDestroy() { this.stopPoll(); }

  private startPoll() { this.stopPoll(); this.timer = setInterval(() => this.load(), POLL_MS); }
  private stopPoll() { if (this.timer) clearInterval(this.timer); this.timer = undefined; }

  private load() {
    if (!this.zones().length) this.tableApi.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
    this.orderApi.getActiveOrders().subscribe({ next: o => this.orders.set(o), error: () => {} });
    const today = new Date().toISOString().split('T')[0];
    this.reservationApi.getReservations({ date: today }).subscribe({
      next: r => this.todayResv.set(r.filter(x => ['pending', 'confirmed', 'arrived'].includes(x.status))),
      error: () => {},
    });
  }
}