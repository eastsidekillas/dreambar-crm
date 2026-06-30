import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { OrderApi } from '../../../entities/order';
import { TableApi, tableSegments } from '../../../entities/table';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui';
import { Order, OrderItem, Receipt, Zone, MenuItem, MenuItemModifierGroup } from '../../../core/models';
import { RefreshService } from '../../../core/services/refresh.service';
import { MenuApi } from '../../../entities/menu';
import { MoveTableSheet } from './move-table-sheet';
import { SplitGuestSheet } from './split-guest-sheet';
import { CheckoutSheet } from './checkout-sheet';
import { OrderMenuComponent } from '../../../features/order-menu/order-menu.component';
import { GuestBoardComponent, GuestCard } from '../../../features/guest-board/guest-board.component';
import { OrderItemSheet } from './order-item-sheet';
import { DepositSheet } from './deposit-sheet';
import { AddItemSheet } from './add-item-sheet';
import { GuestMenuSheet, GuestState } from './guest-menu-sheet';
import { GlasswareStepper } from '../../../features/order-glassware/glassware-stepper.component';
import { BdBottomSheetComponent } from '../../../shared/ui';
import { bill, orderStatus as computeOrderStatus } from '../../../entities/order';
import {
  LucideChevronLeft, LucideArrowLeftRight, LucideX, LucideUsers,
  LucideCreditCard, LucideReceipt, LucidePlus, LucideClock,
  LucideCalendar, LucideBanknote, LucideMessageCircle,
  LucideSearch, LucideSend, LucideTrash2,
} from '@lucide/angular';

const POLL_MS = 10_000;

/** Экран заказа стола: карточки гостей. «+» у гостя раскрывает меню (группы → позиции) над поиском. */
@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule, MoveTableSheet, SplitGuestSheet, CheckoutSheet, OrderMenuComponent, GuestBoardComponent,
    OrderItemSheet, AddItemSheet, GuestMenuSheet, GlasswareStepper, DepositSheet, BdBottomSheetComponent,
    LucideChevronLeft, LucideArrowLeftRight, LucideX, LucideUsers,
    LucideCreditCard, LucideReceipt, LucidePlus, LucideClock,
    LucideCalendar, LucideBanknote, LucideMessageCircle,
    LucideSearch, LucideSend, LucideTrash2],
  styles: [`
    @keyframes sheetUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes menuIn  { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
    .sheet-anim { animation: sheetUp .30s cubic-bezier(.22,1,.36,1); }
    .menu-anim  { animation: menuIn .22s ease-out; }
  `],
  template: `
    @if (order(); as o) {
      <!-- ══ Шапка стола (липкая, на той же сетке, что контент) ═══ -->
      <div class="sticky top-0 z-20 pb-2 flex items-center gap-2"
           style="padding-top:calc(0.25rem + env(safe-area-inset-top,0px));background:var(--color-bg)">
        <button (click)="back()" class="flex items-center justify-center rounded-xl flex-shrink-0"
                style="width:38px;height:38px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-muted)">
          <svg lucideChevronLeft [size]="20"></svg>
        </button>
        <div class="flex-1 min-w-0">
          <span class="font-bold text-lg leading-tight truncate block">{{ o.table_number || 'Стол' }}</span>
          <div class="flex items-center gap-1.5 mt-0.5">
            <span class="text-xs flex items-center gap-1" style="color:var(--color-muted)">
              <svg lucideUsers [size]="11"></svg> {{ o.guests || guestCount() }}
            </span>
            @if (orderStatus(); as st) {
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                    [style.color]="st.color" [style.background]="st.bg">{{ st.label }}</span>
            }
          </div>
        </div>
        @if (isEmpty(o)) {
          <button (click)="confirmFree() ? free() : confirmFree.set(true)"
                  [title]="confirmFree() ? 'Ещё раз — удалить стол' : 'Освободить стол'"
                  class="flex items-center justify-center rounded-xl flex-shrink-0"
                  [style]="confirmFree()
                    ? 'width:38px;height:38px;background:var(--color-red);color:white'
                    : 'width:38px;height:38px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-red)'">
            <svg lucideTrash2 [size]="16"></svg>
          </button>
        }
        <button (click)="moveOpen.set(true)" class="flex items-center justify-center rounded-xl flex-shrink-0"
                style="width:38px;height:38px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-muted)">
          <svg lucideArrowLeftRight [size]="16"></svg>
        </button>
      </div>

      <div class="space-y-3 pt-1" style="padding-bottom:84px">

        @if (o.reservation_info; as r) {
          <div class="px-3 py-2 text-xs flex items-center gap-1.5 rounded-xl"
               style="background:#eff6ff;border:1px solid #bfdbfe;color:#1d4ed8">
            <svg lucideCalendar [size]="13" class="flex-shrink-0"></svg>
            <span class="font-medium">{{ r.name }}</span>
            @if (+r.deposit_amount > 0) {
              <span class="ml-auto font-medium flex items-center gap-0.5"><svg lucideBanknote [size]="12"></svg> {{ +r.deposit_amount | number:'1.0-0' }} ₽</span>
            }
          </div>
        }
        @if (o.notes) {
          <div class="px-3 py-2 text-xs flex items-start gap-1.5 rounded-xl"
               style="background:#fffbeb;border:1px solid var(--color-gold-mid);color:#92400e">
            <svg lucideMessageCircle [size]="13" class="flex-shrink-0 mt-0.5"></svg><span>{{ o.notes }}</span>
          </div>
        }

        <!-- ══ Гости (таблица) ══════════════════════════════════ -->
        <guest-board [cards]="guestCards()" [order]="o" [targetGuest]="targetGuest()"
                     (add)="startAdd($event)" (menu)="guestMenu.set($event)" (itemTap)="openItem($event)" />

        <!-- Посуда к столу — НЕ в счёте, подсказка сколько нести -->
        <glassware-stepper [order]="o" (change)="setGlass($event.kind, $event.count)" />

        <!-- Депозит стола: живой расчёт (счёт − депозит = к доплате / остаток) -->
        @if (depositAvail() > 0) {
          <button (click)="depositSheet.set(true)"
                  class="w-full text-left px-3 py-2.5 rounded-xl"
                  style="background:var(--color-gold-light);border:1.5px solid var(--color-gold-mid);color:var(--color-gold-hover)">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <svg lucideBanknote [size]="16" class="flex-shrink-0"></svg>
              <span>Депозит стола</span>
              <span class="ml-auto font-bold">{{ depositAvail() | number:'1.0-0' }} ₽</span>
            </div>
            <div class="flex items-center justify-between text-xs mt-1.5" style="color:var(--color-muted)">
              <span>Счёт {{ orderSum() | number:'1.0-0' }} ₽</span>
              @if (depositLeftLive() > 0) {
                <span style="color:var(--color-gold-hover)">Остаток депозита {{ depositLeftLive() | number:'1.0-0' }} ₽</span>
              } @else {
                <span class="font-bold" style="color:var(--color-text)">К доплате {{ toPayLive() | number:'1.0-0' }} ₽</span>
              }
            </div>
          </button>
        } @else {
          <button (click)="depositSheet.set(true)"
                  class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
                  style="background:var(--color-surface);border:1.5px solid var(--color-border);color:var(--color-muted)">
            <svg lucideBanknote [size]="16" class="flex-shrink-0"></svg>
            <span>Внести депозит</span>
            <span class="ml-auto" style="font-size:1.2rem;line-height:1">＋</span>
          </button>
        }

        @if (o.receipts.length) {
          <div class="flex flex-wrap gap-1.5">
            @for (r of o.receipts; track r.id) {
              <button (click)="reprint(r)" class="badge badge-green flex items-center gap-1" style="cursor:pointer">
                <svg lucideReceipt [size]="12"></svg> {{ r.code }} · {{ r.total | number:'1.0-0' }} ₽
              </button>
            }
          </div>
        }

      </div>

      <!-- ══ Нижняя панель-шторка: поиск · разделы · категории → позиции ═ -->
      <div class="fixed inset-x-0 bottom-0 z-30 sheet-anim"
           style="background:var(--color-surface);border-radius:20px 20px 0 0;box-shadow:0 -8px 28px rgba(0,0,0,0.14);padding-bottom:env(safe-area-inset-bottom)">

        <!-- + Гость — над шторкой (двигается вместе со шторкой) -->
        <div class="absolute inset-x-0 flex justify-center" style="bottom:100%;padding-bottom:10px;pointer-events:none">
          <button (click)="addGuest()"
                  class="flex items-center gap-1.5 px-5 py-2 rounded-full font-semibold text-sm"
                  style="pointer-events:auto;background:var(--color-gold-light);border:1.5px solid var(--color-gold-mid);color:var(--color-gold-hover);box-shadow:0 4px 14px rgba(0,0,0,0.14)">
            <svg lucidePlus [size]="16"></svg> Гость
          </button>
        </div>

        <!-- хваталка -->
        <div class="flex justify-center pt-2 pb-1">
          <div class="w-9 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <!-- Поиск позиций -->
        <div class="px-3 pt-1 pb-2 flex items-center gap-2">
          <div class="relative flex-1">
            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none flex items-center" style="color:var(--color-muted)">
              <svg lucideSearch [size]="16"></svg>
            </span>
            <input [value]="search()" (input)="onSearch($event)" (focus)="onSearchFocus()"
                   placeholder="Поиск позиций" class="field"
                   style="padding-left:2.5rem;min-height:46px;border-radius:999px" />
          </div>
          <!-- Меню закрыто: есть неотправленные → отправить; всё отправлено → счёт. Открыто → закрыть. -->
          @if (targetGuest() === null) {
            @if (hasUnsent()) {
              <button (click)="printSheet.set(true)" title="Отправить на печать"
                      class="flex items-center justify-center rounded-full flex-shrink-0 text-white"
                      style="width:46px;height:46px;background:var(--color-gold)">
                <svg lucideSend [size]="19"></svg>
              </button>
            } @else {
              <button (click)="checkoutOpen.set(true)" title="Счёт"
                      class="flex items-center justify-center rounded-full flex-shrink-0 text-white"
                      style="width:46px;height:46px;background:var(--color-gold)">
                <svg lucideCreditCard [size]="18"></svg>
              </button>
            }
          } @else {
            <button (click)="stopAdd()" title="Закрыть меню"
                    class="flex items-center justify-center rounded-full flex-shrink-0"
                    style="width:46px;height:46px;background:var(--color-bg);border:1.5px solid var(--color-border);color:var(--color-muted)">
              <svg lucideX [size]="20"></svg>
            </button>
          }
        </div>

        @if (targetGuest() !== null) {
          <order-menu class="menu-anim block" [search]="search()" (pick)="addItem($event)" />
        }
      </div>
    } @else {
      <div class="text-center py-20">
        <svg lucideClock [size]="40" class="mx-auto mb-2" style="color:var(--color-muted)"></svg>
        <p style="color:var(--color-muted)">Загрузка стола…</p>
      </div>
    }

    <!-- ── Модалки ──────────────────────────────────────────── -->
    @if (depositSheet() && order(); as dep) {
      <deposit-sheet [deposit]="{ amount: dep.deposit_amount, method: dep.deposit_method }" [saving]="savingDeposit()"
                     (save)="saveDeposit($event)" (closed)="depositSheet.set(false)" />
    }
    @if (moveOpen() && order(); as mo) {
      <move-table-sheet [order]="mo" [zones]="zones()" [occupiedByOthers]="occupied()"
                        (moved)="onUpdated($event); moveOpen.set(false)" (closed)="moveOpen.set(false)" />
    }
    @if (checkoutOpen() && order(); as co) {
      <checkout-sheet [order]="co" (done)="onCheckoutDone()" (closed)="checkoutOpen.set(false)" />
    }

    <!-- ══ Добавление позиции с модификаторами ══════════════════ -->
    @if (addTarget(); as at) {
      <add-item-sheet [item]="at.item" [groups]="at.groups" [saving]="addingItem()"
                      (add)="confirmAddItem($event)" (closed)="addTarget.set(null)" />
    }

    <!-- ══ Редактирование позиции (тап по позиции) ══════════════ -->
    @if (editItem(); as it) {
      <order-item-sheet [item]="it" [guests]="itemGuestOptions()" [saving]="savingItem()"
                        (save)="saveItem($event)" (delete)="deleteItemFromSheet()" (closed)="editItem.set(null)" />
    }

    <!-- ══ Меню гостя (по «…») ═══════════════════════════════════ -->
    @if (guestMenu() !== null) {
      <guest-menu-sheet [label]="gLabel(guestMenu()!)" [currentName]="gName(guestMenu()!)"
                        [state]="guestState(guestMenu()!)"
                        (rename)="saveRename($event)" (precheck)="printPrecheck(guestMenu()!)"
                        (split)="openSplit(guestMenu()!)" (delete)="deleteGuest(guestMenu()!)"
                        (closed)="closeGuestMenu()" />
    }

    <!-- ══ Перенос гостя на свободный стол (новый заказ) ════════ -->
    @if (splitGuestNo() !== null && order(); as so) {
      <split-guest-sheet [order]="so" [guestLabel]="gLabel(splitGuestNo()!)" [zones]="zones()"
                         [occupied]="occupied()" [saving]="splittingGuest()"
                         (picked)="doSplitGuest($event)" (closed)="splitGuestNo.set(null)" />
    }

    <!-- ══ Шторка «Отправить на печать» ══════════════════════════ -->
    @if (printSheet()) {
      <bd-bottom-sheet title="Отправить на печать" (closed)="printSheet.set(false)">
        <div class="px-4 pt-1 pb-5 space-y-2">
          <button (click)="sendToPrint()"
                  class="w-full flex items-center justify-center gap-2 rounded-xl font-bold text-white"
                  style="height:52px;background:var(--color-gold)">
            <svg lucideSend [size]="18"></svg> Отправить
          </button>
          <button (click)="openCheckout()"
                  class="w-full flex items-center justify-center gap-2 rounded-xl font-bold"
                  style="height:52px;color:var(--color-gold-hover);background:var(--color-gold-light);border:1.5px solid var(--color-gold-mid)">
            <svg lucideReceipt [size]="18"></svg> Расчёт
          </button>
        </div>
      </bd-bottom-sheet>
    }
  `,
})
export class OrderPage implements OnInit, OnDestroy {
  private orderApi = inject(OrderApi);
  private menuApi = inject(MenuApi);
  private tableApi = inject(TableApi);
  private printer = inject(ReceiptPrintService);
  private toast  = inject(ToastService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  order = signal<Order | null>(null);
  zones = signal<Zone[]>([]);

  moveOpen     = signal(false);
  splitGuestNo   = signal<number | null>(null);   // гость, которого переносим на свободный стол
  splittingGuest = signal(false);
  checkoutOpen = signal(false);
  printSheet   = signal(false);
  depositSheet = signal(false);
  savingDeposit = signal(false);
  guestMenu       = signal<number | null>(null);   // открытое меню «…» гостя
  editItem        = signal<OrderItem | null>(null);  // редактируемая позиция (кол-во/коммент)
  savingItem      = signal(false);
  confirmFree     = signal(false);
  private extraGuests = signal(0);

  // Инлайн-меню снизу (содержимое — в <order-menu>)
  targetGuest = signal<number | null>(null);   // кому добавляем (после «+»)
  search      = signal('');
  // Шторка выбора модификаторов при добавлении позиции
  addTarget   = signal<{ item: MenuItem; groups: MenuItemModifierGroup[]; guest: number } | null>(null);
  addingItem  = signal(false);

  private orderId = 0;
  private firstLoad = true;
  private pollTimer?: ReturnType<typeof setInterval>;
  private pollBusy = false;
  private allOrders = signal<Order[]>([]);

  /** Столы, занятые другими — для шторки пересадки. */
  occupied = computed<Set<string>>(() => {
    const mineId = this.orderId;
    const occ = new Set<string>();
    for (const ord of this.allOrders()) {
      if (ord.id === mineId) continue;
      for (const t of tableSegments(ord.table_number)) occ.add(t);
    }
    return occ;
  });

  // утилита счёта в шаблон
  isEmpty = bill.isEmpty;

  /** Карточки гостей: 0 (Общий) — только если на нём есть позиции; затем 1..N. */
  guestCards = computed<GuestCard[]>(() => {
    const o = this.order();
    if (!o) return [];
    const items = bill.unpaidItems(o);
    const maxItem = items.reduce((m, i) => Math.max(m, i.guest_no), 0);
    const n = Math.max(o.guests ?? 0, maxItem, this.extraGuests(), 1);
    const nums: number[] = [];
    if (items.some(i => i.guest_no === 0)) nums.push(0);
    for (let g = 1; g <= n; g++) nums.push(g);
    return nums.map(guest => {
      const its = items.filter(i => i.guest_no === guest);
      return { guest, items: its, total: its.reduce((s, i) => s + +i.subtotal, 0) };
    });
  });
  /** Кол-во гостей (без «Общего») — для подписи в шапке. */
  guestCount = computed(() => this.guestCards().filter(g => g.guest > 0).length);

  /** Куда можно переписать позицию: только гости 1..N («Общий» — не цель). */
  itemGuestOptions = computed<{ no: number; label: string }[]>(() => {
    const n = this.guestCards().reduce((m, c) => Math.max(m, c.guest), 0);
    const opts: { no: number; label: string }[] = [];
    for (let g = 1; g <= n; g++) opts.push({ no: g, label: this.gLabel(g) });
    return opts;
  });

  // ── Живой расчёт депозита (видно сразу на экране заказа, не только в чеке) ──
  /** Текущий неоплаченный счёт стола. */
  orderSum = computed(() => { const o = this.order(); return o ? bill.unpaidTotal(o) : 0; });
  /** Доступный депозит = депозит брони (если оплачен) + депозит заказа − уже списано. */
  depositAvail = computed(() => {
    const o = this.order(); if (!o) return 0;
    const resv = o.reservation_info?.deposit_paid ? +o.reservation_info.deposit_amount : 0;
    const used = (o.receipts ?? []).reduce((s, r) => s + (+r.deposit_amount || 0), 0);
    return Math.max(0, resv + (+o.deposit_amount || 0) - used);
  });
  /** Сколько доплатить деньгами с учётом депозита. */
  toPayLive = computed(() => Math.max(0, this.orderSum() - this.depositAvail()));
  /** Остаток депозита, если он покрывает счёт. */
  depositLeftLive = computed(() => Math.max(0, this.depositAvail() - this.orderSum()));

  /** Есть неотправленные (черновые) позиции — их ещё не видят на кухне/баре. */
  hasUnsent = computed(() => {
    const o = this.order();
    return !!o && bill.unpaidItems(o).some(i => i.is_sent === false);
  });

  /** Статус заказа целиком: Новый заказ / Отправлен / Готовится / Готов / Оплачен. */
  orderStatus = computed(() => {
    const o = this.order();
    return o ? computeOrderStatus(o) : null;
  });

  private refreshSvc = inject(RefreshService);
  private readonly onPullRefresh = () => { this.pollBusy = false; this.load(() => this.refreshSvc.done()); };

  ngOnInit() {
    this.orderId = Number(this.route.snapshot.paramMap.get('id')) || 0;
    this.tableApi.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
    this.load();
    this.pollTimer = setInterval(() => this.load(), POLL_MS);
    this.refreshSvc.register(this.onPullRefresh);
  }
  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.refreshSvc.unregister(this.onPullRefresh);
  }

  private load(done?: () => void) {
    if (this.pollBusy) { done?.(); return; }
    this.pollBusy = true;
    this.orderApi.getActiveOrders().subscribe({
      next: list => {
        this.pollBusy = false;
        done?.();
        this.allOrders.set(list);
        const o = list.find(x => x.id === this.orderId) ?? null;
        if (!o) {                       // закрыт/освобождён — выходим к плану зала
          if (!this.firstLoad) { this.toast.info('Стол закрыт'); }
          this.router.navigate(['/waiter/tables']);
          return;
        }
        this.order.set(o);
        if (this.firstLoad) {
          this.firstLoad = false;
          // При создании стола (?seg=menu) сразу включаем добавление первому гостю.
          if (this.route.snapshot.queryParamMap.get('seg') === 'menu') this.startAdd(o.guests ? 1 : 0);
        }
      },
      error: () => { this.pollBusy = false; done?.(); },
    });
  }

  back() { this.router.navigate(['/waiter/tables']); }

  // ── Инлайн-меню ───────────────────────────────────────────────────
  startAdd(guest: number) { this.targetGuest.set(guest); this.search.set(''); }
  stopAdd() { this.targetGuest.set(null); this.search.set(''); }
  onSearchFocus() { if (this.targetGuest() === null) this.targetGuest.set(1); }
  onSearch(e: Event) { this.search.set((e.target as HTMLInputElement).value); }

  addItem(it: MenuItem) {
    if (it.is_out_of_stock) return;
    const g = this.targetGuest() ?? 0;
    if (!it.has_modifiers) { this.addToOrder(it, g, 1, []); return; }
    // У позиции есть модификаторы — грузим группы и открываем шторку выбора.
    this.menuApi.getItemModifierGroups(it.id).subscribe({
      next: groups => groups.length
        ? this.addTarget.set({ item: it, groups, guest: g })
        : this.addToOrder(it, g, 1, []),
      error: () => this.addToOrder(it, g, 1, []),   // не загрузилось — добавим без модификаторов
    });
  }
  /** Подтверждение из шторки выбора модификаторов. */
  confirmAddItem(payload: { quantity: number; modifierIds: number[] }) {
    const t = this.addTarget();
    if (!t || this.addingItem()) return;
    this.addingItem.set(true);
    this.orderApi.addItemToOrder(this.orderId, t.item.id, payload.quantity, t.guest, payload.modifierIds,
      { name: t.item.name, price: t.item.price, type: t.item.category_type }).subscribe({
      next: updated => {
        this.addingItem.set(false);
        this.addTarget.set(null);
        this.onUpdated(updated);
        this.toast.show(`${t.item.name} → ${this.gLabel(t.guest)}`, 'success', 1200);
      },
      error: err => { this.addingItem.set(false); this.toast.apiError(err, 'Не удалось добавить позицию'); },
    });
  }
  private addToOrder(it: MenuItem, guest: number, qty: number, modifierIds: number[]) {
    // То же блюдо без модификаторов и без комментария, ещё не отправленное тому же
    // гостю — наращиваем количество существующей позиции, а не плодим новую.
    // (С модификаторами не сливаем: разные добавки = разный напиток; отправленное
    //  на бар/кухню не трогаем, чтобы не менять уже принятую позицию.)
    if (!modifierIds.length) {
      const existing = this.order()?.items.find(x =>
        x.menu_item === it.id && x.guest_no === guest && x.is_sent === false && !x.comment);
      if (existing) {
        const total = existing.quantity + qty;
        this.orderApi.updateOrderItem(this.orderId, existing.id, { quantity: total }).subscribe({
          next: updated => {
            this.onUpdated(updated);
            this.toast.show(`${it.name} ×${total} → ${this.gLabel(guest)}`, 'success', 1200);
          },
          error: err => this.toast.apiError(err, 'Не удалось добавить позицию'),
        });
        return;
      }
    }
    this.orderApi.addItemToOrder(this.orderId, it.id, qty, guest, modifierIds,
      { name: it.name, price: it.price, type: it.category_type }).subscribe({
      next: updated => {
        this.onUpdated(updated);
        this.toast.show(`${it.name} → ${this.gLabel(guest)}`, 'success', 1200);
      },
      error: err => this.toast.apiError(err, 'Не удалось добавить позицию'),
    });
  }

  // ── Гости ─────────────────────────────────────────────────────────
  addGuest() {
    const maxG = this.guestCards().reduce((m, g) => Math.max(m, g.guest), 0);
    const next = maxG + 1;
    this.extraGuests.set(next);
    this.startAdd(next);
  }
  // ── Редактирование позиции (тап по позиции) ───────────────────────
  openItem(item: OrderItem) { this.editItem.set(item); }
  saveItem(patch: { quantity: number; comment: string; guest: number }) {
    const it = this.editItem();
    if (!it || this.savingItem()) return;
    this.savingItem.set(true);
    const guestChanged = patch.guest !== it.guest_no;
    this.orderApi.updateOrderItem(this.orderId, it.id, { quantity: patch.quantity, comment: patch.comment }).subscribe({
      next: u => {
        if (!guestChanged) { this.finishSaveItem(u); return; }
        // Гость сменился — переписываем позицию (отдельный эндпоинт).
        this.orderApi.setItemGuest(this.orderId, it.id, patch.guest).subscribe({
          next: u2 => {
            this.finishSaveItem(u2);
            this.toast.show(`${it.menu_item_name} → ${this.gLabel(patch.guest)}`, 'success', 1200);
          },
          error: err => { this.savingItem.set(false); this.toast.apiError(err, 'Не удалось перенести позицию'); },
        });
      },
      error: err => { this.savingItem.set(false); this.toast.apiError(err, 'Не удалось сохранить позицию'); },
    });
  }
  private finishSaveItem(u: Order) { this.savingItem.set(false); this.onUpdated(u); this.editItem.set(null); }
  deleteItemFromSheet() {
    const it = this.editItem();
    if (!it) return;
    this.editItem.set(null);
    this.orderApi.removeItemFromOrder(this.orderId, it.id).subscribe({
      next: u => { this.onUpdated(u); this.toast.success('Позиция удалена'); },
      error: () => this.toast.error('Не удалось удалить позицию'),
    });
  }

  // ── Меню гостя («…») ──────────────────────────────────────────────
  /** Подпись гостя с учётом пользовательского имени (Order.guest_names). */
  gLabel(guest: number): string {
    if (guest === 0) return 'Общий';
    return this.order()?.guest_names?.[String(guest)] || `Гость ${guest}`;
  }
  closeGuestMenu() { this.guestMenu.set(null); }
  /** Текущее имя гостя (для подстановки в поле переименования). */
  gName(guest: number): string { return this.order()?.guest_names?.[String(guest)] ?? ''; }

  saveRename(name: string) {
    const g = this.guestMenu();
    if (g == null) return;
    this.orderApi.renameGuest(this.orderId, g, name).subscribe({
      next: u => { this.onUpdated(u); this.closeGuestMenu(); this.toast.success('Имя обновлено'); },
      error: err => this.toast.apiError(err, 'Не удалось переименовать'),
    });
  }
  /** Состояние гостя для меню: пусто / активен (позиции не готовы) / готов (всё готово). */
  guestState(guest: number): GuestState {
    const items = this.guestCards().find(g => g.guest === guest)?.items ?? [];
    if (!items.length) return 'empty';
    if (items.every(i => i.kitchen_status === 'ready')) return 'ready';
    return 'active';
  }
  printPrecheck(guest: number) {
    this.orderApi.printPrecheck(this.orderId, guest).subscribe({
      next: () => { this.closeGuestMenu(); this.toast.success('Счёт отправлен на печать'); },
      error: err => this.toast.apiError(err, 'Не удалось напечатать счёт'),
    });
  }
  /** Открыть выбор свободного стола для переноса гостя в новый заказ. */
  openSplit(guest: number) { this.splitGuestNo.set(guest); this.closeGuestMenu(); }
  /** Перенести позиции гостя в новый заказ на выбранном свободном столе. */
  doSplitGuest(tableNumber: string) {
    const guest = this.splitGuestNo();
    if (guest == null || this.splittingGuest()) return;
    this.splittingGuest.set(true);
    this.orderApi.splitGuest(this.orderId, guest, tableNumber).subscribe({
      next: res => {
        this.splittingGuest.set(false);
        this.splitGuestNo.set(null);
        this.onUpdated(res.order);
        this.trimGuestSlots();          // перенесённый гость опустел — убрать его слот
        this.toast.success(`Гость перенесён на стол ${tableNumber}`);
      },
      error: err => { this.splittingGuest.set(false); this.toast.apiError(err, 'Не удалось перенести'); },
    });
  }
  /** Удалить гостя: активного — снять все его позиции; пустого — убрать слот. */
  deleteGuest(guest: number) {
    this.closeGuestMenu();
    const cards = this.guestCards();
    const card = cards.find(g => g.guest === guest);
    if (!card) return;
    if (card.items.length) {                       // активный гость — снять позиции
      this.removeItemsSeq(card.items.map(i => i.id), guest);
      return;
    }
    // пустой гость — убрать слот
    this.trimGuestSlots();
    this.toast.success(`${this.gLabel(guest)} удалён`);
  }
  /** Снять освободившийся (пустой) слот гостя: уменьшить число гостей до фактического,
   * но не ниже макс. гостя, у которого ещё есть позиции. Один вызов убирает один хвостовой слот. */
  private trimGuestSlots() {
    const cards = this.guestCards();
    const maxWithItems = cards.filter(c => c.items.length).reduce((m, c) => Math.max(m, c.guest), 0);
    const displayed = cards.filter(c => c.guest > 0).length;
    const newCount = Math.max(maxWithItems, displayed - 1);
    this.extraGuests.set(newCount);
    const o = this.order();
    if (o && (o.guests ?? 0) > newCount) {
      this.orderApi.updateOrder(this.orderId, { guests: newCount }).subscribe({
        next: u => this.onUpdated(u),
        error: err => this.toast.apiError(err, 'Не удалось обновить число гостей'),
      });
    }
  }
  private removeItemsSeq(ids: number[], guest: number) {
    if (!ids.length) { this.toast.success(`${this.gLabel(guest)} удалён`); return; }
    const [first, ...rest] = ids;
    this.orderApi.removeItemFromOrder(this.orderId, first).subscribe({
      next: updated => { this.onUpdated(updated); this.removeItemsSeq(rest, guest); },
      error: () => this.toast.error('Не удалось удалить позицию'),
    });
  }

  onUpdated(updated: Order) { this.order.set(updated); }
  onCheckoutDone() { this.checkoutOpen.set(false); this.load(); }

  // ── Шторка «Отправить на печать» ──────────────────────────────────
  /** Отправить черновые позиции на кухню/бар. */
  sendToPrint() {
    this.orderApi.sendOrder(this.orderId).subscribe({
      next: res => { this.onUpdated(res.order); this.printSheet.set(false); this.toast.success('Заказ отправлен на кухню'); },
      error: err => this.toast.apiError(err, 'Не удалось отправить заказ'),
    });
  }
  openCheckout() { this.printSheet.set(false); this.checkoutOpen.set(true); }

  setGlass(code: string, count: number) {
    if (count < 0) count = 0;
    this.orderApi.setGlassware(this.orderId, code, count).subscribe({
      next: updated => this.onUpdated(updated),
      error: err => this.toast.apiError(err, 'Не удалось обновить посуду'),
    });
  }

  saveDeposit(payload: { amount: number; method: string }) {
    if (this.savingDeposit()) return;
    this.savingDeposit.set(true);
    this.orderApi.setDeposit(this.orderId, payload.amount, payload.method).subscribe({
      next: updated => {
        this.savingDeposit.set(false);
        this.onUpdated(updated);
        this.depositSheet.set(false);
        this.toast.success(payload.amount > 0 ? 'Депозит внесён' : 'Депозит снят');
      },
      error: err => { this.savingDeposit.set(false); this.toast.apiError(err, 'Не удалось сохранить депозит'); },
    });
  }

  free() {
    this.orderApi.deleteOrder(this.orderId).subscribe({
      next: () => { this.toast.success('Стол освобождён'); this.router.navigate(['/waiter/tables']); },
      error: err => this.toast.apiError(err, 'Не удалось освободить стол'),
    });
  }
  reprint(r: Receipt) { this.printer.printHardware(r); }
}
