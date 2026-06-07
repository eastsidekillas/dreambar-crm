import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import {
  Product, MenuItemComponent, ConsumptionRow, MenuByCategory,
  InventoryMovement, MovementReason, PRODUCT_UNITS,
} from '../../../core/models';

type Tab = 'stock' | 'recipes' | 'consumption' | 'movements';

const REASON_LABELS: Record<MovementReason, string> = {
  sale:       'Продажа',
  manual_in:  'Приход',
  manual_out: 'Списание',
  adjustment: 'Инвентаризация',
};

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-4">

  <!-- Header -->
  <div class="flex items-center justify-between gap-2 flex-wrap">
    <div>
      <h1 class="text-xl font-bold">Склад</h1>
      @if (lowCount() > 0) {
        <p class="text-xs mt-0.5" style="color:#dc2626">
          ⚠️ {{ lowCount() }} позиц{{ lowCount() === 1 ? 'ия' : 'ии' }} ниже минимума
        </p>
      }
    </div>
  </div>

  <!-- Tabs -->
  <div class="flex gap-1 p-1 rounded-xl" style="background:var(--color-border)">
    @for (t of tabs; track t.key) {
      <button (click)="setTab(t.key)"
              class="flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5"
              [style]="tab() === t.key
                ? 'background:white;color:var(--color-text);box-shadow:0 1px 3px rgba(0,0,0,.1)'
                : 'background:transparent;color:var(--color-muted)'">
        {{ t.icon }} <span class="hidden sm:inline">{{ t.label }}</span>
        @if (t.key === 'stock' && lowCount() > 0) {
          <span class="w-4 h-4 rounded-full text-white flex items-center justify-center"
                style="background:#dc2626;font-size:9px;font-weight:700">{{ lowCount() }}</span>
        }
      </button>
    }
  </div>

  <!-- ══ TAB: ОСТАТКИ ════════════════════════════════════════════ -->
  @if (tab() === 'stock') {
    <div class="space-y-3">

      <!-- Toolbar -->
      <div class="flex items-center gap-2 flex-wrap">
        <button (click)="showAddProduct.set(!showAddProduct())"
                class="btn btn-primary btn-sm">
          + Товар
        </button>
        <button (click)="stockFilter.set(stockFilter() === 'low' ? 'all' : 'low')"
                class="btn btn-sm"
                [style]="stockFilter() === 'low'
                  ? 'background:#fee2e2;color:#dc2626;border:1px solid #fca5a5'
                  : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
          ⚠️ Только нехватка
        </button>
        <span class="ml-auto text-xs" style="color:var(--color-muted)">
          {{ filteredProducts().length }} / {{ products().length }}
        </span>
      </div>

      <!-- Add form -->
      @if (showAddProduct()) {
        <div class="card" style="border-color:var(--color-gold)">
          <h3 class="font-semibold mb-3 text-sm">Новый товар</h3>
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div class="col-span-2">
              <label class="section-title block mb-1">Название</label>
              <input [(ngModel)]="newProduct.name" class="field" placeholder="Водка TUNDRA"/>
            </div>
            <div>
              <label class="section-title block mb-1">Единица</label>
              <select [(ngModel)]="newProduct.unit" class="field">
                @for (u of units; track u) { <option [value]="u">{{ u }}</option> }
              </select>
            </div>
            <div>
              <label class="section-title block mb-1">Объём упаковки</label>
              <input [(ngModel)]="newProduct.pack_size" type="number" min="0.001" step="any" class="field" placeholder="500"/>
            </div>
            <div>
              <label class="section-title block mb-1">Цена упаковки ₽</label>
              <input [(ngModel)]="newProduct.purchase_price" type="number" min="0" class="field" placeholder="800"/>
            </div>
            <div>
              <label class="section-title block mb-1">Минимальный остаток</label>
              <input [(ngModel)]="newProduct.min_stock" type="number" min="0" step="any" class="field" placeholder="необязательно"/>
            </div>
          </div>
          <div class="flex gap-2">
            <button (click)="saveProduct()" class="btn btn-primary btn-sm">Сохранить</button>
            <button (click)="showAddProduct.set(false)" class="btn btn-ghost btn-sm">Отмена</button>
          </div>
        </div>
      }

      <!-- Products table -->
      @if (filteredProducts().length) {
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-bg);border-bottom:1px solid var(--color-border)">
                <th class="text-left px-4 py-2.5 font-semibold section-title">Товар</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title">Остаток</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title hidden sm:table-cell">Минимум</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title hidden md:table-cell">Упаковка</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title hidden md:table-cell">Цена уп.</th>
                <th class="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              @for (p of filteredProducts(); track p.id) {

                <!-- Edit row -->
                @if (editProductId() === p.id) {
                  <tr style="border-bottom:1px solid var(--color-border);background:var(--color-gold-light)">
                    <td class="px-3 py-2">
                      <input [(ngModel)]="editProduct.name" class="field" style="height:30px"/>
                    </td>
                    <td class="px-3 py-2 text-right">
                      <div class="flex items-center gap-1 justify-end">
                        <input [(ngModel)]="editProduct.stock_quantity" type="number" step="any"
                               class="field text-right" style="height:30px;width:70px"/>
                        <select [(ngModel)]="editProduct.unit" class="field" style="height:30px;width:54px">
                          @for (u of units; track u) { <option [value]="u">{{ u }}</option> }
                        </select>
                      </div>
                    </td>
                    <td class="px-3 py-2 hidden sm:table-cell">
                      <input [(ngModel)]="editProduct.min_stock" type="number" step="any" placeholder="—"
                             class="field text-right" style="height:30px;width:70px"/>
                    </td>
                    <td class="px-3 py-2 hidden md:table-cell">
                      <input [(ngModel)]="editProduct.pack_size" type="number" step="any"
                             class="field text-right" style="height:30px;width:70px"/>
                    </td>
                    <td class="px-3 py-2 hidden md:table-cell">
                      <input [(ngModel)]="editProduct.purchase_price" type="number" step="any"
                             class="field text-right" style="height:30px;width:70px"/>
                    </td>
                    <td class="px-3 py-2">
                      <div class="flex gap-1">
                        <button (click)="saveEditProduct(p)" class="btn btn-primary btn-sm">✓</button>
                        <button (click)="editProductId.set(null)" class="btn btn-ghost btn-sm">✕</button>
                      </div>
                    </td>
                  </tr>

                <!-- Normal row -->
                } @else {
                  <tr style="border-bottom:1px solid var(--color-border)" [style.opacity]="p.is_active ? '1' : '0.45'">
                    <td class="px-4 py-2.5">
                      <span class="font-medium">{{ p.name }}</span>
                    </td>
                    <td class="px-3 py-2.5 text-right">
                      <span class="font-bold text-base"
                            [style.color]="stockColor(p)">
                        {{ p.stock_quantity | number:'1.0-2' }}
                      </span>
                      <span class="text-xs ml-0.5" style="color:var(--color-muted)">{{ p.unit }}</span>
                    </td>
                    <td class="px-3 py-2.5 text-right hidden sm:table-cell" style="color:var(--color-muted)">
                      {{ p.min_stock != null ? (p.min_stock | number:'1.0-2') + ' ' + p.unit : '—' }}
                    </td>
                    <td class="px-3 py-2.5 text-right hidden md:table-cell" style="color:var(--color-muted)">
                      {{ p.pack_size | number:'1.0-2' }} {{ p.unit }}
                    </td>
                    <td class="px-3 py-2.5 text-right hidden md:table-cell" style="color:var(--color-muted)">
                      {{ p.purchase_price | number:'1.0-0' }} ₽
                    </td>
                    <td class="px-3 py-2.5">
                      <div class="flex gap-1 justify-end">
                        <button (click)="startAdjust(p)"
                                class="btn btn-sm"
                                style="background:var(--color-gold-light);color:var(--color-gold-hover);font-size:11px">
                          ± Корректировать
                        </button>
                        <button (click)="startEditProduct(p)" class="btn btn-ghost btn-sm">✏</button>
                      </div>
                    </td>
                  </tr>
                }

                <!-- Adjust inline row -->
                @if (adjustProductId() === p.id) {
                  <tr style="border-bottom:2px solid var(--color-gold);background:#fffbeb">
                    <td colspan="6" class="px-4 py-3">
                      <div class="flex flex-wrap items-end gap-3">

                        <!-- Reason buttons -->
                        <div>
                          <p class="section-title mb-1.5">Операция</p>
                          <div class="flex gap-1">
                            @for (r of adjustReasons; track r.key) {
                              <button (click)="adjustReason.set(r.key)"
                                      class="btn btn-sm"
                                      [style]="adjustReason() === r.key
                                        ? r.style + ';border:2px solid currentColor'
                                        : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
                                {{ r.icon }} {{ r.label }}
                              </button>
                            }
                          </div>
                        </div>

                        <!-- Qty input -->
                        <div>
                          <p class="section-title mb-1.5">
                            {{ adjustReason() === 'adjustment' ? 'Фактический остаток (' + p.unit + ')' : 'Количество (' + p.unit + ')' }}
                          </p>
                          <input [(ngModel)]="adjustQty" type="number" min="0" step="any"
                                 class="field" style="width:110px"
                                 [placeholder]="adjustReason() === 'adjustment' ? p.stock_quantity.toString() : '0'"/>
                        </div>

                        <!-- Note -->
                        <div class="flex-1 min-w-[140px]">
                          <p class="section-title mb-1.5">Комментарий (необязательно)</p>
                          <input [(ngModel)]="adjustNote" class="field" placeholder="Поступление от поставщика..."/>
                        </div>

                        <!-- Actions -->
                        <div class="flex gap-2 items-end">
                          <button (click)="applyAdjust(p)" class="btn btn-primary btn-sm">Применить</button>
                          <button (click)="adjustProductId.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
                        </div>

                      </div>

                      <!-- Preview -->
                      @if (adjustQty !== null && adjustQty !== undefined && adjustQty !== '') {
                        <p class="text-xs mt-2" style="color:var(--color-muted)">
                          {{ adjustPreview(p) }}
                        </p>
                      }
                    </td>
                  </tr>
                }

              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="text-center py-10" style="color:var(--color-muted)">
          <span class="text-3xl block mb-2">📦</span>
          {{ products().length ? 'Нет позиций с нехваткой' : 'Товары ещё не добавлены' }}
        </div>
      }

    </div>
  }

  <!-- ══ TAB: РЕЦЕПТУРЫ ══════════════════════════════════════════ -->
  @if (tab() === 'recipes') {
    @if (!products().length) {
      <div class="card text-center py-8" style="color:var(--color-muted)">
        Сначала добавьте товары на вкладке «Остатки»
      </div>
    } @else {
      <p class="text-sm" style="color:var(--color-muted)">
        Укажите из чего состоит каждая позиция меню — это нужно для автоматического списания при продаже.
      </p>
      <div class="space-y-2">
        @for (cat of menuByCategory(); track cat.id) {
          <div class="card p-0 overflow-hidden">
            <div class="px-4 py-2.5 flex items-center gap-2"
                 style="background:var(--color-bg);border-bottom:1px solid var(--color-border)">
              <span>{{ catIcon(cat.station_type) }}</span>
              <span class="font-semibold text-sm">{{ cat.name }}</span>
              <span class="badge badge-gray">{{ cat.items.length }}</span>
              <span class="ml-auto text-xs" style="color:var(--color-muted)">
                {{ recipedCount(cat.items) }} / {{ cat.items.length }} с рецептурой
              </span>
            </div>
            @for (item of cat.items; track item.id) {
              <div style="border-bottom:1px solid var(--color-border)">
                <div class="flex items-center gap-2 px-4 py-2.5 cursor-pointer"
                     style="transition:background .1s"
                     (click)="toggleRecipe(item.id)">
                  <span class="flex-1 text-sm font-medium">{{ item.name }}</span>
                  @if (item.volume) {
                    <span class="text-xs" style="color:var(--color-muted)">{{ item.volume }}</span>
                  }
                  <span class="text-xs px-2 py-0.5 rounded-full"
                        [style]="componentCount(item.id) > 0
                          ? 'background:#dcfce7;color:#16a34a'
                          : 'background:var(--color-bg);color:var(--color-muted)'">
                    {{ componentCount(item.id) > 0 ? componentCount(item.id) + ' комп.' : 'нет' }}
                  </span>
                  <span class="text-xs" style="color:var(--color-muted)">{{ recipeOpen(item.id) ? '▲' : '▼' }}</span>
                </div>
                @if (recipeOpen(item.id)) {
                  <div class="px-4 pb-3 pt-1" style="background:var(--color-bg)">
                    @for (comp of componentsFor(item.id); track comp.id) {
                      <div class="flex items-center gap-2 mb-1.5">
                        <span class="text-sm flex-1">{{ comp.product_name }}</span>
                        @if (editCompId() === comp.id) {
                          <input [(ngModel)]="editCompQty" type="number" min="0.001" step="any"
                                 class="field text-sm text-right" style="width:80px;height:28px"/>
                          <span class="text-xs" style="color:var(--color-muted)">{{ comp.product_unit }}</span>
                          <button (click)="saveEditComp(comp)" class="btn btn-primary btn-sm" style="height:28px">✓</button>
                          <button (click)="editCompId.set(null)" class="btn btn-ghost btn-sm" style="height:28px">✕</button>
                        } @else {
                          <span class="text-sm font-medium">{{ comp.quantity | number:'1.0-3' }} {{ comp.product_unit }}</span>
                          <button (click)="startEditComp(comp)" class="btn btn-ghost btn-sm" style="height:26px;font-size:11px">✏</button>
                          <button (click)="deleteComp(comp)" class="btn btn-sm"
                                  style="height:26px;font-size:11px;background:#fee2e2;color:#dc2626">🗑</button>
                        }
                      </div>
                    }
                    @if (addingCompFor() === item.id) {
                      <div class="flex items-center gap-2 mt-2 pt-2" style="border-top:1px solid var(--color-border)">
                        <select [(ngModel)]="newComp.product" class="field text-sm flex-1" style="height:30px">
                          <option [value]="0" disabled>Выбрать товар...</option>
                          @for (p of activeProducts(); track p.id) {
                            <option [value]="p.id">{{ p.name }} ({{ p.unit }})</option>
                          }
                        </select>
                        <input [(ngModel)]="newComp.quantity" type="number" min="0.001" step="any"
                               class="field text-sm text-right" style="width:80px;height:30px" placeholder="50"/>
                        <span class="text-xs shrink-0" style="color:var(--color-muted)">
                          {{ unitForProduct(newComp.product) }}
                        </span>
                        <button (click)="saveNewComp(item.id)" class="btn btn-primary btn-sm">✓</button>
                        <button (click)="addingCompFor.set(null)" class="btn btn-ghost btn-sm">✕</button>
                      </div>
                    } @else {
                      <button (click)="startAddComp(item.id)"
                              class="btn btn-ghost btn-sm mt-2 text-xs"
                              style="color:var(--color-gold-hover)">
                        + Добавить компонент
                      </button>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }
      </div>
    }
  }

  <!-- ══ TAB: РАСХОД ═════════════════════════════════════════════ -->
  @if (tab() === 'consumption') {
    <div class="space-y-4">
      <div class="card">
        <p class="section-title mb-3">Период расчёта</p>
        <div class="flex flex-wrap gap-2 mb-3">
          @for (preset of presets; track preset.label) {
            <button (click)="applyPreset(preset)"
                    class="btn btn-sm"
                    [style]="selectedPreset() === preset.label
                      ? 'background:var(--color-gold);color:#fff;border:none'
                      : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
              {{ preset.label }}
            </button>
          }
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div>
            <label class="section-title block mb-1">С</label>
            <input type="date" [(ngModel)]="dateFrom" (ngModelChange)="selectedPreset.set('')" class="field" style="height:34px"/>
          </div>
          <div>
            <label class="section-title block mb-1">По</label>
            <input type="date" [(ngModel)]="dateTo" (ngModelChange)="selectedPreset.set('')" class="field" style="height:34px"/>
          </div>
          <div class="self-end">
            <button (click)="loadConsumption()" class="btn btn-primary" style="height:34px">Рассчитать</button>
          </div>
        </div>
      </div>

      @if (consumptionLoading()) {
        <div class="text-center py-8" style="color:var(--color-muted)">
          <span class="text-2xl block mb-2">⏳</span>Расчёт...
        </div>
      } @else if (consumption().length) {
        <div class="card" style="background:var(--color-gold-light);border-color:var(--color-gold-mid)">
          <div class="flex flex-wrap gap-6">
            <div>
              <p class="section-title">Позиций к закупке</p>
              <p class="text-2xl font-bold" style="color:var(--color-gold-hover)">{{ consumption().length }}</p>
            </div>
            <div>
              <p class="section-title">Сумма закупки</p>
              <p class="text-2xl font-bold" style="color:var(--color-gold-hover)">{{ totalCost() | number:'1.0-0' }} ₽</p>
            </div>
          </div>
        </div>
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-bg);border-bottom:1px solid var(--color-border)">
                <th class="text-left px-4 py-2.5 font-semibold section-title">Товар</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title">Остаток</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title">Расход</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title hidden sm:table-cell">Упак.</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title">Купить</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title hidden sm:table-cell">₽ / уп</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title">Итого ₽</th>
              </tr>
            </thead>
            <tbody>
              @for (row of consumption(); track row.product_id) {
                <tr style="border-bottom:1px solid var(--color-border)">
                  <td class="px-4 py-2.5 font-medium">{{ row.product_name }}</td>
                  <td class="px-3 py-2.5 text-right">
                    <span [style.color]="row.stock_quantity <= 0 ? '#dc2626' : row.stock_quantity < row.total_units ? '#ea580c' : '#16a34a'">
                      {{ row.stock_quantity | number:'1.0-2' }}
                    </span>
                    <span class="text-xs ml-0.5" style="color:var(--color-muted)">{{ row.unit }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-right" style="color:var(--color-muted)">
                    {{ row.total_units | number:'1.0-2' }} {{ row.unit }}
                  </td>
                  <td class="px-3 py-2.5 text-right hidden sm:table-cell" style="color:var(--color-muted)">
                    {{ row.total_packs | number:'1.0-2' }}
                  </td>
                  <td class="px-3 py-2.5 text-right">
                    <span class="font-bold text-base" style="color:var(--color-gold-hover)">{{ row.packs_to_buy }}</span>
                  </td>
                  <td class="px-3 py-2.5 text-right hidden sm:table-cell">{{ row.purchase_price | number:'1.0-0' }}</td>
                  <td class="px-3 py-2.5 text-right font-semibold">{{ row.total_cost | number:'1.0-0' }}</td>
                </tr>
              }
            </tbody>
            <tfoot>
              <tr style="background:var(--color-bg);border-top:2px solid var(--color-border)">
                <td class="px-4 py-2.5 font-bold" colspan="6">Итого к закупке</td>
                <td class="px-3 py-2.5 text-right font-bold text-base">{{ totalCost() | number:'1.0-0' }} ₽</td>
              </tr>
            </tfoot>
          </table>
        </div>
      } @else if (consumptionQueried()) {
        <div class="text-center py-10" style="color:var(--color-muted)">
          <span class="text-3xl block mb-2">🤔</span>
          Нет данных — возможно, не заполнены рецептуры или нет продаж за период
        </div>
      }
    </div>
  }

  <!-- ══ TAB: ДВИЖЕНИЯ ═══════════════════════════════════════════ -->
  @if (tab() === 'movements') {
    <div class="space-y-3">

      <!-- Filter bar -->
      <div class="card py-3">
        <div class="flex flex-wrap gap-3 items-end">
          <div>
            <label class="section-title block mb-1">Товар</label>
            <select [(ngModel)]="movementsFilter.productId" class="field" style="height:34px;min-width:160px">
              <option [value]="null">Все товары</option>
              @for (p of products(); track p.id) {
                <option [value]="p.id">{{ p.name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="section-title block mb-1">Тип</label>
            <select [(ngModel)]="movementsFilter.reason" class="field" style="height:34px">
              <option value="">Все</option>
              <option value="sale">Продажа</option>
              <option value="manual_in">Приход</option>
              <option value="manual_out">Списание</option>
              <option value="adjustment">Инвентаризация</option>
            </select>
          </div>
          <button (click)="loadMovements()" class="btn btn-primary btn-sm" style="height:34px">
            Загрузить
          </button>
        </div>
      </div>

      @if (movementsLoading()) {
        <div class="text-center py-8" style="color:var(--color-muted)">⏳ Загрузка...</div>
      } @else if (filteredMovements().length) {
        <div class="card p-0 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr style="background:var(--color-bg);border-bottom:1px solid var(--color-border)">
                <th class="text-left px-4 py-2.5 font-semibold section-title">Дата и время</th>
                <th class="text-left px-3 py-2.5 font-semibold section-title">Товар</th>
                <th class="text-right px-3 py-2.5 font-semibold section-title">Количество</th>
                <th class="text-left px-3 py-2.5 font-semibold section-title hidden sm:table-cell">Тип</th>
                <th class="text-left px-3 py-2.5 font-semibold section-title hidden md:table-cell">Кто</th>
                <th class="text-left px-3 py-2.5 font-semibold section-title hidden md:table-cell">Комментарий</th>
              </tr>
            </thead>
            <tbody>
              @for (m of filteredMovements(); track m.id) {
                <tr style="border-bottom:1px solid var(--color-border)">
                  <td class="px-4 py-2.5 whitespace-nowrap" style="color:var(--color-muted)">
                    {{ m.created_at | date:'dd.MM HH:mm' }}
                  </td>
                  <td class="px-3 py-2.5 font-medium">{{ m.product_name }}</td>
                  <td class="px-3 py-2.5 text-right font-bold whitespace-nowrap"
                      [style.color]="m.quantity >= 0 ? '#16a34a' : '#dc2626'">
                    {{ m.quantity >= 0 ? '+' : '' }}{{ m.quantity | number:'1.0-3' }}
                    <span class="font-normal text-xs ml-0.5" style="color:var(--color-muted)">{{ m.product_unit }}</span>
                  </td>
                  <td class="px-3 py-2.5 hidden sm:table-cell">
                    <span class="text-xs px-2 py-0.5 rounded-full" [style]="reasonStyle(m.reason)">
                      {{ reasonLabel(m.reason) }}
                    </span>
                  </td>
                  <td class="px-3 py-2.5 hidden md:table-cell" style="color:var(--color-muted)">
                    {{ m.created_by_name ?? '—' }}
                  </td>
                  <td class="px-3 py-2.5 hidden md:table-cell" style="color:var(--color-muted)">
                    {{ m.note || '—' }}
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="text-center py-10" style="color:var(--color-muted)">
          <span class="text-3xl block mb-2">📋</span>
          Движений не найдено
        </div>
      }

    </div>
  }

</div>
  `,
})
export class InventoryPage implements OnInit {
  tab = signal<Tab>('stock');

  tabs = [
    { key: 'stock'       as Tab, icon: '📦', label: 'Остатки'   },
    { key: 'recipes'     as Tab, icon: '🧪', label: 'Рецептуры' },
    { key: 'consumption' as Tab, icon: '📊', label: 'Расход'    },
    { key: 'movements'   as Tab, icon: '📋', label: 'Движения'  },
  ];

  units = PRODUCT_UNITS;

  // ── Products / Stock ──────────────────────────────────────────────
  products       = signal<Product[]>([]);
  showAddProduct = signal(false);
  stockFilter    = signal<'all' | 'low'>('all');
  editProductId  = signal<number | null>(null);
  newProduct: Partial<Product> = { name: '', unit: 'мл', pack_size: 1, purchase_price: 0, min_stock: null };
  editProduct: Partial<Product> = {};
  activeProducts = computed(() => this.products().filter(p => p.is_active));
  lowCount       = computed(() => this.products().filter(p => p.is_low).length);

  filteredProducts = computed(() =>
    this.stockFilter() === 'low'
      ? this.products().filter(p => p.is_low)
      : this.products()
  );

  // ── Adjustment ────────────────────────────────────────────────────
  adjustProductId = signal<number | null>(null);
  adjustReason    = signal<MovementReason>('manual_in');
  adjustQty: any  = '';
  adjustNote      = '';

  adjustReasons = [
    { key: 'manual_in'  as MovementReason, icon: '+', label: 'Приход',        style: 'background:#dcfce7;color:#16a34a' },
    { key: 'manual_out' as MovementReason, icon: '−', label: 'Списание',      style: 'background:#fee2e2;color:#dc2626' },
    { key: 'adjustment' as MovementReason, icon: '=', label: 'Инвентаризация', style: 'background:#eff6ff;color:#2563eb' },
  ];

  // ── Recipes ───────────────────────────────────────────────────────
  menuByCategory = signal<MenuByCategory[]>([]);
  components     = signal<MenuItemComponent[]>([]);
  openRecipes    = signal<Set<number>>(new Set());
  addingCompFor  = signal<number | null>(null);
  editCompId     = signal<number | null>(null);
  editCompQty    = 0;
  newComp        = { product: 0, quantity: 0 };

  componentsMap = computed(() => {
    const map = new Map<number, MenuItemComponent[]>();
    for (const c of this.components()) {
      const arr = map.get(c.menu_item) ?? [];
      arr.push(c);
      map.set(c.menu_item, arr);
    }
    return map;
  });

  // ── Consumption ───────────────────────────────────────────────────
  dateFrom           = '';
  dateTo             = '';
  selectedPreset     = signal('');
  consumption        = signal<ConsumptionRow[]>([]);
  consumptionLoading = signal(false);
  consumptionQueried = signal(false);
  totalCost          = computed(() => this.consumption().reduce((s, r) => s + r.total_cost, 0));

  presets = [
    { label: 'Последние 2 смены', days: 14 },
    { label: 'Последний месяц',   days: 30 },
    { label: 'Последние 3 мес',   days: 90 },
  ];

  // ── Movements ─────────────────────────────────────────────────────
  movements        = signal<InventoryMovement[]>([]);
  movementsLoading = signal(false);
  movementsFilter  = { productId: null as number | null, reason: '' };

  filteredMovements = computed(() => {
    let list = this.movements();
    if (this.movementsFilter.reason) {
      list = list.filter(m => m.reason === this.movementsFilter.reason);
    }
    return list;
  });

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getProducts().subscribe(p => this.products.set(p));
    this.api.getMenuByCategory().subscribe(d => this.menuByCategory.set(d));
    this.api.getComponents().subscribe(c => this.components.set(c));
    this.applyPreset(this.presets[0]);
  }

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'movements' && !this.movements().length) this.loadMovements();
  }

  // ── Stock color ───────────────────────────────────────────────────
  stockColor(p: Product): string {
    if (p.stock_quantity <= 0) return '#dc2626';
    if (p.is_low) return '#ea580c';
    return 'var(--color-text)';
  }

  // ── Product CRUD ──────────────────────────────────────────────────
  saveProduct() {
    if (!this.newProduct.name) return;
    this.api.createProduct(this.newProduct).subscribe(p => {
      this.products.update(list => [...list, p].sort((a, b) => a.name.localeCompare(b.name)));
      this.showAddProduct.set(false);
      this.newProduct = { name: '', unit: 'мл', pack_size: 1, purchase_price: 0, min_stock: null };
    });
  }

  startEditProduct(p: Product) {
    this.editProductId.set(p.id);
    this.adjustProductId.set(null);
    this.editProduct = {
      name: p.name, unit: p.unit, pack_size: p.pack_size,
      purchase_price: p.purchase_price, stock_quantity: p.stock_quantity,
      min_stock: p.min_stock,
    };
  }

  saveEditProduct(p: Product) {
    this.api.updateProduct(p.id, this.editProduct).subscribe(updated => {
      this.products.update(list => list.map(x => x.id === p.id ? updated : x));
      this.editProductId.set(null);
    });
  }

  deleteProduct(p: Product) {
    if (!confirm(`Удалить «${p.name}»?`)) return;
    this.api.deleteProduct(p.id).subscribe(() => {
      this.products.update(list => list.filter(x => x.id !== p.id));
      this.components.update(list => list.filter(c => c.product !== p.id));
    });
  }

  // ── Adjustment ────────────────────────────────────────────────────
  startAdjust(p: Product) {
    this.adjustProductId.set(this.adjustProductId() === p.id ? null : p.id);
    this.editProductId.set(null);
    this.adjustQty = '';
    this.adjustNote = '';
    this.adjustReason.set('manual_in');
  }

  adjustPreview(p: Product): string {
    const qty = parseFloat(this.adjustQty);
    if (isNaN(qty)) return '';
    const reason = this.adjustReason();
    let newStock: number;
    let delta: number;
    if (reason === 'manual_in') {
      delta = Math.abs(qty);
      newStock = p.stock_quantity + delta;
    } else if (reason === 'manual_out') {
      delta = -Math.abs(qty);
      newStock = p.stock_quantity + delta;
    } else {
      delta = qty - p.stock_quantity;
      newStock = qty;
    }
    const sign = delta >= 0 ? '+' : '';
    return `${p.stock_quantity} ${p.unit} → ${newStock.toFixed(2)} ${p.unit} (${sign}${delta.toFixed(2)})`;
  }

  applyAdjust(p: Product) {
    const qty = parseFloat(this.adjustQty);
    if (isNaN(qty) || qty < 0) return;
    const reason = this.adjustReason();
    let sendQty: number;
    if (reason === 'adjustment') {
      sendQty = qty - p.stock_quantity;
    } else {
      sendQty = qty;
    }
    this.api.adjustStock({ product: p.id, quantity: sendQty, reason, note: this.adjustNote }).subscribe(updated => {
      this.products.update(list => list.map(x => x.id === p.id ? updated : x));
      this.adjustProductId.set(null);
      this.adjustQty = '';
      this.adjustNote = '';
      if (this.movements().length) this.loadMovements();
    });
  }

  // ── Recipe helpers ────────────────────────────────────────────────
  recipeOpen(id: number) { return this.openRecipes().has(id); }

  toggleRecipe(id: number) {
    const s = new Set(this.openRecipes());
    s.has(id) ? s.delete(id) : s.add(id);
    this.openRecipes.set(s);
    this.addingCompFor.set(null);
    this.editCompId.set(null);
  }

  componentsFor(itemId: number): MenuItemComponent[] { return this.componentsMap().get(itemId) ?? []; }
  componentCount(itemId: number): number { return (this.componentsMap().get(itemId) ?? []).length; }

  recipedCount(items: { id: number }[]): number {
    return items.filter(i => this.componentCount(i.id) > 0).length;
  }

  unitForProduct(productId: number): string {
    return this.products().find(p => p.id === productId)?.unit ?? '';
  }

  startAddComp(itemId: number) {
    this.addingCompFor.set(itemId);
    this.newComp = { product: 0, quantity: 0 };
    this.editCompId.set(null);
  }

  saveNewComp(itemId: number) {
    if (!this.newComp.product || !this.newComp.quantity) return;
    this.api.createComponent({ menu_item: itemId, product: this.newComp.product, quantity: this.newComp.quantity })
      .subscribe(comp => {
        this.components.update(list => [...list, comp]);
        this.addingCompFor.set(null);
      });
  }

  startEditComp(comp: MenuItemComponent) {
    this.editCompId.set(comp.id);
    this.editCompQty = comp.quantity;
    this.addingCompFor.set(null);
  }

  saveEditComp(comp: MenuItemComponent) {
    this.api.updateComponent(comp.id, this.editCompQty).subscribe(updated => {
      this.components.update(list => list.map(c => c.id === comp.id ? updated : c));
      this.editCompId.set(null);
    });
  }

  deleteComp(comp: MenuItemComponent) {
    this.api.deleteComponent(comp.id).subscribe(() => {
      this.components.update(list => list.filter(c => c.id !== comp.id));
    });
  }

  catIcon(t: string) { return t === 'bar' ? '🍹' : t === 'kitchen' ? '🍽' : '💨'; }

  // ── Consumption ───────────────────────────────────────────────────
  applyPreset(preset: { label: string; days: number }) {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - preset.days);
    this.dateTo   = to.toISOString().slice(0, 10);
    this.dateFrom = from.toISOString().slice(0, 10);
    this.selectedPreset.set(preset.label);
  }

  loadConsumption() {
    this.consumptionLoading.set(true);
    this.consumptionQueried.set(false);
    this.api.getConsumption(this.dateFrom, this.dateTo).subscribe({
      next: data => {
        this.consumption.set(data);
        this.consumptionLoading.set(false);
        this.consumptionQueried.set(true);
      },
      error: () => this.consumptionLoading.set(false),
    });
  }

  // ── Movements ─────────────────────────────────────────────────────
  loadMovements() {
    this.movementsLoading.set(true);
    this.api.getMovements(this.movementsFilter.productId ?? undefined).subscribe({
      next: data => { this.movements.set(data); this.movementsLoading.set(false); },
      error: () => this.movementsLoading.set(false),
    });
  }

  reasonLabel(r: MovementReason): string { return REASON_LABELS[r] ?? r; }

  reasonStyle(r: MovementReason): string {
    if (r === 'sale')       return 'background:#ede9fe;color:#7c3aed';
    if (r === 'manual_in')  return 'background:#dcfce7;color:#16a34a';
    if (r === 'manual_out') return 'background:#fee2e2;color:#dc2626';
    return 'background:#eff6ff;color:#2563eb';
  }
}