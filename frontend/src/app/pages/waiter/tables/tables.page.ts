import { Component, OnInit, OnDestroy, signal, computed, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { CartService } from '../../../features/cart/cart.service';
import { NetworkService } from '../../../core/services/network.service';
import { OutboxService } from '../../../core/services/outbox.service';
import { ReceiptPrintService } from '../../../features/receipt/receipt-print.service';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Order, OrderItem, PaymentMethod, Receipt, ReservationInfo } from '../../../core/models';

const PAYMENTS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'Наличные', icon: '💵' },
  { value: 'card',     label: 'Карта',    icon: '💳' },
  { value: 'transfer', label: 'Перевод',  icon: '📲' },
];

const POLL_MS = 10_000;

@Component({
  selector: 'app-tables-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-3 pb-4">

      <button (click)="openNewTable()" class="btn btn-primary btn-full" style="height:48px;font-size:0.95rem">
        ＋ Новый стол
        @if (orders().length) {
          <span class="text-xs font-normal opacity-70">· {{ orders().length }} занято</span>
        }
      </button>

      @for (o of orders(); track o.id) {
        <div class="overflow-hidden"
             style="background:white;border:1px solid var(--color-border);border-radius:12px">

          <!-- ── Table header ───────────────────────── -->
          <div class="flex items-center justify-between px-3 py-2.5"
               style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
            <div class="flex items-center gap-2 min-w-0">
              <span class="font-bold text-base truncate">{{ o.table_number || 'Стол' }}</span>
              @if (o.guests) {
                <span class="text-xs flex-shrink-0" style="color:var(--color-muted)">· 👥 {{ o.guests }}</span>
              }
              @if (readyCount(o) > 0) {
                <span class="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold animate-pulse"
                      style="background:#16a34a;color:white">
                  ✓ {{ readyCount(o) }}
                </span>
              }
              @if (o._offline) {
                <span class="flex-shrink-0 px-1.5 py-0.5 rounded-full text-xs font-bold"
                      [style]="o._syncError ? 'background:#92400e;color:white' : 'background:#64748b;color:white'">
                  {{ o._syncError ? '⚠ ошибка' : '⏳ не отправлен' }}
                </span>
              }
              <button (click)="openEdit(o)" class="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded"
                      style="color:var(--color-muted)" title="Редактировать">✏️</button>
            </div>
            <div class="flex items-center gap-2 flex-shrink-0">
              <span class="text-xs" style="color:var(--color-muted)">{{ elapsed(o) }}</span>
              <span class="font-bold text-sm" style="color:var(--color-gold-hover)">
                {{ unpaidTotal(o) | number:'1.0-0' }} ₽
              </span>
            </div>
          </div>

          <!-- ── Notes ──────────────────────────────── -->
          @if (o.notes) {
            <div class="px-3 py-2 text-xs flex items-start gap-1.5"
                 style="background:#fffbeb;border-bottom:1px solid var(--color-gold-mid);color:#92400e">
              <span class="flex-shrink-0">📝</span>
              <span>{{ o.notes }}</span>
            </div>
          }

          <!-- ── Per-guest items ─────────────────────── -->
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
                  <div class="flex items-center gap-2 py-1">
                    <span class="flex-1 text-sm truncate" style="color:var(--color-text)">
                      {{ item.menu_item_name }}
                      @if (item._pending) {
                        <span class="text-xs font-semibold" style="color:#b45309" title="Не отправлено">⏳</span>
                      }
                    </span>
                    <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                    @if (item.kitchen_status === 'ready') {
                      <span class="text-xs font-bold" style="color:#16a34a">✓</span>
                    } @else if (item.kitchen_status === 'cooking') {
                      <span class="text-xs" style="color:var(--color-amber)">⏳</span>
                    }
                    @if (confirmDeleteItem() === item.id) {
                      <button (click)="removeItem(o, item)"
                              class="flex items-center justify-center gap-1 rounded-lg font-bold text-sm flex-shrink-0"
                              style="background:#ef4444;color:white;min-height:40px;padding:0 14px">
                        🗑 Удалить
                      </button>
                      <button (click)="confirmDeleteItem.set(null)"
                              class="flex items-center justify-center rounded-lg text-sm flex-shrink-0"
                              style="background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border);min-height:40px;padding:0 12px">
                        Отмена
                      </button>
                    } @else {
                      <button (click)="askDeleteItem(item)"
                              class="flex items-center justify-center rounded-lg flex-shrink-0"
                              style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;min-width:40px;min-height:40px;font-size:1.05rem"
                              title="Удалить позицию">🗑</button>
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

          <!-- ── Issued receipts ────────────────────── -->
          @if (o.receipts.length) {
            <div class="flex flex-wrap gap-1 px-3 py-2" style="border-bottom:1px solid var(--color-border)">
              @for (r of o.receipts; track r.id) {
                <button (click)="reprint(r)" class="badge badge-green" style="cursor:pointer">
                  🧾 {{ r.code }} · {{ r.total | number:'1.0-0' }} ₽
                </button>
              }
            </div>
          }

          <!-- ── Actions ───────────────────────────── -->
          <div style="display:grid;grid-template-columns:1fr 1fr">
            <button (click)="addMore(o)"
                    class="flex items-center justify-center gap-1 py-3 font-semibold text-sm"
                    style="border-right:1px solid var(--color-border);color:var(--color-text)">
              ➕ Дозаказ
            </button>
            <button (click)="openCheckout(o)" [disabled]="!unpaidItems(o).length"
                    class="flex items-center justify-center gap-1 py-3 font-bold text-sm"
                    [style]="canCheckout(o)
                      ? 'background:var(--color-gold);color:white'
                      : 'color:var(--color-muted)'">
              @if (o._offline) { ⏳ Ожидает сети }
              @else if (!net.online()) { 🔒 Нет сети }
              @else { 💳 Счёт }
            </button>
          </div>
        </div>
      }

      @if (!orders().length) {
        <div class="text-center py-16">
          <span class="text-4xl block mb-3">🍽</span>
          <p style="color:var(--color-muted)">Нет открытых столов</p>
        </div>
      }
    </div>

    <!-- ── New table dialog ───────────────────────────── -->
    @if (newTable()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeNewTable()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeNewTable()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">🍽 Новый стол</h2>
          <button (click)="closeNewTable()" class="btn btn-ghost btn-sm">✕</button>
        </div>
        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="section-title block mb-1.5">Стол / зона</label>
            <input [(ngModel)]="ntTable" placeholder="Стол 5, VIP-1, Бар" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Гостей</label>
            <input [(ngModel)]="ntGuests" type="number" min="0" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Комментарий</label>
            <textarea [(ngModel)]="ntNotes" placeholder="Аллергия, пожелания, особые условия…"
                      class="field" rows="2" style="resize:none"></textarea>
          </div>
          <button (click)="createTable()" [disabled]="creating() || !ntTable.trim()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ creating() ? '⏳ ...' : 'Открыть стол и перейти в меню →' }}
          </button>
        </div>
      </div>
    }

    <!-- ── Edit table modal ──────────────────────────────── -->
    @if (editOrder()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeEdit()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
           style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
        <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeEdit()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>
        <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">✏️ Изменить стол</h2>
          <button (click)="closeEdit()" class="btn btn-ghost btn-sm">✕</button>
        </div>
        <div class="px-4 py-4 space-y-3">
          <div>
            <label class="section-title block mb-1.5">Стол / зона</label>
            <input [(ngModel)]="editTable" placeholder="Стол 5, VIP-1, Бар" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Гостей</label>
            <input [(ngModel)]="editGuests" type="number" min="0" class="field" style="height:44px" />
          </div>
          <div>
            <label class="section-title block mb-1.5">Комментарий</label>
            <textarea [(ngModel)]="editNotes" placeholder="Аллергия, пожелания, особые условия…"
                      class="field" rows="2" style="resize:none"></textarea>
          </div>
          <button (click)="saveEdit()" [disabled]="saving() || !editTable.trim()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ saving() ? '⏳ ...' : 'Сохранить' }}
          </button>
        </div>
      </div>
    }

    <!-- ── Checkout modal ─────────────────────────────── -->
    @if (checkout(); as co) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeCheckout()"></div>
      <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl overflow-hidden"
           style="background:white;max-height:92dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <!-- Handle -->
        <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closeCheckout()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <!-- Title row -->
        <div class="flex-shrink-0 flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <div class="flex items-center gap-2">
            @if (checkoutStep() === 'pay') {
              <button (click)="checkoutStep.set('mode')"
                      class="text-sm font-semibold" style="color:var(--color-muted)">← Назад</button>
            }
            <h2 class="font-bold text-base">💳 {{ co.table_number || 'Стол' }}</h2>
          </div>
          <button (click)="closeCheckout()" class="btn btn-ghost btn-sm">✕</button>
        </div>

        <!-- ── STEP 1: mode choice ──────────────────────── -->
        @if (checkoutStep() === 'mode') {
          <div class="px-4 py-5 space-y-3 flex-shrink-0">
            <p class="text-sm text-center mb-4" style="color:var(--color-muted)">Как будете платить?</p>

            <!-- Single bill -->
            <button (click)="chooseSingle()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-border);background:white">
              <span class="text-3xl">🧾</span>
              <div>
                <p class="font-bold text-base">Один счёт</p>
                <p class="text-sm" style="color:var(--color-muted)">
                  {{ coItems().length }} поз. · {{ totalAll() | number:'1.0-0' }} ₽
                </p>
              </div>
            </button>

            <!-- Split -->
            <button (click)="chooseSplit()"
                    class="w-full flex items-center gap-4 px-4 py-4 rounded-xl text-left"
                    style="border:2px solid var(--color-gold);background:var(--color-gold-light)">
              <span class="text-3xl">👥</span>
              <div>
                <p class="font-bold text-base">Раздельно</p>
                <p class="text-sm" style="color:var(--color-gold-hover)">
                  Каждый платит за себя
                  @if (checkoutGuestGroups().length > 1) {
                    · {{ checkoutGuestGroups().length }} счёт(а)
                  }
                </p>
              </div>
            </button>
          </div>
        }

        <!-- ── STEP 2a: single bill ─────────────────────── -->
        @if (checkoutStep() === 'pay' && !split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3">
            @for (item of coItems(); track item.id) {
              <div class="flex items-center gap-2 py-2" style="border-bottom:1px solid var(--color-border)">
                <span class="flex-1 text-sm">{{ item.menu_item_name }}</span>
                <span class="text-xs" style="color:var(--color-muted)">× {{ item.quantity }}</span>
                <span class="text-sm font-semibold" style="color:var(--color-gold-hover);min-width:56px;text-align:right">
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

            <!-- Deposit block -->
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
            } @else if (unpaidReservationDeposit(); as ud) {
              <!-- Бронь с депозитом, ещё не отмечен оплаченным -->
              <div class="rounded-xl px-3 py-2.5 mb-3 mt-2"
                   style="background:#fef3c7;border:1px solid #fcd34d">
                <div class="leading-tight mb-2">
                  <p class="text-sm font-semibold" style="color:#92400e">
                    Депозит по брони: {{ ud.deposit_amount | number:'1.0-0' }} ₽
                    @if (ud.deposit_method_label) { ({{ ud.deposit_method_label }}) }
                  </p>
                  <p class="text-xs" style="color:#b45309">{{ ud.name }} · ещё не отмечен внесённым</p>
                </div>
                <button (click)="markDepositPaid()" [disabled]="markingDeposit()"
                        class="btn btn-primary btn-full btn-sm" style="height:42px">
                  {{ markingDeposit() ? '⏳ ...' : '✅ Депозит внесён — вычесть из счёта' }}
                </button>
              </div>
            } @else {
              <!-- Ручной депозит (гость без брони) -->
              @if (!manualDepositOpen() && manualDeposit() === 0) {
                <button (click)="manualDepositOpen.set(true)"
                        class="w-full text-sm font-semibold mb-3 mt-2 py-2.5 rounded-xl"
                        style="color:var(--color-gold-hover);background:var(--color-gold-light);border:1px dashed var(--color-gold-mid)">
                  ＋ Учесть депозит
                </button>
              } @else {
                <div class="rounded-xl px-3 py-2.5 mb-3 mt-2"
                     style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
                  <div class="flex items-center justify-between mb-2">
                    <span class="text-sm font-medium" style="color:var(--color-gold-hover)">Депозит</span>
                    <button (click)="clearManualDeposit()" class="text-xs font-semibold" style="color:var(--color-muted)">убрать</button>
                  </div>
                  <input type="number" min="0" inputmode="numeric"
                         [ngModel]="manualDepositAmount()" (ngModelChange)="manualDepositAmount.set($event)"
                         placeholder="Сумма депозита, ₽" class="field mb-2" style="height:44px" />
                  <div class="flex gap-2">
                    <button (click)="manualDepositMethod.set('cash')" class="btn btn-sm" style="flex:1"
                            [class]="manualDepositMethod() === 'cash' ? 'btn-primary' : 'btn-outline'">💵 Нал</button>
                    <button (click)="manualDepositMethod.set('transfer')" class="btn btn-sm" style="flex:1"
                            [class]="manualDepositMethod() === 'transfer' ? 'btn-primary' : 'btn-outline'">📲 Перевод</button>
                  </div>
                  @if (manualDeposit() > 0) {
                    <div class="flex items-center justify-between mt-2 pt-2" style="border-top:1px dashed var(--color-gold-mid)">
                      <span class="text-xs" style="color:var(--color-muted)">−{{ manualDeposit() | number:'1.0-0' }} ₽ из счёта</span>
                      @if (refundAmount() > 0) {
                        <span class="text-xs font-semibold" style="color:#166534">Возврат: {{ refundAmount() | number:'1.0-0' }} ₽</span>
                      } @else {
                        <span class="text-xs font-semibold" style="color:var(--color-gold-hover)">Остаток: {{ remainingAmount() | number:'1.0-0' }} ₽</span>
                      }
                    </div>
                  }
                </div>
              }
            }

            @if (refundAmount() > 0) {
              <div class="rounded-xl px-3 py-3 mb-4 text-center" style="background:#dcfce7;border:1px solid #86efac">
                <span class="text-sm font-semibold" style="color:#16a34a">
                  ✅ Депозит покрывает счёт · возврат {{ refundAmount() | number:'1.0-0' }} ₽
                </span>
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full" style="height:48px">
                {{ submitting() ? '⏳ ...' : '🧾 Закрыть счёт и печать' }}
              </button>
            } @else if (remainingAmount() === 0 && activeDepositAmount() > 0) {
              <div class="rounded-xl px-3 py-3 mb-4 text-center" style="background:#dcfce7;border:1px solid #86efac">
                <span class="text-sm font-semibold" style="color:#16a34a">✅ Депозит покрывает весь счёт</span>
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full" style="height:48px">
                {{ submitting() ? '⏳ ...' : '🧾 Закрыть счёт и печать' }}
              </button>
            } @else {
              <div class="flex gap-2 mb-4">
                @for (p of payments; track p.value) {
                  <button (click)="singlePay.set(p.value)" class="btn btn-sm" style="flex:1"
                          [class]="singlePay() === p.value ? 'btn-primary' : 'btn-outline'">
                    {{ p.icon }} {{ p.label }}
                  </button>
                }
              </div>
              <button (click)="confirm()" [disabled]="submitting()"
                      class="btn btn-primary btn-full" style="height:48px">
                {{ submitting() ? '⏳ ...' : '🧾 Закрыть счёт и печать' }}
              </button>
            }
          </div>
        }

        <!-- ── STEP 2b: split per guest ─────────────────── -->
        @if (checkoutStep() === 'pay' && split()) {
          <div class="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2">

            <!-- Guest list: assign to bill -->
            @for (grp of checkoutGuestGroups(); track grp.guest) {
              <div class="rounded-xl overflow-hidden" style="border:1.5px solid var(--color-border)">

                <!-- Guest header: name | bill buttons | total -->
                <div class="flex items-center gap-2 px-3 py-2.5"
                     style="background:var(--color-gold-light);border-bottom:1px solid var(--color-gold-mid)">
                  <span class="font-semibold text-sm flex-1">{{ guestLabel(grp.guest) }}</span>

                  <!-- Bill number selector -->
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

                <!-- Items -->
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

            <!-- Bill summary: payment per merged bill -->
            <div class="pt-2" style="border-top:2px solid var(--color-border)">
              <p class="section-title mb-2">Итого по чекам</p>

              @for (bill of splitBills(); track bill.billNo) {
                <div class="mb-3 rounded-xl overflow-hidden" style="border:1.5px solid var(--color-gold)">
                  <div class="flex items-center justify-between px-3 py-2"
                       style="background:var(--color-gold-light)">
                    <div class="leading-tight">
                      <p class="font-bold text-sm">Чек {{ bill.billNo }}</p>
                      <p class="text-xs" style="color:var(--color-gold-hover)">
                        {{ billGuestNames(bill.guests) }}
                      </p>
                    </div>
                    <span class="font-bold" style="color:var(--color-gold-hover)">
                      {{ bill.total | number:'1.0-0' }} ₽
                    </span>
                  </div>
                  <div class="flex gap-2 px-3 py-2.5">
                    @for (p of payments; track p.value) {
                      <button (click)="setBillPay(bill.billNo, p.value)" class="btn btn-sm" style="flex:1"
                              [class]="billPayOf(bill.billNo) === p.value ? 'btn-primary' : 'btn-outline'">
                        {{ p.icon }} {{ p.label }}
                      </button>
                    }
                  </div>
                </div>
              }
            </div>
          </div>

          <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid var(--color-border)">
            <button (click)="confirm()" [disabled]="submitting()"
                    class="btn btn-primary btn-full" style="height:48px">
              {{ submitting() ? '⏳ ...'
                : '🧾 Закрыть и печать (' + splitBills().length + ' чека)' }}
            </button>
          </div>
        }
      </div>
    }
  `
})
export class TablesPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private cart = inject(CartService);
  private printer = inject(ReceiptPrintService);
  private toast = inject(ToastService);
  private router = inject(Router);
  net = inject(NetworkService);
  private outbox = inject(OutboxService);

  payments = PAYMENTS;
  private serverOrders = signal<Order[]>([]);

  /** Серверные столы + офлайн-столы из очереди + неотправленные дозаказы. */
  orders = computed<Order[]>(() => {
    const offline = this.outbox.offlineOrders();
    const server = this.serverOrders().map(o => {
      const pending = this.outbox.pendingItemsForOrder(o.id);
      return pending.length ? { ...o, items: [...o.items, ...pending] } : o;
    });
    return [...offline, ...server];
  });

  // new table dialog state
  private shiftId: number | null = null;
  newTable = signal(false);
  creating = signal(false);
  ntTable  = '';
  ntGuests: number | null = null;
  ntNotes  = '';

  private pollTimer?: ReturnType<typeof setInterval>;

  // edit table modal state
  editOrder  = signal<Order | null>(null);
  editTable  = '';
  editGuests: number | null = null;
  editNotes  = '';
  saving     = signal(false);

  openEdit(o: Order) {
    this.editTable  = o.table_number || '';
    this.editGuests = o.guests || null;
    this.editNotes  = o.notes || '';
    this.editOrder.set(o);
  }

  closeEdit() { this.editOrder.set(null); }

  saveEdit() {
    const o = this.editOrder();
    if (!o || this.saving() || !this.editTable.trim()) return;

    // Офлайн-стол редактируем в очереди.
    if (this.outbox.isOfflineId(o.id)) {
      this.outbox.updateOfflineOrder(o.id, {
        table_number: this.editTable.trim(),
        guests: this.editGuests || 0,
        notes: this.editNotes.trim(),
      });
      this.closeEdit();
      return;
    }

    this.saving.set(true);
    this.api.updateOrder(o.id, {
      table_number: this.editTable.trim(),
      guests: this.editGuests || 0,
      notes: this.editNotes.trim(),
    }).subscribe({
      next: updated => {
        this.replaceOrder(updated);
        this.saving.set(false);
        this.closeEdit();
      },
      error: () => { this.saving.set(false); this.toast.error('Не удалось сохранить'); },
    });
  }

  // checkout modal state
  checkout     = signal<Order | null>(null);
  checkoutStep = signal<'mode' | 'pay'>('mode');
  split        = signal(false);
  submitting   = signal(false);
  singlePay    = signal<PaymentMethod>('cash');
  // guest_no → bill number (1-based)
  private guestBillMap = signal<Record<number, number>>({});
  // bill number → payment method
  private billPayMap   = signal<Record<number, PaymentMethod>>({});

  coItems = computed(() => {
    const o = this.checkout();
    return o ? this.unpaidItems(o) : [];
  });

  totalAll = computed(() =>
    this.coItems().reduce((s, i) => s + +i.subtotal, 0)
  );

  // Депозит по брони, УЖЕ отмеченный оплаченным (вычитается автоматически).
  depositInfo = computed((): ReservationInfo | null => {
    const o = this.checkout();
    const r = o?.reservation_info;
    if (!r || !r.deposit_paid || +r.deposit_amount <= 0) return null;
    return r;
  });

  // Депозит по брони, который официант может отметить как внесённый.
  unpaidReservationDeposit = computed((): ReservationInfo | null => {
    const r = this.checkout()?.reservation_info;
    if (!r || r.deposit_paid || +r.deposit_amount <= 0) return null;
    return r;
  });

  // Ручной депозит (гость без брони).
  manualDepositOpen   = signal(false);
  manualDepositAmount = signal<number | null>(null);
  manualDepositMethod = signal<'cash' | 'transfer'>('cash');
  markingDeposit      = signal(false);

  manualDeposit = computed(() => {
    const a = this.manualDepositAmount();
    return a && a > 0 ? a : 0;
  });

  // Итоговый депозит к вычитанию из счёта (оплаченная бронь ИЛИ ручной; в раздельном — не применяется).
  activeDepositAmount = computed(() => {
    if (this.split()) return 0;
    const d = this.depositInfo();
    return d ? +d.deposit_amount : this.manualDeposit();
  });

  remainingAmount = computed(() =>
    Math.max(0, this.totalAll() - this.activeDepositAmount())
  );

  refundAmount = computed(() =>
    Math.max(0, this.activeDepositAmount() - this.totalAll())
  );

  // Groups by guest_no (for display in split mode)
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

  // Merged bills: bill number → { guests, items, total }
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
    return [...bills.entries()].sort(([a], [b]) => a - b)
      .map(([billNo, data]) => ({ billNo, ...data }));
  });

  // Which bill numbers can be chosen (all in use + one new)
  billChoices = computed(() => {
    const gbm = this.guestBillMap();
    const used = new Set(Object.values(gbm));
    const max  = used.size ? Math.max(...used) : 0;
    const nums = [...used].sort((a, b) => a - b);
    if (max < this.checkoutGuestGroups().length) nums.push(max + 1);
    return nums;
  });

  constructor() {
    // После успешной синхронизации офлайн-очереди сразу обновляем список столов,
    // чтобы только что отправленный стол не «пропал» до следующего опроса.
    effect(() => {
      this.outbox.synced();
      if (this.net.online()) this.load();
    });
  }

  ngOnInit() {
    this.load();
    this.api.getCurrentShift().subscribe({ next: s => this.shiftId = s?.id ?? null, error: () => {} });
    this.pollTimer = setInterval(() => this.load(), POLL_MS);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  load() {
    this.api.getActiveOrders().subscribe({
      next: o => this.serverOrders.set(o),
      error: () => { /* офлайн/сбой — оставляем последние известные данные */ },
    });
  }

  // ── new table ──────────────────────────────────────────────────
  openNewTable() { this.ntTable = ''; this.ntGuests = null; this.ntNotes = ''; this.creating.set(false); this.newTable.set(true); }
  closeNewTable() { this.newTable.set(false); }

  createTable() {
    if (this.creating() || !this.ntTable.trim()) return;
    if (!this.shiftId) { this.toast.error('Нет открытой смены'); return; }
    this.creating.set(true);
    this.api.createOrder({
      shift: this.shiftId, table_number: this.ntTable.trim(), guests: this.ntGuests || 0, notes: this.ntNotes.trim(), items: [],
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

  // ── per-guest grouping (раздельный вид карточки) ────────────────
  guestLabel(guest: number): string { return guest === 0 ? '👥 Общий' : 'Гость ' + guest; }

  /** Доступные номера гостей для переноса: [0 (общий), 1..N]. */
  guestOptions(o: Order): number[] {
    const used = this.unpaidItems(o).reduce((m, i) => Math.max(m, i.guest_no), 0);
    const n = Math.max(o.guests ?? 0, used);
    return [0, ...Array.from({ length: n }, (_, i) => i + 1)];
  }

  /** Группы неоплаченных позиций по гостям (только непустые), отсортированы по номеру. */
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

  confirmDeleteItem = signal<number | null>(null);

  askDeleteItem(item: OrderItem) {
    this.confirmDeleteItem.set(item.id);
  }

  removeItem(o: Order, item: OrderItem) {
    this.confirmDeleteItem.set(null);

    // Неотправленная позиция (офлайн-стол или дозаказ в очереди) — убираем из очереди.
    if (item._pending) {
      this.outbox.removePendingItem(item.id);
      return;
    }

    // Серверную позицию можно удалить только онлайн.
    if (!this.net.online()) {
      this.toast.warn('Удаление позиции доступно только при наличии сети');
      return;
    }

    this.api.removeItemFromOrder(o.id, item.id).subscribe({
      next: updated => this.replaceOrder(updated),
      error: (err) => {
        if (err?.status === 0) this.toast.warn('Нет сети — удаление недоступно');
        else this.toast.error('Не удалось удалить позицию');
      },
    });
  }

  moveItem(o: Order, item: OrderItem, guest: number) {
    if (item.guest_no === guest) return;
    this.api.setItemGuest(o.id, item.id, guest).subscribe({
      next: updated => this.replaceOrder(updated),
      error: () => this.toast.error('Не удалось перенести позицию'),
    });
  }

  private replaceOrder(updated: Order) {
    this.serverOrders.update(list => list.map(o => o.id === updated.id ? updated : o));
  }

  // ── helpers per order ──────────────────────────────────────────
  canCheckout(o: Order): boolean {
    return this.unpaidItems(o).length > 0
      && !o._offline
      && !o.items.some(i => i._pending)
      && this.net.online();
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

  // ── actions ────────────────────────────────────────────────────
  addMore(o: Order) {
    this.cart.setTarget(o);
    this.router.navigate(['/waiter/order']);
  }

  reprint(r: Receipt) {
    this.printer.printHardware(r);
  }

  // ── checkout modal ─────────────────────────────────────────────
  openCheckout(o: Order) {
    if (o._offline) {
      this.toast.warn('Стол ещё не синхронизирован — счёт можно закрыть после подключения');
      return;
    }
    if (!this.net.online()) {
      this.toast.warn('Закрытие счёта и печать доступны только при наличии сети');
      return;
    }
    if (o.items.some(i => i._pending)) {
      this.toast.warn('Идёт синхронизация позиций — повторите через пару секунд');
      return;
    }
    this.resetDeposit();
    this.checkout.set(o);
    this.checkoutStep.set('mode');
    this.split.set(false);
    this.singlePay.set('cash');
    this.guestBillMap.set({});
    this.billPayMap.set({});
    this.submitting.set(false);
  }

  closeCheckout() {
    this.checkout.set(null);
    this.checkoutStep.set('mode');
    this.resetDeposit();
  }

  resetDeposit() {
    this.markingDeposit.set(false);
    this.manualDepositOpen.set(false);
    this.manualDepositAmount.set(null);
    this.manualDepositMethod.set('cash');
  }

  clearManualDeposit() {
    this.manualDepositOpen.set(false);
    this.manualDepositAmount.set(null);
  }

  /** Официант отмечает депозит по брони как внесённый — он вычтется из счёта. */
  markDepositPaid() {
    const o = this.checkout();
    const r = o?.reservation_info;
    if (!o || !r || this.markingDeposit()) return;
    this.markingDeposit.set(true);
    this.api.markReservationDeposit(r.id, true).subscribe({
      next: () => {
        const updated: Order = { ...o, reservation_info: { ...r, deposit_paid: true } };
        this.replaceOrder(updated);
        this.checkout.set(updated);
        this.markingDeposit.set(false);
        this.toast.success('Депозит отмечен как внесён');
      },
      error: (err) => { this.markingDeposit.set(false); this.toast.apiError(err, 'Не удалось отметить депозит'); },
    });
  }

  chooseSingle() {
    this.split.set(false);
    this.checkoutStep.set('pay');
  }

  chooseSplit() {
    this.split.set(true);
    // Each guest starts on their own bill: guest index → bill number 1,2,3...
    const gbm: Record<number, number> = {};
    const bpm: Record<number, PaymentMethod> = {};
    this.checkoutGuestGroups().forEach((grp, idx) => {
      gbm[grp.guest] = idx + 1;
      bpm[idx + 1]   = 'cash';
    });
    this.guestBillMap.set(gbm);
    this.billPayMap.set(bpm);
    this.checkoutStep.set('pay');
  }

  guestBillOf(guest: number): number { return this.guestBillMap()[guest] ?? 1; }

  setGuestBill(guest: number, billNo: number) {
    this.guestBillMap.update(m => ({ ...m, [guest]: billNo }));
    if (!this.billPayMap()[billNo]) {
      this.billPayMap.update(m => ({ ...m, [billNo]: 'cash' }));
    }
  }

  billPayOf(billNo: number): PaymentMethod { return this.billPayMap()[billNo] ?? 'cash'; }

  setBillPay(billNo: number, method: PaymentMethod) {
    this.billPayMap.update(m => ({ ...m, [billNo]: method }));
  }

  billGuestNames(guests: number[]): string {
    return guests.map(g => this.guestLabel(g)).join(' + ');
  }

  confirm() {
    const o = this.checkout();
    if (!o || this.submitting() || !this.coItems().length) return;
    this.submitting.set(true);

    const billsPayload = this.split()
      ? this.splitBills().map(b => ({
          item_ids: b.items.map(i => i.id),
          payment_method: this.billPayOf(b.billNo),
        }))
      : [{ item_ids: this.coItems().map(i => i.id), payment_method: this.singlePay() }];

    const useDeposit = !this.split() && this.activeDepositAmount() > 0;
    const depMethod = this.depositInfo()?.deposit_method || this.manualDepositMethod();
    this.api.checkoutOrder(
      o.id,
      billsPayload,
      useDeposit ? this.activeDepositAmount() : undefined,
      useDeposit ? (depMethod || undefined) : undefined,
    ).subscribe({
      next: res => {
        this.submitting.set(false);
        this.printer.printHardware(res.receipts);
        this.toast.success(res.receipts.length > 1 ? 'Чеки сформированы' : 'Чек сформирован');
        this.closeCheckout();
        this.load();
      },
      error: (err) => { this.submitting.set(false); this.toast.apiError(err, 'Ошибка при закрытии счёта'); }
    });
  }
}