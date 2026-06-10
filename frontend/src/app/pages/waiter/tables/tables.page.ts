import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/services/auth.service';
import { CartService } from '../../../features/cart/cart.service';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Order, OrderItem, PaymentMethod, Receipt, ReservationInfo, Zone, Reservation } from '../../../core/models';
import {
  LucideDynamicIcon,
  LucideCalendar, LucideUsers, LucideMessageCircle, LucideArmchair,
  LucideBanknote, LucideCreditCard, LucideSmartphone,
  LucideCheck, LucideClock, LucideX, LucideReceipt, LucidePencil,
  LucidePlus, LucideArrowLeftRight,
  LucideUtensilsCrossed, LucideTriangleAlert,
} from '@lucide/angular';

const PAYMENTS: { value: PaymentMethod; label: string; icon: LucideIconInput }[] = [
  { value: 'cash',     label: 'Наличные', icon: LucideBanknote },
  { value: 'card',     label: 'Карта',    icon: LucideCreditCard },
  { value: 'transfer', label: 'Перевод',  icon: LucideSmartphone },
];

const POLL_MS = 10_000;

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDynamicIcon,
    LucideCalendar, LucideUsers, LucideMessageCircle, LucideArmchair,
    LucideBanknote, LucideCreditCard,
    LucideCheck, LucideClock, LucideX, LucideReceipt, LucidePencil,
    LucidePlus, LucideArrowLeftRight,
    LucideUtensilsCrossed, LucideTriangleAlert],
  template: `
    <div class="space-y-3 pb-4">

      <!-- ══ ZONE GRID ═══════════════════════════════════════════════ -->
      @if (zones().length) {
        <!-- Zone tabs -->
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

        <!-- Table grid -->
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
                          [style]="tableCardStyle(status)">
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
      }

      <!-- ══ ACTIONS BAR ═════════════════════════════════════════════ -->
      <div class="flex gap-2">
        <button (click)="openNewTable()" class="btn btn-primary" style="flex:1;height:44px;font-size:0.9rem">
          ＋ Открыть стол
          @if (myOrders().length) {
            <span class="text-xs font-normal opacity-70">· {{ myOrders().length }}</span>
          }
        </button>
        @if (todayReservations().length) {
          <button (click)="resvSheet.set(true)"
                  class="flex items-center gap-1.5 px-3 rounded-xl font-semibold text-sm flex-shrink-0"
                  style="background:#eff6ff;color:#1d4ed8;border:1.5px solid #93c5fd;height:44px">
            <svg lucideCalendar [size]="16"></svg> {{ todayReservations().length }}
          </button>
        }
      </div>

      <!-- ══ MY ORDERS ═══════════════════════════════════════════════ -->
      @for (o of myOrders(); track o.id) {
        <div class="overflow-hidden" [id]="'order-' + o.id"
             style="background:white;border:1px solid var(--color-border);border-radius:12px">

          <div class="flex items-center justify-between px-3 py-2.5"
               style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-bold text-base truncate">{{ o.table_number || 'Стол' }}</span>
              @if (o.guests) {
                <span class="text-xs flex items-center gap-0.5 flex-shrink-0" style="color:var(--color-muted)">· <svg lucideUsers [size]="12"></svg> {{ o.guests }}</span>
              }
              @if (readyCount(o) > 0) {
                <span class="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold animate-pulse flex items-center gap-0.5"
                      style="background:#16a34a;color:white"><svg lucideCheck [size]="10"></svg> {{ readyCount(o) }}</span>
              }
              <button (click)="openEdit(o)" class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
                      style="color:var(--color-muted)"><svg lucidePencil [size]="14"></svg></button>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs" style="color:var(--color-muted)">{{ elapsed(o) }}</span>
              <span class="font-bold text-sm" style="color:var(--color-gold-hover)">
                {{ unpaidTotal(o) | number:'1.0-0' }} ₽
              </span>
            </div>
          </div>

          @if (o.notes) {
            <div class="px-3 py-2 text-xs flex items-start gap-1.5"
                 style="background:#fffbeb;border-bottom:1px solid var(--color-gold-mid);color:#92400e">
              <svg lucideMessageCircle [size]="12" class="flex-shrink-0 mt-0.5"></svg><span>{{ o.notes }}</span>
            </div>
          }

          @if (orderReservation(o)) {
            @let r = orderReservation(o)!;
            <div class="px-3 py-2 text-xs flex items-center gap-1.5"
                 style="background:#eff6ff;border-bottom:1px solid #bfdbfe;color:#1d4ed8">
              <svg lucideCalendar [size]="12" class="flex-shrink-0"></svg>
              <span class="font-medium">{{ r.name }}</span>
              <span style="color:#3b82f6">{{ r.time_start }}</span>
              <span class="flex items-center gap-0.5">· <svg lucideUsers [size]="12"></svg> {{ r.guests_count }}</span>
              @if (+r.deposit_amount > 0) {
                <span class="ml-auto font-medium flex items-center gap-0.5"><svg lucideBanknote [size]="12"></svg> {{ +r.deposit_amount | number:'1.0-0' }} ₽</span>
              }
            </div>
          }

          @if (unpaidItems(o).length) {
            @for (grp of guestGroups(o); track grp.guest) {
              <div class="px-3 py-2" style="border-bottom:1px solid var(--color-border)">
                <div class="flex items-center justify-between mb-1">
                  <span class="section-title">{{ guestLabel(grp.guest) }}</span>
                  <span class="text-xs font-bold" style="color:var(--color-gold-hover)">
                    {{ grp.total | number:'1.0-0' }} ₽
                  </span>
                </div>
                @for (item of grp.items; track item.id) {
                  <div class="flex items-center gap-2 py-0.5">
                    <span class="flex-1 text-sm truncate">{{ item.menu_item_name }}</span>
                    <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                    @if (item.kitchen_status === 'ready') {
                      <svg lucideCheck [size]="12" style="color:#16a34a;flex-shrink:0"></svg>
                    } @else if (item.kitchen_status === 'cooking') {
                      <svg lucideClock [size]="12" style="color:var(--color-amber);flex-shrink:0"></svg>
                    }
                    @if (confirmDeleteItem() === item.id) {
                      <button (click)="removeItem(o, item)"
                              class="text-xs font-bold px-1.5 py-0.5 rounded"
                              style="background:#ef4444;color:white">Да</button>
                      <button (click)="confirmDeleteItem.set(null)"
                              class="text-xs px-1.5 py-0.5 rounded"
                              style="background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)">Нет</button>
                    } @else {
                      <button (click)="askDeleteItem(item)"
                              class="w-5 h-5 flex items-center justify-center rounded text-xs flex-shrink-0"
                              style="color:var(--color-muted)"><svg lucideX [size]="12"></svg></button>
                    }
                  </div>
                }
              </div>
            }
          } @else {
            <div class="px-3 py-3 text-xs text-center"
                 style="color:var(--color-muted);border-bottom:1px solid var(--color-border)">
              Все позиции оплачены
            </div>
          }

          @if (o.receipts.length) {
            <div class="flex flex-wrap gap-1 px-3 py-2" style="border-bottom:1px solid var(--color-border)">
              @for (r of o.receipts; track r.id) {
                <button (click)="reprint(r)" class="badge badge-green flex items-center gap-1" style="cursor:pointer">
                  <svg lucideReceipt [size]="12"></svg> {{ r.code }} · {{ r.total | number:'1.0-0' }} ₽
                </button>
              }
            </div>
          }

          <div style="display:grid;grid-template-columns:1fr 1fr 1fr">
            <button (click)="addMore(o)"
                    class="flex items-center justify-center gap-1 py-3 font-semibold text-sm"
                    style="border-right:1px solid var(--color-border);color:var(--color-text)">
              <svg lucidePlus [size]="14"></svg> Дозаказ
            </button>
            <button (click)="openMoveSheet(o)"
                    class="flex items-center justify-center gap-1 py-3 font-medium text-sm"
                    style="border-right:1px solid var(--color-border);color:var(--color-muted)">
              <svg lucideArrowLeftRight [size]="14"></svg> Пересадить
            </button>
            <button (click)="openCheckout(o)" [disabled]="!unpaidItems(o).length"
                    class="flex items-center justify-center gap-1 py-3 font-bold text-sm"
                    [style]="unpaidItems(o).length
                      ? 'background:var(--color-gold);color:white'
                      : 'color:var(--color-muted)'">
              <svg lucideCreditCard [size]="14"></svg> Счёт
            </button>
          </div>
        </div>
      }

      @if (!myOrders().length && !zones().length) {
        <div class="text-center py-16">
          <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Нет открытых столов</p>
        </div>
      }
    </div>

    <!-- ── Reservations sheet ────────────────────────────────────────── -->
    @if (resvSheet()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="resvSheet.set(false)"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;max-height:80dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="resvSheet.set(false)">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base flex items-center gap-2"><svg lucideCalendar [size]="16"></svg> Брони на сегодня</h2>
          <button (click)="resvSheet.set(false)" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>
        <div class="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          @for (r of resvSorted(); track r.id) {
            <div class="flex items-start gap-3 px-3 py-2.5 rounded-xl"
                 [style]="resvCardStyle(r.status)">
              <div class="flex-shrink-0 text-center" style="min-width:48px">
                <p class="font-bold text-sm leading-none">{{ fmtTime(r.time_start) }}</p>
                @if (r.time_end) {
                  <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ fmtTime(r.time_end) }}</p>
                }
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <p class="font-semibold text-sm">{{ r.name }}</p>
                  <span class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                        [style]="resvBadgeStyle(r.status)">{{ resvLabel(r.status) }}</span>
                </div>
                <div class="flex items-center gap-2 mt-0.5 text-xs flex-wrap" style="color:var(--color-muted)">
                  @if (r.table_number) {
                    <span class="font-medium flex items-center gap-0.5" style="color:var(--color-text)"><svg lucideArmchair [size]="12"></svg> {{ r.table_number }}</span>
                  } @else {
                    <span class="flex items-center gap-0.5" style="color:#f59e0b"><svg lucideTriangleAlert [size]="12"></svg> Стол не назначен</span>
                  }
                  <span class="flex items-center gap-0.5"><svg lucideUsers [size]="12"></svg> {{ r.guests_count }}</span>
                  @if (+r.deposit_amount > 0) {
                    <span class="flex items-center gap-0.5" [style.color]="r.deposit_paid ? '#16a34a' : '#92400e'">
                      <svg lucideBanknote [size]="12"></svg> {{ +r.deposit_amount | number:'1.0-0' }} ₽ {{ r.deposit_paid ? '✓' : '...' }}
                    </span>
                  }
                </div>
                @if (r.wishes) {
                  <p class="text-xs mt-0.5 truncate flex items-center gap-0.5" style="color:var(--color-muted)"><svg lucideMessageCircle [size]="12"></svg> {{ r.wishes }}</p>
                }
              </div>
            </div>
          }
        </div>
      </div>
    }

    <!-- ── New table dialog ───────────────────────────────────────── -->
    @if (newTable()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeNewTable()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;max-height:88dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closeNewTable()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base flex items-center gap-2"><svg lucideUtensilsCrossed [size]="16"></svg> Открыть стол</h2>
          <button (click)="closeNewTable()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>
        <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">

          <!-- Table selection -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="section-title">Стол / зона</label>
              @if (ntSelectedTables.length > 1) {
                <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style="background:var(--color-gold);color:white">
                  {{ ntSelectedTables.join('+') }}
                </span>
              }
            </div>

            @if (allTables().length) {
              <!-- Multi-select grid -->
              <div class="space-y-3">
                @for (z of zones(); track z.id) {
                  @if (z.tables.length) {
                    <div>
                      <p class="text-xs font-medium mb-1.5" style="color:var(--color-muted)">{{ z.name }}</p>
                      <div class="grid gap-1.5" style="grid-template-columns:repeat(auto-fill,minmax(72px,1fr))">
                        @for (t of z.tables; track t.id) {
                          @let occupied = tableStatus(t.number) === 'occupied';
                          @let sel = ntSelectedTables.includes(t.number);
                          <button (click)="onTableSelect(t.number)"
                                  [disabled]="occupied"
                                  class="rounded-xl py-2 px-1 text-center transition-all"
                                  [style]="occupied
                                    ? 'background:var(--color-surface2);opacity:0.4;cursor:not-allowed'
                                    : sel
                                      ? 'background:var(--color-gold);color:white;border:2px solid var(--color-gold)'
                                      : 'background:var(--color-surface2);border:2px solid transparent'">
                            <p class="font-bold text-sm leading-none">{{ t.number }}</p>
                            <p class="text-xs mt-0.5">
                              {{ occupied ? 'занят' : sel ? '✓ выбран' : t.seats + ' мест' }}
                            </p>
                          </button>
                        }
                      </div>
                    </div>
                  }
                }
              </div>

              @if (ntSelectedTables.length > 1) {
                <p class="text-xs mt-2 text-center font-medium" style="color:var(--color-gold-hover)">
                  Объединённый стол: {{ ntSelectedTables.join('+') }}
                </p>
              }
            } @else {
              <input [(ngModel)]="ntTableFallback" placeholder="Стол 5, VIP-1, Бар"
                     class="field" style="height:44px" />
            }
          </div>

          <!-- Reservation badge (single table) -->
          @if (ntSelectedTables.length === 1 && tableReservation(ntSelectedTables[0])) {
            @let resv = tableReservation(ntSelectedTables[0])!;
            <div class="rounded-xl px-3 py-2.5" style="background:#eff6ff;border:1px solid #bfdbfe">
              <p class="text-xs font-semibold mb-0.5 flex items-center gap-1" style="color:#1d4ed8"><svg lucideCalendar [size]="12"></svg> Бронь на этом столе</p>
              <p class="text-sm font-medium">{{ resv.name }} · {{ resv.time_start }}</p>
              <p class="text-xs flex items-center gap-0.5" style="color:#3b82f6"><svg lucideUsers [size]="12"></svg> {{ resv.guests_count }}
                @if (+resv.deposit_amount > 0) { · Депозит {{ +resv.deposit_amount | number:'1.0-0' }} ₽ }
              </p>
              @if (resv.wishes) {
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ resv.wishes }}</p>
              }
            </div>
          }

          <div>
            <label class="section-title block mb-1.5">Гостей</label>
            <input [(ngModel)]="ntGuests" type="number" min="0" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Комментарий</label>
            <textarea [(ngModel)]="ntNotes" placeholder="Аллергия, пожелания…"
                      class="field" rows="2" style="resize:none"></textarea>
          </div>
          <button (click)="createTable()"
                  [disabled]="creating() || (!ntSelectedTables.length && !ntTableFallback.trim())"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ creating() ? '...' : 'Открыть стол → меню' }}
          </button>
        </div>
      </div>
    }

    <!-- ── Edit table modal ───────────────────────────────────────── -->
    @if (editOrder()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeEdit()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeEdit()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base flex items-center gap-2"><svg lucidePencil [size]="16"></svg> Изменить стол</h2>
          <button (click)="closeEdit()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>
        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="section-title block mb-1.5">Гостей</label>
            <input [(ngModel)]="editGuests" type="number" min="0" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Комментарий</label>
            <textarea [(ngModel)]="editNotes" placeholder="Аллергия, пожелания…"
                      class="field" rows="2" style="resize:none"></textarea>
          </div>
          <button (click)="saveEdit()" [disabled]="saving()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ saving() ? '...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    }

    <!-- ── Move table sheet ───────────────────────────────────────── -->
    @if (moveOrder()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeMoveSheet()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;max-height:80dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closeMoveSheet()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3 flex-shrink-0"
             style="border-bottom:1px solid var(--color-border)">
          <div>
            <h2 class="font-bold text-base flex items-center gap-2"><svg lucideArrowLeftRight [size]="16"></svg> Пересадить</h2>
            <p class="text-xs" style="color:var(--color-muted)">Текущий: {{ moveOrder()!.table_number }}</p>
          </div>
          <button (click)="closeMoveSheet()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>
        <div class="flex-1 overflow-y-auto px-4 py-4">
          <!-- Move multi-select: can also merge with another table -->
          <p class="text-xs mb-3" style="color:var(--color-muted)">
            Выберите один или несколько столов для объединения
          </p>
          @if (allTables().length) {
            @for (z of zones(); track z.id) {
              @if (z.tables.length) {
                <p class="text-xs font-semibold mb-2 mt-1" style="color:var(--color-muted)">{{ z.name }}</p>
                <div class="grid gap-2 mb-3" style="grid-template-columns:repeat(auto-fill,minmax(80px,1fr))">
                  @for (t of z.tables; track t.id) {
                    @let currentTables = moveOrder()!.table_number.split('+').map(s => s.trim());
                    @let isCurrent = currentTables.includes(t.number);
                    @let isSel = moveSelectedTables.includes(t.number);
                    @let busyByOther = tableStatus(t.number) === 'occupied' && !isCurrent;
                    <button [disabled]="busyByOther || moveSaving()"
                            (click)="onMoveSelect(t.number)"
                            class="rounded-xl p-2.5 text-center transition-all"
                            [style]="busyByOther
                              ? 'background:var(--color-surface2);opacity:0.35;cursor:not-allowed'
                              : isSel
                                ? 'background:var(--color-gold);color:white'
                                : 'background:var(--color-bg);border:1px solid var(--color-border)'">
                      <p class="font-bold text-sm">{{ t.number }}</p>
                      <p class="text-xs">{{ busyByOther ? 'занят' : isSel ? '✓' : 'свободен' }}</p>
                    </button>
                  }
                </div>
              }
            }
            @if (moveSelectedTables.length) {
              <div class="sticky bottom-0 pt-3" style="background:white">
                <button (click)="doMoveTable()" [disabled]="moveSaving()"
                        class="btn btn-primary btn-full" style="height:48px">
                  {{ moveSaving() ? '...' : 'Пересадить → ' + moveSelectedTables.join('+') }}
                </button>
              </div>
            }
          } @else {
            <p class="text-center py-6" style="color:var(--color-muted)">Столы не настроены</p>
          }
        </div>
      </div>
    }

    <!-- ── Checkout modal ──────────────────────────────────────────── -->
    @if (checkout(); as co) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeCheckout()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl overflow-hidden"
           style="background:white;max-height:92dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closeCheckout()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <div class="flex-shrink-0 flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <div class="flex items-center gap-2">
            @if (checkoutStep() === 'pay') {
              <button (click)="checkoutStep.set('mode')"
                      class="text-sm font-semibold" style="color:var(--color-muted)">← Назад</button>
            }
            <h2 class="font-bold text-base flex items-center gap-2"><svg lucideCreditCard [size]="16"></svg> {{ co.table_number || 'Стол' }}</h2>
          </div>
          <button (click)="closeCheckout()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>

        @if (checkoutStep() === 'mode') {
          <div class="px-4 py-5 space-y-3 flex-shrink-0">
            <p class="text-sm text-center mb-4" style="color:var(--color-muted)">Как будете платить?</p>
            <button (click)="chooseSingle()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-border);background:white">
              <svg lucideReceipt [size]="32" style="color:var(--color-muted);flex-shrink:0"></svg>
              <div>
                <p class="font-bold text-base">Один счёт</p>
                <p class="text-sm" style="color:var(--color-muted)">
                  {{ coItems().length }} поз. · {{ totalAll() | number:'1.0-0' }} ₽
                </p>
              </div>
            </button>
            <button (click)="chooseSplit()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-gold);background:var(--color-gold-light)">
              <svg lucideUsers [size]="32" style="color:var(--color-gold-hover);flex-shrink:0"></svg>
              <div>
                <p class="font-bold text-base">Раздельно</p>
                <p class="text-sm" style="color:var(--color-gold-hover)">
                  Каждый платит за себя
                  @if (checkoutGuestGroups().length > 1) { · {{ checkoutGuestGroups().length }} счёт(а) }
                </p>
              </div>
            </button>
          </div>
        }

        @if (checkoutStep() === 'pay' && !split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            @for (item of coItems(); track item.id) {
              <div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--color-border)">
                <span class="flex-1 text-sm">{{ item.menu_item_name }}</span>
                <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="text-sm font-semibold"
                      style="color:var(--color-gold-hover);min-width:56px;text-align:right">
                  {{ item.subtotal | number:'1.0-0' }} ₽
                </span>
              </div>
            }
          </div>
          <div class="flex-shrink-0 px-4 pt-3 pb-5" style="border-top:1px solid var(--color-border)">
            <div class="flex items-center justify-between mb-1">
              <span class="font-medium" style="color:var(--color-muted)">Итого по чеку</span>
              <span class="text-2xl font-bold">{{ totalAll() | number:'1.0-0' }} ₽</span>
            </div>
            @if (depositInfo()) {
              <div class="rounded-xl px-3 py-2.5 mb-3 mt-2"
                   style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
                <div class="flex items-center justify-between mb-0.5">
                  <span class="text-sm font-medium" style="color:var(--color-gold-hover)">
                    Депозит ({{ depositInfo()!.deposit_method_label || 'нал' }})
                  </span>
                  <span class="text-sm font-bold" style="color:var(--color-gold-hover)">
                    −{{ depositInfo()!.deposit_amount | number:'1.0-0' }} ₽
                  </span>
                </div>
                <div class="flex items-center justify-between">
                  <span class="text-xs" style="color:var(--color-muted)">{{ depositInfo()!.name }}</span>
                  @if (refundAmount() > 0) {
                    <span class="text-xs font-semibold" style="color:#166534">
                      Возврат: {{ refundAmount() | number:'1.0-0' }} ₽
                    </span>
                  } @else {
                    <span class="text-xs font-semibold" style="color:var(--color-gold-hover)">
                      Остаток: {{ remainingAmount() | number:'1.0-0' }} ₽
                    </span>
                  }
                </div>
              </div>
            } @else {
              <div class="mb-3"></div>
            }
            @if (refundAmount() > 0) {
              <div class="rounded-xl px-3 py-3 mb-4 text-center"
                   style="background:#dcfce7;border:1px solid #86efac">
                <span class="text-sm font-semibold flex items-center justify-center gap-1" style="color:#16a34a">
                  <svg lucideCheck [size]="16"></svg> Депозит покрывает счёт · возврат {{ refundAmount() | number:'1.0-0' }} ₽
                </span>
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
                @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> } {{ submitting() ? '...' : 'Закрыть счёт и печать' }}
              </button>
            } @else if (remainingAmount() === 0 && depositInfo()) {
              <div class="rounded-xl px-3 py-3 mb-4 text-center"
                   style="background:#dcfce7;border:1px solid #86efac">
                <span class="text-sm font-semibold flex items-center justify-center gap-1" style="color:#16a34a">
                  <svg lucideCheck [size]="16"></svg> Депозит покрывает весь счёт
                </span>
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
                @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> } {{ submitting() ? '...' : 'Закрыть счёт и печать' }}
              </button>
            } @else {
              <div class="flex gap-2 mb-4">
                @for (p of payments; track p.value) {
                  <button (click)="singlePay.set(p.value)" class="btn btn-sm flex items-center gap-1" style="flex:1"
                          [class]="singlePay() === p.value ? 'btn-primary' : 'btn-outline'">
                    <svg [lucideIcon]="p.icon" [size]="14"></svg> {{ p.label }}
                  </button>
                }
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
                @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> } {{ submitting() ? '...' : 'Закрыть счёт и печать' }}
              </button>
            }
          </div>
        }

        @if (checkoutStep() === 'pay' && split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">
            @for (grp of checkoutGuestGroups(); track grp.guest) {
              <div class="rounded-xl overflow-hidden" style="border:1.5px solid var(--color-border)">
                <div class="flex items-center gap-2 px-3 py-2.5"
                     style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
                  <span class="font-semibold text-sm flex-1">{{ guestLabel(grp.guest) }}</span>
                  <div class="flex items-center gap-1">
                    @for (bn of billChoices(); track bn) {
                      <button (click)="setGuestBill(grp.guest, bn)"
                              class="w-7 h-7 rounded-full text-xs font-bold"
                              [style]="guestBillOf(grp.guest) === bn
                                ? 'background:var(--color-gold);color:white'
                                : 'background:white;color:var(--color-muted);border:1.5px solid var(--color-border-mid)'">
                        {{ bn }}
                      </button>
                    }
                  </div>
                  <span class="font-bold text-sm flex-shrink-0" style="color:var(--color-gold-hover)">
                    {{ grp.total | number:'1.0-0' }} ₽
                  </span>
                </div>
                <div class="px-3 py-2">
                  @for (item of grp.items; track item.id) {
                    <div class="flex items-center gap-2 py-0.5 text-sm">
                      <span class="flex-1 truncate">{{ item.menu_item_name }}</span>
                      <span style="color:var(--color-muted)">× {{ item.quantity }}</span>
                      <span style="color:var(--color-gold-hover);min-width:52px;text-align:right">
                        {{ item.subtotal | number:'1.0-0' }} ₽
                      </span>
                    </div>
                  }
                </div>
              </div>
            }
            <div class="pt-2" style="border-top:2px solid var(--color-border)">
              <p class="section-title mb-2">Итого по чекам</p>
              @for (bill of splitBills(); track bill.billNo) {
                <div class="mb-3 rounded-xl overflow-hidden" style="border:1.5px solid var(--color-gold)">
                  <div class="flex items-center justify-between px-3 py-2"
                       style="background:var(--color-gold-light)">
                    <div class="leading-tight">
                      <p class="font-bold text-sm">Чек {{ bill.billNo }}</p>
                      <p class="text-xs" style="color:var(--color-gold-hover)">{{ billGuestNames(bill.guests) }}</p>
                    </div>
                    <span class="font-bold" style="color:var(--color-gold-hover)">
                      {{ bill.total | number:'1.0-0' }} ₽
                    </span>
                  </div>
                  <div class="flex gap-2 px-3 py-2.5">
                    @for (p of payments; track p.value) {
                      <button (click)="setBillPay(bill.billNo, p.value)" class="btn btn-sm flex items-center gap-1" style="flex:1"
                              [class]="billPayOf(bill.billNo) === p.value ? 'btn-primary' : 'btn-outline'">
                        <svg [lucideIcon]="p.icon" [size]="14"></svg> {{ p.label }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>
          <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid var(--color-border)">
            <button (click)="confirm()" [disabled]="submitting()"
                    class="btn btn-primary btn-full flex items-center justify-center gap-1" style="height:48px">
              @if (!submitting()) { <svg lucideReceipt [size]="16"></svg> }
              {{ submitting() ? '...' : 'Закрыть и печать (' + splitBills().length + ' чека)' }}
            </button>
          </div>
        }
      </div>
    }
  `
})
export class TablesPage implements OnInit, OnDestroy {
  private api     = inject(ApiService);
  private auth    = inject(AuthService);
  private cart    = inject(CartService);
  private printer = inject(ReceiptPrintService);
  private toast   = inject(ToastService);
  private router  = inject(Router);

  payments = PAYMENTS;
  orders   = signal<Order[]>([]);
  zones    = signal<Zone[]>([]);
  todayReservations = signal<Reservation[]>([]);
  selectedZoneId    = signal<number | null>(null);

  // new table dialog
  private shiftId: number | null = null;
  newTable         = signal(false);
  creating         = signal(false);
  ntSelectedTables: string[] = [];
  ntTableFallback  = '';
  ntGuests: number | null = null;
  ntNotes  = '';

  // edit modal
  editOrder  = signal<Order | null>(null);
  editGuests: number | null = null;
  editNotes  = '';
  saving     = signal(false);

  // reservations sheet
  resvSheet = signal(false);

  // move table sheet
  moveOrder        = signal<Order | null>(null);
  moveSelectedTables: string[] = [];
  moveSaving       = signal(false);

  // checkout modal
  checkout     = signal<Order | null>(null);
  checkoutStep = signal<'mode' | 'pay'>('mode');
  split        = signal(false);
  submitting   = signal(false);
  singlePay    = signal<PaymentMethod>('cash');
  private guestBillMap = signal<Record<number, number>>({});
  private billPayMap   = signal<Record<number, PaymentMethod>>({});

  confirmDeleteItem = signal<number | null>(null);
  private pollTimer?: ReturnType<typeof setInterval>;

  // ── Computed ─────────────────────────────────────────────────────
  currentUserId = computed(() => this.auth.user()?.id);

  myOrders    = computed(() => this.orders().filter(o => o.waiter === this.currentUserId()));
  otherOrders = computed(() => this.orders().filter(o => o.waiter !== this.currentUserId()));

  filteredZones = computed(() => {
    const id = this.selectedZoneId();
    return id === null ? this.zones() : this.zones().filter(z => z.id === id);
  });

  allTables = computed(() => this.zones().flatMap(z => z.tables));

  resvSorted = computed(() =>
    [...this.todayReservations()]
      .sort((a, b) => a.time_start.localeCompare(b.time_start))
  );

  coItems = computed(() => {
    const o = this.checkout();
    return o ? this.unpaidItems(o) : [];
  });
  totalAll = computed(() => this.coItems().reduce((s, i) => s + +i.subtotal, 0));

  depositInfo = computed((): ReservationInfo | null => {
    const o = this.checkout();
    const r = o?.reservation_info;
    if (!r || !r.deposit_paid || +r.deposit_amount <= 0) return null;
    return r;
  });
  depositAmount   = computed(() => this.depositInfo() ? +this.depositInfo()!.deposit_amount : 0);
  remainingAmount = computed(() => Math.max(0, this.totalAll() - this.depositAmount()));
  refundAmount    = computed(() => Math.max(0, this.depositAmount() - this.totalAll()));

  checkoutGuestGroups = computed(() => {
    const byGuest = new Map<number, OrderItem[]>();
    for (const it of this.coItems()) {
      const grp = byGuest.get(it.guest_no) ?? [];
      grp.push(it);
      byGuest.set(it.guest_no, grp);
    }
    return [...byGuest.keys()].sort((a, b) => a - b).map(guest => {
      const items = byGuest.get(guest)!;
      return { guest, items, total: items.reduce((s, i) => s + +i.subtotal, 0) };
    });
  });

  splitBills = computed(() => {
    const gbm = this.guestBillMap();
    const bills = new Map<number, { guests: number[]; items: OrderItem[]; total: number }>();
    for (const grp of this.checkoutGuestGroups()) {
      const bn = gbm[grp.guest] ?? 1;
      if (!bills.has(bn)) bills.set(bn, { guests: [], items: [], total: 0 });
      const b = bills.get(bn)!;
      b.guests.push(grp.guest);
      b.items.push(...grp.items);
      b.total += grp.total;
    }
    return [...bills.entries()].sort(([a], [b]) => a - b).map(([billNo, data]) => ({ billNo, ...data }));
  });

  billChoices = computed(() => {
    const gbm = this.guestBillMap();
    const used = new Set(Object.values(gbm));
    const max  = used.size ? Math.max(...used) : 0;
    const nums = [...used].sort((a, b) => a - b);
    if (max < this.checkoutGuestGroups().length) nums.push(max + 1);
    return nums;
  });

  // ── Lifecycle ────────────────────────────────────────────────────
  ngOnInit() {
    this.load();
    this.api.getCurrentShift().subscribe({ next: s => this.shiftId = s?.id ?? null, error: () => {} });
    this.pollTimer = setInterval(() => this.load(), POLL_MS);

    this.api.getZones().subscribe({ next: z => this.zones.set(z), error: () => {} });
    const today = new Date().toISOString().split('T')[0];
    this.api.getReservations({ date: today }).subscribe({
      next: r => this.todayReservations.set(r.filter(x => ['pending', 'confirmed', 'arrived'].includes(x.status))),
      error: () => {},
    });
  }
  ngOnDestroy() { if (this.pollTimer) clearInterval(this.pollTimer); }

  load() { this.api.getActiveOrders().subscribe(o => this.orders.set(o)); }

  // ── Table helpers ─────────────────────────────────────────────────
  /** Parse order table_number which may be "5+6" for merged tables. */
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

  orderReservation(o: Order): Reservation | null {
    for (const t of this.orderTables(o)) {
      const r = this.tableReservation(t);
      if (r) return r;
    }
    return null;
  }

  tableCardStyle(status: 'free' | 'occupied' | 'reserved'): string {
    if (status === 'occupied')
      return 'background:var(--color-gold-light);border:1.5px solid var(--color-gold-mid)';
    if (status === 'reserved')
      return 'background:#eff6ff;border:1.5px solid #93c5fd';
    return 'background:var(--color-surface2);border:1px solid var(--color-border)';
  }

  onTableTap(tableNum: string) {
    if (this.tableStatus(tableNum) === 'occupied') {
      const order = this.tableOrder(tableNum);
      if (order) {
        const el = document.getElementById('order-' + order.id);
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    } else {
      this.openNewTable(tableNum);
    }
  }

  fmtTime(t: string): string { return t?.slice(0, 5) ?? ''; }

  private static RESV_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
    pending:   { label: 'Ожидает',      color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
    confirmed: { label: 'Подтверждена', color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' },
    arrived:   { label: 'Пришли',       color: '#166534', bg: '#f0fdf4', border: '#86efac' },
    completed: { label: 'Завершена',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
    cancelled: { label: 'Отменена',     color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
  };

  resvCardStyle(status: string): string {
    const m = TablesPage.RESV_META[status] ?? TablesPage.RESV_META['pending'];
    return `background:${m.bg};border:1px solid ${m.border}`;
  }
  resvBadgeStyle(status: string): string {
    const m = TablesPage.RESV_META[status] ?? TablesPage.RESV_META['pending'];
    return `background:${m.border};color:${m.color}`;
  }
  resvLabel(status: string): string {
    return TablesPage.RESV_META[status]?.label ?? status;
  }

  // ── New table ─────────────────────────────────────────────────────
  openNewTable(prefilledTable = '') {
    this.ntSelectedTables = prefilledTable ? [prefilledTable] : [];
    this.ntTableFallback  = '';
    this.ntGuests  = null;
    this.ntNotes   = '';
    this.creating.set(false);
    this.newTable.set(true);
  }
  closeNewTable() { this.newTable.set(false); }

  onTableSelect(tableNum: string) {
    if (this.tableStatus(tableNum) === 'occupied') return;
    const idx = this.ntSelectedTables.indexOf(tableNum);
    if (idx >= 0) {
      this.ntSelectedTables = this.ntSelectedTables.filter(t => t !== tableNum);
    } else {
      this.ntSelectedTables = [...this.ntSelectedTables, tableNum];
    }
  }

  createTable() {
    const tableNumber = this.ntSelectedTables.length
      ? this.ntSelectedTables.join('+')
      : this.ntTableFallback.trim();
    if (this.creating() || !tableNumber) return;
    if (!this.shiftId) { this.toast.error('Нет открытой смены'); return; }
    this.creating.set(true);
    this.api.createOrder({
      shift: this.shiftId, table_number: tableNumber,
      guests: this.ntGuests || 0, notes: this.ntNotes.trim(), items: [],
    }).subscribe({
      next: order => {
        this.creating.set(false);
        this.cart.setTarget(order);
        this.newTable.set(false);
        this.router.navigate(['/waiter/order']);
      },
      error: () => { this.creating.set(false); this.toast.error('Не удалось открыть стол'); },
    });
  }

  // ── Edit order ────────────────────────────────────────────────────
  openEdit(o: Order) {
    this.editGuests = o.guests || null;
    this.editNotes  = o.notes || '';
    this.editOrder.set(o);
  }
  closeEdit() { this.editOrder.set(null); }

  saveEdit() {
    const o = this.editOrder();
    if (!o || this.saving()) return;
    this.saving.set(true);
    this.api.updateOrder(o.id, {
      table_number: o.table_number,
      guests: this.editGuests || 0,
      notes: this.editNotes.trim(),
    }).subscribe({
      next: updated => { this.replaceOrder(updated); this.saving.set(false); this.closeEdit(); },
      error: () => { this.saving.set(false); this.toast.error('Не удалось сохранить'); },
    });
  }

  // ── Move table ────────────────────────────────────────────────────
  openMoveSheet(o: Order) {
    this.moveSelectedTables = this.orderTables(o);
    this.moveOrder.set(o);
  }
  closeMoveSheet() { this.moveOrder.set(null); this.moveSelectedTables = []; }

  onMoveSelect(tableNum: string) {
    const o = this.moveOrder();
    if (!o) return;
    const currentTables = this.orderTables(o);
    const isCurrent = currentTables.includes(tableNum);
    const busyByOther = this.tableStatus(tableNum) === 'occupied' && !isCurrent;
    if (busyByOther) return;

    const idx = this.moveSelectedTables.indexOf(tableNum);
    if (idx >= 0) {
      this.moveSelectedTables = this.moveSelectedTables.filter(t => t !== tableNum);
    } else {
      this.moveSelectedTables = [...this.moveSelectedTables, tableNum];
    }
  }

  doMoveTable() {
    const o = this.moveOrder();
    if (!o || this.moveSaving() || !this.moveSelectedTables.length) return;
    const newTableNumber = this.moveSelectedTables.join('+');
    if (newTableNumber === o.table_number) { this.closeMoveSheet(); return; }
    this.moveSaving.set(true);
    this.api.moveOrderTable(o.id, newTableNumber).subscribe({
      next: updated => {
        this.replaceOrder(updated);
        this.moveSaving.set(false);
        this.closeMoveSheet();
        this.toast.success(`Стол → ${newTableNumber}`);
      },
      error: err => { this.moveSaving.set(false); this.toast.apiError(err, 'Ошибка пересадки'); },
    });
  }

  // ── Checkout ──────────────────────────────────────────────────────
  openCheckout(o: Order) {
    this.checkout.set(o);
    this.checkoutStep.set('mode');
    this.split.set(false);
    this.singlePay.set('cash');
    this.guestBillMap.set({});
    this.billPayMap.set({});
    this.submitting.set(false);
  }
  closeCheckout() { this.checkout.set(null); this.checkoutStep.set('mode'); }
  chooseSingle() { this.split.set(false); this.checkoutStep.set('pay'); }
  chooseSplit() {
    this.split.set(true);
    const gbm: Record<number, number> = {};
    const bpm: Record<number, PaymentMethod> = {};
    this.checkoutGuestGroups().forEach((grp, idx) => { gbm[grp.guest] = idx + 1; bpm[idx + 1] = 'cash'; });
    this.guestBillMap.set(gbm);
    this.billPayMap.set(bpm);
    this.checkoutStep.set('pay');
  }
  guestBillOf(guest: number): number { return this.guestBillMap()[guest] ?? 1; }
  setGuestBill(guest: number, billNo: number) {
    this.guestBillMap.update(m => ({ ...m, [guest]: billNo }));
    if (!this.billPayMap()[billNo]) this.billPayMap.update(m => ({ ...m, [billNo]: 'cash' }));
  }
  billPayOf(billNo: number): PaymentMethod { return this.billPayMap()[billNo] ?? 'cash'; }
  setBillPay(billNo: number, method: PaymentMethod) {
    this.billPayMap.update(m => ({ ...m, [billNo]: method }));
  }
  billGuestNames(guests: number[]): string { return guests.map(g => this.guestLabel(g)).join(' + '); }

  confirm() {
    const o = this.checkout();
    if (!o || this.submitting() || !this.coItems().length) return;
    this.submitting.set(true);
    const billsPayload = this.split()
      ? this.splitBills().map(b => ({ item_ids: b.items.map(i => i.id), payment_method: this.billPayOf(b.billNo) }))
      : [{ item_ids: this.coItems().map(i => i.id), payment_method: this.singlePay() }];
    const d = this.split() ? null : this.depositInfo();
    this.api.checkoutOrder(
      o.id, billsPayload,
      d ? +d.deposit_amount : undefined,
      d ? (d.deposit_method || undefined) : undefined,
    ).subscribe({
      next: res => {
        this.submitting.set(false);
        this.printer.printHardware(res.receipts);
        this.toast.success(res.receipts.length > 1 ? 'Чеки сформированы' : 'Чек сформирован');
        this.closeCheckout();
        this.load();
      },
      error: err => { this.submitting.set(false); this.toast.apiError(err, 'Ошибка при закрытии счёта'); },
    });
  }

  // ── Item actions ──────────────────────────────────────────────────
  askDeleteItem(item: OrderItem) { this.confirmDeleteItem.set(item.id); }
  removeItem(o: Order, item: OrderItem) {
    this.confirmDeleteItem.set(null);
    this.api.removeItemFromOrder(o.id, item.id).subscribe({
      next: updated => this.replaceOrder(updated),
      error: () => this.toast.error('Не удалось удалить позицию'),
    });
  }
  moveItem(o: Order, item: OrderItem, guest: number) {
    if (item.guest_no === guest) return;
    this.api.setItemGuest(o.id, item.id, guest).subscribe({
      next: updated => this.replaceOrder(updated),
      error: () => this.toast.error('Не удалось перенести позицию'),
    });
  }

  // ── Helpers ───────────────────────────────────────────────────────
  firstName(name: string): string { return name?.split(' ')[0] ?? ''; }
  guestLabel(guest: number): string { return guest === 0 ? 'Общий' : 'Гость ' + guest; }
  guestOptions(o: Order): number[] {
    const used = this.unpaidItems(o).reduce((m, i) => Math.max(m, i.guest_no), 0);
    const n = Math.max(o.guests ?? 0, used);
    return [0, ...Array.from({ length: n }, (_, i) => i + 1)];
  }
  guestGroups(o: Order): { guest: number; items: OrderItem[]; total: number }[] {
    const byGuest = new Map<number, OrderItem[]>();
    for (const it of this.unpaidItems(o)) {
      (byGuest.get(it.guest_no) ?? byGuest.set(it.guest_no, []).get(it.guest_no)!).push(it);
    }
    return [...byGuest.keys()].sort((a, b) => a - b).map(guest => {
      const items = byGuest.get(guest)!;
      return { guest, items, total: items.reduce((s, i) => s + +i.subtotal, 0) };
    });
  }

  unpaidItems(o: Order): OrderItem[] { return o.items.filter(i => i.receipt == null); }
  unpaidTotal(o: Order): number { return this.unpaidItems(o).reduce((s, i) => s + +i.subtotal, 0); }
  readyCount(o: Order): number {
    return o.items.filter(i => i.receipt == null && i.kitchen_status === 'ready').length;
  }
  elapsed(o: Order): string {
    const min = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
    return min < 60 ? `${min} мин` : `${Math.floor(min / 60)} ч ${min % 60} мин`;
  }

  addMore(o: Order) { this.cart.setTarget(o); this.router.navigate(['/waiter/order']); }
  reprint(r: Receipt) { this.printer.printHardware(r); }
  private replaceOrder(updated: Order) {
    this.orders.update(list => list.map(o => o.id === updated.id ? updated : o));
  }
}
