import { Component, OnInit, OnDestroy, signal, computed, inject, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { CartService } from '../../features/cart/cart.service';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { ReceiptPrintService } from '../../features/receipt/receipt-print.service';
import { KitchenTicket, KitchenItem, KitchenStatus, MenuByCategory, MenuItem, PaymentMethod, Product, MenuItemComponent } from '../../core/models';

const REFRESH_MS = 6000;

const PAY_OPTIONS: { value: PaymentMethod; label: string; icon: string }[] = [
  { value: 'cash',     label: 'Наличные', icon: '💵' },
  { value: 'card',     label: 'Карта',    icon: '💳' },
  { value: 'transfer', label: 'Перевод',  icon: '📲' },
];

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
              <span>🍽 Кухня</span>
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
            <button (click)="tab.set('stock')"
              class="flex flex-col items-center justify-center px-4 font-semibold transition-colors flex-shrink-0"
              style="min-height:52px;min-width:72px;font-size:0.82rem;border-left:1px solid #334155"
              [style]="tab() === 'stock' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              <span>📦 Склад</span>
            </button>
            <button (click)="tab.set('recipes')"
              class="flex flex-col items-center justify-center px-4 font-semibold transition-colors flex-shrink-0"
              style="min-height:52px;min-width:80px;font-size:0.82rem;border-left:1px solid #334155"
              [style]="tab() === 'recipes' ? 'background:#f59e0b;color:#0f172a' : 'background:transparent;color:#94a3b8'">
              <span>📋 Рецепты</span>
            </button>
          </div>

          <button (click)="toggleSound()"
                  class="flex items-center justify-center rounded-xl"
                  style="background:#1e293b;min-width:48px;min-height:48px;font-size:1.25rem">
            {{ soundOn() ? '🔔' : '🔕' }}
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
                      <div class="flex-shrink-0 flex items-center gap-2">
                        @if (it.kitchen_status === 'new') {
                          <button (click)="setStatus(it, 'cooking')"
                                  class="rounded-xl font-bold"
                                  style="background:#f59e0b;color:#0f172a;min-height:48px;padding:0 18px;font-size:0.9rem">
                            ▶ Начать
                          </button>
                        } @else if (it.kitchen_status === 'cooking') {
                          <button (click)="setStatus(it, 'ready')"
                                  class="rounded-xl font-bold"
                                  style="background:#22c55e;color:#0f172a;min-height:48px;padding:0 18px;font-size:0.9rem">
                            ✓ Готово
                          </button>
                        } @else {
                          <span class="rounded-xl font-bold flex items-center"
                                style="background:#15803d;color:white;min-height:40px;padding:0 14px;font-size:0.85rem">
                            ✓ Готов
                          </span>
                        }
                        @if (barConfirmDelete() === it.id) {
                          <button (click)="barRemoveItem(t.order_id, it)"
                                  class="rounded-lg font-bold"
                                  style="background:#ef4444;color:white;min-height:44px;padding:0 12px;font-size:0.85rem">
                            Да
                          </button>
                          <button (click)="barConfirmDelete.set(null)"
                                  class="rounded-lg"
                                  style="background:#334155;color:#94a3b8;min-height:44px;padding:0 12px;font-size:0.85rem">
                            Нет
                          </button>
                        } @else {
                          <button (click)="barConfirmDelete.set(it.id)"
                                  class="rounded-lg flex items-center justify-center"
                                  style="background:#334155;color:#94a3b8;min-width:44px;min-height:44px;font-size:1rem"
                                  title="Удалить">✕</button>
                        }
                      </div>
                    </div>
                  }
                </div>

                <!-- Mark all ready -->
                <button (click)="markAllReady(t)"
                        class="font-bold"
                        style="background:#15803d;color:white;min-height:56px;font-size:1rem;border:none;width:100%">
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

      <!-- ── КУХНЯ (read-only) ─────────────────────────────────────── -->
      @if (tab() === 'kitchen') {
        @if (noShift()) {
          <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
            <span class="text-6xl mb-4">😴</span>
            <p class="text-xl font-bold mb-1">Смена не открыта</p>
          </div>
        } @else if (!kitchenActive().length && !kitchenReady().length) {
          <div class="flex-1 flex flex-col items-center justify-center text-center px-4">
            <span class="text-5xl mb-3">✅</span>
            <p class="text-lg font-bold mb-1">Кухня свободна</p>
            <p style="color:#64748b">Активных заказов нет</p>
          </div>
        } @else {

          <!-- Готовые блюда — наверху, выделено зелёным -->
          @if (kitchenReady().length) {
            <section class="px-3 pt-3">
              <p class="text-xs font-bold mb-2 uppercase tracking-wider" style="color:#22c55e">
                ✅ Готово к выдаче ({{ kitchenReady().length }})
              </p>
              <div class="grid gap-2 mb-3"
                   style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
                @for (t of kitchenReady(); track t.order_id) {
                  <div class="rounded-xl p-3" style="background:#14532d;border:1px solid #166534">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-bold" style="color:#4ade80">#{{ t.order_id }}</span>
                      @if (t.table_number) {
                        <span class="text-sm font-semibold px-2 py-0.5 rounded"
                              style="background:rgba(0,0,0,0.3);color:#bbf7d0">{{ t.table_number }}</span>
                      }
                      <span class="text-xs ml-auto" style="color:#86efac">{{ t.waiter_name }}</span>
                    </div>
                    @for (it of t.items; track it.id) {
                      <p class="text-sm" style="color:#bbf7d0">{{ it.quantity }}× {{ it.name }}</p>
                    }
                  </div>
                }
              </div>
            </section>
          }

          <!-- В работе -->
          @if (kitchenActive().length) {
            <section class="px-3 pt-1 pb-4">
              <p class="text-xs font-bold mb-2 uppercase tracking-wider" style="color:#f59e0b">
                ⏳ Готовится ({{ kitchenActive().length }})
              </p>
              <div class="grid gap-2"
                   style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr))">
                @for (t of kitchenActive(); track t.order_id) {
                  <div class="rounded-xl p-3"
                       style="background:#1e293b;border:2px solid"
                       [style.border-color]="kitchenUrgency(t.elapsed_min)">
                    <div class="flex items-center gap-2 mb-2">
                      <span class="font-bold" style="color:#f59e0b">#{{ t.order_id }}</span>
                      @if (t.table_number) {
                        <span class="text-sm font-semibold px-2 py-0.5 rounded"
                              style="background:#334155;color:#f1f5f9">{{ t.table_number }}</span>
                      }
                      <span class="text-xs font-bold ml-auto" [style.color]="kitchenUrgency(t.elapsed_min)">
                        ⏱ {{ t.elapsed_min }} мин
                      </span>
                    </div>
                    @for (it of t.items; track it.id) {
                      <div class="flex items-center justify-between text-sm py-0.5">
                        <span>{{ it.quantity }}× {{ it.name }}</span>
                        <span class="text-xs px-2 py-0.5 rounded-full"
                              [style]="it.kitchen_status === 'cooking'
                                ? 'background:#f59e0b22;color:#f59e0b'
                                : 'background:#1e293b;color:#64748b'">
                          {{ it.kitchen_status === 'cooking' ? 'готовится' : 'ожидает' }}
                        </span>
                      </div>
                    }
                  </div>
                }
              </div>
            </section>
          }
        }
      }

      <!-- ── СКЛАД ──────────────────────────────────────────────────── -->
      @if (tab() === 'stock') {
        <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div class="px-3 py-2.5 flex-shrink-0">
            <input [ngModel]="stockSearch()" (ngModelChange)="stockSearch.set($event)"
                   class="w-full px-4 py-2.5 rounded-xl text-sm"
                   placeholder="Поиск продукта..."
                   style="background:#1e293b;border:1px solid #334155;color:#f1f5f9;outline:none"/>
          </div>
          <div class="flex-1 min-h-0 overflow-y-auto px-3 pb-6 space-y-2">
            @for (p of filteredProducts(); track p.id) {
              <div class="flex items-center gap-3 rounded-xl px-4 py-3"
                   style="background:#1e293b;border:1px solid #334155">
                <div class="flex-1 min-w-0">
                  <p class="font-semibold truncate">{{ p.name }}</p>
                  <p class="text-xs" style="color:#64748b">
                    {{ p.unit }}
                    @if (p.min_stock != null) { · мин: {{ p.min_stock }} }
                  </p>
                </div>
                <div class="text-right mr-2">
                  <p class="font-bold text-xl leading-none" [style.color]="stockColor(p)">
                    {{ p.stock_quantity }}
                  </p>
                  <p class="text-xs" style="color:#64748b">{{ p.unit }}</p>
                </div>
                <button (click)="openStockAdjust(p)"
                        class="rounded-xl font-bold text-base flex-shrink-0"
                        style="background:#334155;color:#f1f5f9;min-height:44px;min-width:48px">
                  ±
                </button>
              </div>
            }
            @if (!filteredProducts().length) {
              <p class="text-center py-10 text-sm" style="color:#64748b">Ничего не найдено</p>
            }
          </div>
        </div>
      }

      <!-- ── РЕЦЕПТУРЫ ───────────────────────────────────────────── -->
      @if (tab() === 'recipes') {
        <div class="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-1 pb-6">
          @for (cat of barMenu(); track cat.id) {
            <p class="text-xs font-bold uppercase tracking-wider px-1 pt-3 pb-1" style="color:#64748b">
              {{ cat.name }}
            </p>
            @for (item of cat.items; track item.id) {
              <div class="rounded-xl overflow-hidden mb-2" style="background:#1e293b;border:1px solid #334155">
                <button (click)="selectRecipeItem(item)"
                        class="w-full flex items-center gap-3 px-4 py-3"
                        style="border:none;text-align:left;background:transparent;cursor:pointer">
                  <div class="flex-1 min-w-0 text-left">
                    <p class="font-semibold text-sm">
                      {{ item.name }}
                      @if (item.volume) {
                        <span style="color:#64748b"> {{ item.volume }}</span>
                      }
                    </p>
                    <p class="text-xs" style="color:#64748b">{{ item.price }} ₽</p>
                  </div>
                  <span class="text-sm flex-shrink-0" style="color:#64748b">
                    {{ recipeSelectedItem()?.id === item.id ? '▾' : '▸' }}
                  </span>
                </button>

                @if (recipeSelectedItem()?.id === item.id) {
                  <div style="border-top:1px solid #334155">
                    @if (!recipeComponents().length) {
                      <p class="px-4 py-3 text-sm" style="color:#64748b">Рецептура не задана</p>
                    }
                    @for (comp of recipeComponents(); track comp.id) {
                      <div class="flex items-center gap-2 px-4 py-2.5" style="border-bottom:1px solid #0f172a">
                        <p class="flex-1 text-sm font-medium truncate">{{ comp.product_name }}</p>
                        <input type="number" [value]="comp.quantity" min="0.001" step="0.001"
                               class="w-20 text-center text-sm rounded-lg py-1.5"
                               style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"
                               (change)="updateComponentQty(comp, +$any($event.target).value)"/>
                        <span class="text-xs w-8 flex-shrink-0" style="color:#64748b">{{ comp.product_unit }}</span>
                        <button (click)="deleteComponent(comp.id)"
                                class="rounded-lg flex items-center justify-center flex-shrink-0"
                                style="background:#ef444422;color:#ef4444;min-width:36px;min-height:36px;border:none;cursor:pointer">
                          ✕
                        </button>
                      </div>
                    }
                    <div class="px-3 py-2.5 flex items-center gap-2" style="border-top:1px solid #334155">
                      <select [(ngModel)]="recipeNewProduct" class="flex-1 text-sm rounded-xl py-2 px-3"
                              style="background:#0f172a;border:1px solid #334155;color:#f1f5f9">
                        <option [ngValue]="null">Продукт...</option>
                        @for (p of products(); track p.id) {
                          <option [ngValue]="p.id">{{ p.name }} ({{ p.unit }})</option>
                        }
                      </select>
                      <input type="number" [(ngModel)]="recipeNewQty" min="0.001" step="0.001"
                             class="w-20 text-center text-sm rounded-xl py-2"
                             style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
                      <button (click)="addComponent()" [disabled]="!recipeNewProduct || recipeSaving()"
                              class="rounded-xl font-bold text-sm flex-shrink-0"
                              style="background:#f59e0b;color:#0f172a;min-height:40px;min-width:44px;border:none;cursor:pointer">
                        +
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
          }
        </div>
      }

      <!-- ── СВОЙ ЗАКАЗ ───────────────────────────────────────────── -->
      @if (tab() === 'new') {
        <div class="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">

          <!-- Menu panel -->
          <div class="flex-1 min-h-0 flex flex-col overflow-hidden">

            <!-- Label / guests row -->
            <div class="flex items-center gap-3 p-3 pb-2">
              <input [(ngModel)]="barLabel" class="field flex-1" placeholder="Стол / зона / стойка"
                     style="background:#1e293b;border-color:#334155;color:#f1f5f9"/>
              <input [(ngModel)]="barGuests" type="number" min="1" class="field w-20"
                     placeholder="Гостей" style="background:#1e293b;border-color:#334155;color:#f1f5f9"/>
            </div>

            <!-- Breadcrumb -->
            @if (activeCat() !== 0) {
              <div class="flex-shrink-0 flex items-center gap-1 px-3 pb-2 text-sm"
                   style="color:#64748b">
                <button (click)="goRoot()"
                        class="font-semibold hover:underline" style="color:#f59e0b">Меню</button>
                @if (activeDrink()) {
                  <span>›</span>
                  <button (click)="goCat()" class="font-semibold hover:underline"
                          style="color:#f59e0b">{{ activeCatName() }}</button>
                  <span>›</span>
                  <span style="color:#f1f5f9">{{ activeDrink() }}</span>
                } @else {
                  <span>›</span>
                  <span style="color:#f1f5f9">{{ activeCatName() }}</span>
                }
              </div>
            }

            <!-- ── Уровень 1: Сетка категорий ── -->
            @if (activeCat() === 0) {
              <div class="flex-1 min-h-0 overflow-y-auto p-3">
                <div class="grid gap-3"
                     style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
                  @for (cat of barMenu(); track cat.id) {
                    <button (click)="activeCat.set(cat.id)"
                            class="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition-all active:scale-95"
                            style="background:#1e293b;border:1px solid #334155;min-height:110px">
                      <span style="font-size:2.5rem;line-height:1">{{ cat.type === 'kitchen' ? '🍽' : '🍸' }}</span>
                      <span class="font-bold text-sm text-center leading-tight uppercase tracking-wide"
                            style="color:#f1f5f9">{{ cat.name }}</span>
                      <span class="text-xs" style="color:#64748b">{{ cat.items.length }} поз.</span>
                    </button>
                  }
                </div>
              </div>
            }

            <!-- ── Уровень 2: Папки по виду напитка/блюда ── -->
            @if (activeCat() !== 0 && !activeDrink()) {
              <div class="flex-1 min-h-0 overflow-y-auto p-3">
                <div class="grid gap-3"
                     style="grid-template-columns:repeat(auto-fill,minmax(130px,1fr))">
                  @for (group of drinkGroups(); track group.name) {
                    <button (click)="selectDrinkGroup(group)"
                            class="flex flex-col items-center justify-center gap-2 rounded-2xl p-4 transition-all active:scale-95"
                            style="background:#1e293b;border:1px solid #334155;min-height:110px">
                      <span style="font-size:2.5rem;line-height:1">{{ group.items.length > 1 ? '📁' : '✚' }}</span>
                      <span class="font-bold text-sm text-center leading-tight uppercase tracking-wide"
                            style="color:#f1f5f9">{{ group.name }}</span>
                      @if (group.items.length > 1) {
                        <span class="text-xs" style="color:#64748b">{{ group.items.length }} вар.</span>
                      } @else {
                        <span class="text-xs font-bold" style="color:#f59e0b">{{ group.items[0].price }} ₽</span>
                      }
                    </button>
                  }
                </div>
              </div>
            }

            <!-- ── Уровень 3: Варианты по объёму ── -->
            @if (activeCat() !== 0 && activeDrink()) {
              <div class="flex-1 min-h-0 overflow-y-auto p-3">
                <div class="grid gap-3"
                     style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">
                  @for (item of drinkVariants(); track item.id) {
                    <div class="flex flex-col rounded-2xl overflow-hidden relative"
                         style="background:#1e293b;border:1px solid;min-height:120px"
                         [style.border-color]="item.is_out_of_stock ? '#ef4444' : '#334155'">
                      <button (click)="!item.is_out_of_stock && addToCart(item)"
                              class="flex flex-col items-center justify-center gap-2 p-5 flex-1 transition-all active:scale-95"
                              [style.opacity]="item.is_out_of_stock ? '0.4' : '1'"
                              [style.cursor]="item.is_out_of_stock ? 'not-allowed' : 'pointer'">
                        <span style="font-size:2rem;line-height:1">🥃</span>
                        <span class="font-bold text-base" style="color:#f1f5f9">
                          {{ item.volume || 'Порция' }}
                        </span>
                        <span class="font-bold text-lg" style="color:#f59e0b">{{ item.price }} ₽</span>
                      </button>
                      <button (click)="toggleStock(item)"
                              class="py-1.5 text-xs font-bold text-center"
                              [style]="item.is_out_of_stock
                                ? 'background:#ef444422;color:#ef4444'
                                : 'background:#1e293b;color:#475569;border-top:1px solid #334155'">
                        {{ item.is_out_of_stock ? '🔴 Закончилось' : 'Отметить «нет»' }}
                      </button>
                    </div>
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
                <p class="text-sm py-4 text-center" style="color:#475569">Добавьте позиции</p>
              }
            </div>

            <div class="flex-shrink-0 px-4 py-3" style="border-top:1px solid #1e293b">
              <div class="flex items-center justify-between mb-3">
                <span style="color:#94a3b8">Итого</span>
                <span class="font-bold text-lg" style="color:#f59e0b">{{ cartTotal() | number:'1.0-0' }} ₽</span>
              </div>
              <button (click)="openPayModal()" [disabled]="!cartLines().length || submitting()"
                      class="w-full py-3 rounded-xl font-bold text-sm"
                      style="background:#f59e0b;color:#0f172a">
                {{ submitting() ? 'Отправка...' : 'Принять заказ' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ── Модальное окно корректировки склада ─────────────────── -->
      @if (stockAdjustTarget()) {
        <div class="fixed inset-0 z-50 flex items-end justify-center"
             style="background:rgba(0,0,0,0.75)" (click)="stockAdjustTarget.set(null)">
          <div class="w-full max-w-md rounded-t-2xl p-5"
               style="background:#1e293b;border-top:1px solid #334155"
               (click)="$event.stopPropagation()">
            <p class="font-bold text-lg mb-0.5">{{ stockAdjustTarget()!.name }}</p>
            <p class="text-sm mb-4" style="color:#94a3b8">
              Остаток:
              <span class="font-bold" [style.color]="stockColor(stockAdjustTarget()!)">
                {{ stockAdjustTarget()!.stock_quantity }} {{ stockAdjustTarget()!.unit }}
              </span>
            </p>
            <div class="grid grid-cols-2 gap-2 mb-4">
              <button (click)="stockAdjustReason = 'manual_in'"
                      class="py-3 rounded-xl font-bold text-sm"
                      [style]="stockAdjustReason === 'manual_in'
                        ? 'background:#22c55e;color:#0f172a;border:none'
                        : 'background:#0f172a;color:#94a3b8;border:1px solid #334155'">
                ↑ Приход
              </button>
              <button (click)="stockAdjustReason = 'manual_out'"
                      class="py-3 rounded-xl font-bold text-sm"
                      [style]="stockAdjustReason === 'manual_out'
                        ? 'background:#ef4444;color:white;border:none'
                        : 'background:#0f172a;color:#94a3b8;border:1px solid #334155'">
                ↓ Списание
              </button>
            </div>
            <div class="flex items-center gap-3 mb-4">
              <button (click)="stockAdjustQty = clamp1(stockAdjustQty - 1)"
                      class="w-12 h-12 rounded-xl font-bold text-xl flex-shrink-0"
                      style="background:#0f172a;color:#f1f5f9;border:1px solid #334155">−</button>
              <input type="number" [(ngModel)]="stockAdjustQty" min="1"
                     class="flex-1 text-center py-3 rounded-xl font-bold text-xl"
                     style="background:#0f172a;border:1px solid #334155;color:#f1f5f9"/>
              <button (click)="stockAdjustQty = stockAdjustQty + 1"
                      class="w-12 h-12 rounded-xl font-bold text-xl flex-shrink-0"
                      style="background:#0f172a;color:#f1f5f9;border:1px solid #334155">+</button>
            </div>
            <div class="flex gap-2">
              <button (click)="stockAdjustTarget.set(null)"
                      class="flex-1 py-3 rounded-xl font-semibold text-sm"
                      style="background:#0f172a;color:#94a3b8;border:1px solid #334155">
                Отмена
              </button>
              <button (click)="doAdjust()" [disabled]="stockAdjusting()"
                      class="flex-1 py-3 rounded-xl font-bold text-sm"
                      style="background:#f59e0b;color:#0f172a;border:none">
                {{ stockAdjusting() ? '...' : 'Сохранить' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- ── Модальное окно оплаты ──────────────────────────────── -->
      @if (payModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4"
             style="background:rgba(0,0,0,0.7)" (click)="payModal.set(false)">
          <div class="rounded-2xl p-6 w-full max-w-sm"
               style="background:#1e293b;border:1px solid #334155"
               (click)="$event.stopPropagation()">
            <p class="font-bold text-lg mb-1">Способ оплаты</p>
            <p class="text-sm mb-4" style="color:#64748b">
              Итого: <span class="font-bold" style="color:#f59e0b">{{ cartTotal() | number:'1.0-0' }} ₽</span>
            </p>

            <div class="grid grid-cols-3 gap-2 mb-5">
              @for (p of payOptions; track p.value) {
                <button (click)="selectedPay = p.value"
                        class="py-3 rounded-xl font-bold text-sm flex flex-col items-center gap-1 transition-all"
                        [style]="selectedPay === p.value
                          ? 'background:#f59e0b;color:#0f172a'
                          : 'background:#0f172a;color:#94a3b8;border:1px solid #334155'">
                  <span class="text-xl">{{ p.icon }}</span>
                  {{ p.label }}
                </button>
              }
            </div>

            <div class="flex gap-2">
              <button (click)="payModal.set(false)"
                      class="flex-1 py-2.5 rounded-xl font-semibold text-sm"
                      style="background:#0f172a;color:#94a3b8;border:1px solid #334155">
                Отмена
              </button>
              <button (click)="submitOrder()"
                      class="flex-1 py-2.5 rounded-xl font-bold text-sm"
                      style="background:#f59e0b;color:#0f172a">
                Принять и чек
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
  private printer = inject(ReceiptPrintService);

  barConfirmDelete = signal<number | null>(null);

  barRemoveItem(orderId: number, it: KitchenItem) {
    this.barConfirmDelete.set(null);
    this.api.removeItemFromOrder(orderId, it.id).subscribe({
      next: () => this.load(),
      error: (err) => this.toast.apiError(err, 'Не удалось удалить позицию'),
    });
  }

  toggleStock(item: MenuItem) {
    const prev = item.is_out_of_stock;
    item.is_out_of_stock = !prev;
    this.api.toggleOutOfStock(item.id).subscribe({
      error: () => { item.is_out_of_stock = prev; this.toast.error('Ошибка'); },
    });
  }

  tab        = signal<'orders' | 'new' | 'kitchen' | 'stock' | 'recipes'>('orders');
  active     = signal<KitchenTicket[]>([]);
  ready      = signal<KitchenTicket[]>([]);
  noShift    = signal(false);
  loading    = signal(false);
  lastUpdate = signal('—');
  showReady  = signal(false);
  soundOn    = signal(true);

  // kitchen readiness (read-only view for bartender)
  kitchenActive    = signal<KitchenTicket[]>([]);
  kitchenReady     = signal<KitchenTicket[]>([]);
  showKitchenReady = signal(false);
  kitchenUnseenCount = signal(0);
  private kitchenReadySeenIds = new Set<number>();

  // own order
  barMenu      = signal<{ id: number; name: string; type: string; items: MenuItem[] }[]>([]);
  barLabel     = '';
  barGuests    = 1;
  private cart = signal<Map<number, { item: MenuItem; qty: number }>>(new Map());
  submitting   = signal(false);

  // navigation: 0 = root, >0 = inside category
  activeCat     = signal<number>(0);
  // navigation: '' = drink-type grid, else = drink name selected
  activeDrink   = signal<string>('');

  activeCatName = computed(() =>
    this.barMenu().find(c => c.id === this.activeCat())?.name ?? ''
  );
  activeCatItems = computed(() =>
    this.barMenu().find(c => c.id === this.activeCat())?.items ?? []
  );

  // Group items inside a category by drink name (level 2 folders)
  drinkGroups = computed(() => {
    const map = new Map<string, MenuItem[]>();
    for (const item of this.activeCatItems()) {
      const key = item.name;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return [...map.entries()].map(([name, items]) => ({ name, items }));
  });

  // Items for the selected drink name (level 3 — by volume)
  drinkVariants = computed(() =>
    this.activeCatItems().filter(i => i.name === this.activeDrink())
  );

  goRoot() { this.activeCat.set(0); this.activeDrink.set(''); }
  goCat()  { this.activeDrink.set(''); }

  // ── Stock tab ─────────────────────────────────────────────────────
  products           = signal<Product[]>([]);
  stockSearch        = signal('');
  stockAdjustTarget  = signal<Product | null>(null);
  stockAdjustQty     = 1;
  stockAdjustReason: 'manual_in' | 'manual_out' = 'manual_in';
  stockAdjusting     = signal(false);

  filteredProducts = computed(() => {
    const q = this.stockSearch().trim().toLowerCase();
    const list = this.products().slice().sort((a, b) => {
      const aLow = a.is_low ? 0 : 1;
      const bLow = b.is_low ? 0 : 1;
      return aLow - bLow || a.name.localeCompare(b.name);
    });
    return q ? list.filter(p => p.name.toLowerCase().includes(q)) : list;
  });

  // ── Recipes tab ───────────────────────────────────────────────────
  recipeSelectedItem = signal<MenuItem | null>(null);
  recipeComponents   = signal<MenuItemComponent[]>([]);
  recipeNewProduct: number | null = null;
  recipeNewQty       = 1;
  recipeSaving       = signal(false);

  // payment modal
  payModal    = signal(false);
  selectedPay: PaymentMethod = 'cash';
  payOptions  = PAY_OPTIONS;

  cartLines = computed(() => [...this.cart().values()]);
  cartTotal = computed(() => this.cartLines().reduce((s, l) => s + l.item.price * l.qty, 0));

  private timer?: ReturnType<typeof setInterval>;
  private seenIds = new Set<number>();
  private primed  = false;
  private audioCtx?: AudioContext;

  ngOnInit() {
    this.load();
    this.loadMenu();
    this.loadProducts();
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
    this.api.getKitchenOrders('kitchen').subscribe({
      next: d => {
        this.kitchenActive.set(d.active);
        this.kitchenReady.set(d.ready);
        const unseen = d.ready.filter(t => !this.kitchenReadySeenIds.has(t.order_id)).length;
        this.kitchenUnseenCount.set(unseen);
      },
    });
  }

  loadMenu() {
    this.api.getMenuByCategory().subscribe(cats => {
      this.barMenu.set(
        cats.filter(c => c.station_type === 'bar' || c.station_type === 'kitchen')
            .map(c => ({ id: c.id, name: c.name, type: c.station_type, items: c.items }))
      );
      this.goRoot();
    });
  }

  selectDrinkGroup(group: { name: string; items: MenuItem[] }) {
    if (group.items.length === 1) {
      this.addToCart(group.items[0]);
    } else {
      this.activeDrink.set(group.name);
    }
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

  openPayModal() {
    if (!this.cartLines().length) return;
    this.selectedPay = 'cash';
    this.payModal.set(true);
  }

  submitOrder() {
    if (!this.cartLines().length || this.submitting()) return;
    this.payModal.set(false);
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
          next: order => {
            this.api.closeOrder(order.id, this.selectedPay).subscribe({
              next: res => {
                this.submitting.set(false);
                this.cart.set(new Map());
                this.barLabel = '';
                this.barGuests = 1;
                this.tab.set('orders');
                this.toast.success('Заказ принят');
                this.load();
                this.printer.printHardware(res.receipt);
              },
              error: () => {
                this.submitting.set(false);
                this.toast.error('Ошибка при закрытии заказа');
              },
            });
          },
          error: () => { this.submitting.set(false); this.toast.error('Ошибка при создании заказа'); },
        });
      },
      error: () => { this.submitting.set(false); this.toast.error('Нет открытой смены'); },
    });
  }

  // ── Stock methods ─────────────────────────────────────────────────
  loadProducts() {
    this.api.getProducts().subscribe(p => this.products.set(p));
  }

  stockColor(p: Product): string {
    if (p.is_low) return '#ef4444';
    if (p.min_stock != null && p.stock_quantity < p.min_stock * 1.5) return '#f59e0b';
    return '#22c55e';
  }

  openStockAdjust(product: Product) {
    this.stockAdjustTarget.set(product);
    this.stockAdjustQty = 1;
    this.stockAdjustReason = 'manual_in';
  }

  clamp1(n: number) { return Math.max(1, n); }

  doAdjust() {
    const p = this.stockAdjustTarget();
    if (!p) return;
    this.stockAdjusting.set(true);
    const qty = this.stockAdjustReason === 'manual_out'
      ? -Math.abs(this.stockAdjustQty)
      : Math.abs(this.stockAdjustQty);
    this.api.adjustStock({ product: p.id, quantity: qty, reason: this.stockAdjustReason }).subscribe({
      next: updated => {
        this.products.update(list => list.map(x => x.id === updated.id ? updated : x));
        this.stockAdjustTarget.set(null);
        this.stockAdjusting.set(false);
        this.toast.success('Остатки обновлены');
      },
      error: (err) => { this.stockAdjusting.set(false); this.toast.apiError(err, 'Ошибка при обновлении остатков'); },
    });
  }

  // ── Recipe methods ────────────────────────────────────────────────
  selectRecipeItem(item: MenuItem) {
    if (this.recipeSelectedItem()?.id === item.id) {
      this.recipeSelectedItem.set(null);
      return;
    }
    this.recipeSelectedItem.set(item);
    this.recipeComponents.set([]);
    this.recipeNewProduct = null;
    this.recipeNewQty = 1;
    this.api.getComponents(item.id).subscribe(c => this.recipeComponents.set(c));
  }

  addComponent() {
    const item = this.recipeSelectedItem();
    if (!item || !this.recipeNewProduct) return;
    this.recipeSaving.set(true);
    this.api.createComponent({ menu_item: item.id, product: this.recipeNewProduct, quantity: this.recipeNewQty }).subscribe({
      next: () => {
        this.api.getComponents(item.id).subscribe(c => this.recipeComponents.set(c));
        this.recipeNewProduct = null;
        this.recipeNewQty = 1;
        this.recipeSaving.set(false);
      },
      error: (err) => { this.recipeSaving.set(false); this.toast.apiError(err, 'Ошибка при добавлении компонента'); },
    });
  }

  updateComponentQty(comp: MenuItemComponent, qty: number) {
    if (!qty || qty <= 0) return;
    this.api.updateComponent(comp.id, qty).subscribe({
      next: updated => this.recipeComponents.update(list => list.map(c => c.id === updated.id ? updated : c)),
      error: (err) => this.toast.apiError(err, 'Ошибка при обновлении рецепта'),
    });
  }

  deleteComponent(compId: number) {
    const item = this.recipeSelectedItem();
    if (!item) return;
    this.api.deleteComponent(compId).subscribe({
      next: () => this.api.getComponents(item.id).subscribe(c => this.recipeComponents.set(c)),
      error: (err) => this.toast.apiError(err, 'Ошибка при удалении компонента'),
    });
  }

  openKitchenTab() {
    this.tab.set('kitchen');
    this.kitchenReady().forEach(t => this.kitchenReadySeenIds.add(t.order_id));
    this.kitchenUnseenCount.set(0);
  }

  kitchenUrgency(min: number): string {
    if (min >= 15) return '#ef4444';
    if (min >= 8)  return '#f59e0b';
    return '#22c55e';
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
