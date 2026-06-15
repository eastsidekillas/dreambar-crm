import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OrderApi } from '../../../entities/order';
import { ReservationApi } from '../../../entities/reservation';
import { TableApi } from '../../../entities/table';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../features/cart/cart.service';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Order, OrderItem, Receipt, Zone, Reservation } from '../../../core/models';
import { OrderCard } from '../tables/order-card';
import { EditOrderModal } from '../tables/edit-order-modal';
import { MoveTableSheet } from '../tables/move-table-sheet';
import { CheckoutSheet } from '../tables/checkout-sheet';
import { LucideUtensilsCrossed } from '@lucide/angular';

const POLL_MS = 10_000;

/** Страница «Заказы»: мои открытые столы со списком позиций и действиями. */
@Component({
  selector: 'app-orders-page',
  standalone: true,
  imports: [CommonModule, OrderCard, EditOrderModal, MoveTableSheet, CheckoutSheet, LucideUtensilsCrossed],
  template: `
    <div class="space-y-3 pb-4">
      @for (o of myOrders(); track o.id) {
        <order-card [order]="o" [reservation]="orderReservation(o)"
                    (edit)="openEdit(o)" (addMore)="addMore(o)" (move)="openMoveSheet(o)"
                    (checkout)="openCheckout(o)" (removeItem)="removeItem(o, $event)"
                    (free)="freeTable(o)" (reprint)="reprint($event)" />
      }

      @if (!myOrders().length) {
        <div class="text-center py-16">
          <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Нет открытых столов</p>
          <p class="text-xs mt-1" style="color:var(--color-light)">Открой стол на вкладке «Столы»</p>
        </div>
      }
    </div>

    @if (editOrder(); as eo) {
      <edit-order-modal [order]="eo" (saved)="onEditSaved($event)" (closed)="closeEdit()" />
    }
    @if (moveOrder(); as mo) {
      <move-table-sheet [order]="mo" [zones]="zones()" [occupiedByOthers]="moveOccupied()"
                        (moved)="onMoved($event)" (closed)="closeMoveSheet()" />
    }
    @if (checkout(); as co) {
      <checkout-sheet [order]="co" (done)="onCheckoutDone()" (closed)="closeCheckout()" />
    }
  `,
})
export class OrdersPage implements OnInit, OnDestroy {
  private orderApi = inject(OrderApi);
  private reservationApi = inject(ReservationApi);
  private tableApi = inject(TableApi);
  private auth   = inject(AuthService);
  private cart   = inject(CartService);
  private printer = inject(ReceiptPrintService);
  private toast  = inject(ToastService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  orders = signal<Order[]>([]);
  zones  = signal<Zone[]>([]);
  todayReservations = signal<Reservation[]>([]);

  editOrder = signal<Order | null>(null);
  moveOrder = signal<Order | null>(null);
  checkout  = signal<Order | null>(null);

  currentUserId = computed(() => this.auth.user()?.id);
  myOrders = computed(() => this.orders().filter(o => o.waiter === this.currentUserId()));

  /** Столы, занятые ДРУГИМИ заказами — для шторки пересадки. */
  moveOccupied = computed<Set<string>>(() => {
    const o = this.moveOrder();
    const occ = new Set<string>();
    if (!o) return occ;
    const mine = new Set(this.orderTables(o));
    for (const ord of this.orders())
      for (const t of this.orderTables(ord))
        if (!mine.has(t)) occ.add(t);
    return occ;
  });

  private pollTimer?: ReturnType<typeof setInterval>;
  private pollBusy = false;
  private scrollToId: number | null = null;

  ngOnInit() {
    this.scrollToId = Number(this.route.snapshot.queryParamMap.get('order')) || null;
    this.load();
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
      next: o => {
        this.pollBusy = false;
        this.orders.set(o);
        if (this.scrollToId) {
          const id = this.scrollToId; this.scrollToId = null;
          setTimeout(() => document.getElementById('order-' + id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
        }
      },
      error: () => { this.pollBusy = false; },
    });
  }

  private orderTables(o: Order): string[] {
    return o.table_number.split('+').map(s => s.trim()).filter(Boolean);
  }
  tableReservation(num: string): Reservation | null {
    return this.todayReservations().find(r => r.table_number === num) ?? null;
  }
  orderReservation(o: Order): Reservation | null {
    for (const t of this.orderTables(o)) {
      const r = this.tableReservation(t);
      if (r) return r;
    }
    return null;
  }

  // ── Actions ───────────────────────────────────────────────────────
  openEdit(o: Order) { this.editOrder.set(o); }
  closeEdit() { this.editOrder.set(null); }
  onEditSaved(updated: Order) { this.replaceOrder(updated); this.closeEdit(); }

  openMoveSheet(o: Order) { this.moveOrder.set(o); }
  closeMoveSheet() { this.moveOrder.set(null); }
  onMoved(updated: Order) { this.replaceOrder(updated); this.closeMoveSheet(); }

  openCheckout(o: Order) { this.checkout.set(o); }
  closeCheckout() { this.checkout.set(null); }
  onCheckoutDone() { this.closeCheckout(); this.load(); }

  removeItem(o: Order, item: OrderItem) {
    this.orderApi.removeItemFromOrder(o.id, item.id).subscribe({
      next: updated => this.replaceOrder(updated),
      error: () => this.toast.error('Не удалось удалить позицию'),
    });
  }
  freeTable(o: Order) {
    this.orderApi.deleteOrder(o.id).subscribe({
      next: () => {
        this.orders.update(list => list.filter(x => x.id !== o.id));
        this.toast.success('Стол освобождён');
      },
      error: err => this.toast.apiError(err, 'Не удалось освободить стол'),
    });
  }
  addMore(o: Order) { this.cart.setTarget(o); this.router.navigate(['/waiter/order']); }
  reprint(r: Receipt) { this.printer.printHardware(r); }

  private replaceOrder(updated: Order) {
    this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
  }
}