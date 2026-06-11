import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApi } from '../../../entities/inventory';
import { MenuApi } from '../../../entities/menu';
import { BdTableComponent, BdTableColumn } from '../../../shared/ui';
import {
  Product, MenuItemComponent, ConsumptionRow, MenuByCategory,
  InventoryMovement, MovementReason,
} from '../../../core/models';
import {
  LucideDynamicIcon,
  LucideFlaskConical, LucideBarChart2, LucideList,
  LucideTriangleAlert, LucidePencil, LucideTrash2, LucideCheck, LucideX,
  LucideGlassWater, LucideUtensilsCrossed, LucideWind, LucideClock,
  LucideClipboardList,
} from '@lucide/angular';

type Tab = 'recipes' | 'consumption' | 'movements';

const REASON_LABELS: Record<MovementReason, string> = {
  sale:       'Продажа',
  manual_in:  'Приход',
  manual_out: 'Списание',
  adjustment: 'Инвентаризация',
};

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDynamicIcon, BdTableComponent,
    LucideBarChart2,
    LucideTriangleAlert, LucidePencil, LucideTrash2, LucideCheck, LucideX,
    LucideClock, LucideClipboardList],
  template: `
<div class="space-y-4">

  <!-- Header -->
  <div class="flex items-center justify-between gap-2 flex-wrap">
    <div>
      <h1 class="text-xl font-bold">Склад</h1>
      @if (lowCount() > 0) {
        <p class="text-xs mt-0.5 flex items-center gap-1" style="color:#dc2626">
          <svg lucideTriangleAlert [size]="12"></svg> {{ lowCount() }} позиц{{ lowCount() === 1 ? 'ия' : 'ии' }} ниже минимума
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
        <svg [lucideIcon]="t.icon" [size]="16"></svg> <span class="hidden sm:inline">{{ t.label }}</span>
      </button>
    }
  </div>

  <!-- ══ TAB: РЕЦЕПТУРЫ ══════════════════════════════════════════ -->
  @if (tab() === 'recipes') {
    @if (!products().length) {
      <div class="card text-center py-8" style="color:var(--color-muted)">
        Сначала добавьте товары на странице «Остатки на складе»
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
              <svg [lucideIcon]="catIcon(cat.station_type)" [size]="16"></svg>
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
                          <button (click)="saveEditComp(comp)" class="btn btn-primary btn-sm" style="height:28px"><svg lucideCheck [size]="12"></svg></button>
                          <button (click)="editCompId.set(null)" class="btn btn-ghost btn-sm" style="height:28px"><svg lucideX [size]="12"></svg></button>
                        } @else {
                          <span class="text-sm font-medium">{{ comp.quantity | number:'1.0-3' }} {{ comp.product_unit }}</span>
                          <button (click)="startEditComp(comp)" class="btn btn-ghost btn-sm" style="height:26px"><svg lucidePencil [size]="12"></svg></button>
                          <button (click)="deleteComp(comp)" class="btn btn-sm"
                                  style="height:26px;background:#fee2e2;color:#dc2626"><svg lucideTrash2 [size]="12"></svg></button>
                        }
                      </div>
                    }
                    @if (addingCompFor() === item.id) {
                      <div class="flex items-center gap-2 mt-2 pt-2" style="border-top:1px solid var(--color-border)">
                        <select [(ngModel)]="newComp.product" (ngModelChange)="onCompProductChange()"
                                class="field text-sm flex-1" style="height:30px">
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
                        <button (click)="saveNewComp(item.id)" class="btn btn-primary btn-sm"><svg lucideCheck [size]="14"></svg></button>
                        <button (click)="addingCompFor.set(null)" class="btn btn-ghost btn-sm"><svg lucideX [size]="14"></svg></button>
                      </div>
                    } @else {
                      <button (click)="startAddComp(item)"
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
          <svg lucideClock [size]="32" class="mb-2 mx-auto"></svg>Расчёт...
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
        <bd-table [columns]="consumptionColumns" [rows]="consumption()" trackField="product_id">
          <ng-template let-row>
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
          </ng-template>

          <tfoot>
            <tr style="background:var(--color-bg);border-top:2px solid var(--color-border)">
              <td class="px-4 py-2.5 font-bold" colspan="6">Итого к закупке</td>
              <td class="px-3 py-2.5 text-right font-bold text-base">{{ totalCost() | number:'1.0-0' }} ₽</td>
            </tr>
          </tfoot>
        </bd-table>
      } @else if (consumptionQueried()) {
        <div class="text-center py-10" style="color:var(--color-muted)">
          <svg lucideBarChart2 [size]="40" class="mb-2 mx-auto"></svg>
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
        <div class="text-center py-8 flex items-center justify-center gap-2" style="color:var(--color-muted)"><svg lucideClock [size]="16"></svg> Загрузка...</div>
      } @else if (filteredMovements().length) {
        <bd-table [columns]="movementsColumns" [rows]="filteredMovements()">
          <ng-template let-m>
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
          </ng-template>
        </bd-table>
      } @else {
        <div class="text-center py-10" style="color:var(--color-muted)">
          <svg lucideClipboardList [size]="40" class="mb-2 mx-auto"></svg>
          Движений не найдено
        </div>
      }

    </div>
  }

</div>
  `,
})
export class InventoryPage implements OnInit {
  tab = signal<Tab>('recipes');

  tabs: { key: Tab; icon: LucideIconInput; label: string }[] = [
    { key: 'recipes'     as Tab, icon: LucideFlaskConical,     label: 'Рецептуры' },
    { key: 'consumption' as Tab, icon: LucideBarChart2,  label: 'Расход'    },
    { key: 'movements'   as Tab, icon: LucideList,       label: 'Движения'  },
  ];

  // ── Products (для рецептур и фильтра движений) ────────────────────
  products       = signal<Product[]>([]);
  activeProducts = computed(() => this.products().filter(p => p.is_active));
  lowCount       = computed(() => this.products().filter(p => p.is_low).length);

  // ── Table columns ─────────────────────────────────────────────────
  consumptionColumns: BdTableColumn[] = [
    { label: 'Товар' },
    { label: 'Остаток', align: 'right' },
    { label: 'Расход',  align: 'right' },
    { label: 'Упак.',   align: 'right', visibleFrom: 'sm' },
    { label: 'Купить',  align: 'right' },
    { label: '₽ / уп',  align: 'right', visibleFrom: 'sm' },
    { label: 'Итого ₽', align: 'right' },
  ];

  movementsColumns: BdTableColumn[] = [
    { label: 'Дата и время' },
    { label: 'Товар' },
    { label: 'Количество', align: 'right' },
    { label: 'Тип',         visibleFrom: 'sm' },
    { label: 'Кто',         visibleFrom: 'md' },
    { label: 'Комментарий', visibleFrom: 'md' },
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
  totalCost          = computed(() => this.consumption().reduce((s, r) => s + +r.total_cost, 0));

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

  constructor(private inventoryApi: InventoryApi, private menuApi: MenuApi) {}

  ngOnInit() {
    this.inventoryApi.getProducts().subscribe(p => this.products.set(p));
    this.menuApi.getMenuByCategory().subscribe(d => this.menuByCategory.set(d));
    this.inventoryApi.getComponents().subscribe(c => this.components.set(c));
    this.applyPreset(this.presets[0]);
  }

  setTab(t: Tab) {
    this.tab.set(t);
    if (t === 'movements' && !this.movements().length) this.loadMovements();
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
    return this.products().find(p => p.id === +productId)?.unit ?? '';
  }

  /** Число и единица из подписи позиции: «50 мл» → {50, мл}, «0,5 л» → {0.5, л} */
  private volumeHint: { value: number; unit: string } | null = null;

  private parseVolume(volume?: string): { value: number; unit: string } | null {
    const m = (volume ?? '').match(/(\d+(?:[.,]\d+)?)\s*(мл|л|кг|г|шт)?/iu);
    if (!m) return null;
    const value = parseFloat(m[1].replace(',', '.'));
    return value > 0 ? { value, unit: (m[2] ?? '').toLowerCase() } : null;
  }

  startAddComp(item: { id: number; volume?: string }) {
    this.addingCompFor.set(item.id);
    this.volumeHint = this.parseVolume(item.volume);
    this.newComp = { product: 0, quantity: this.volumeHint?.value ?? 0 };
    this.editCompId.set(null);
  }

  /** При выборе товара пересчитываем подсказку под его единицу (0.5 л → 500 мл) */
  onCompProductChange() {
    const hint = this.volumeHint;
    if (!hint) return;
    const unit = this.unitForProduct(this.newComp.product);
    let qty = hint.value;
    if (hint.unit === 'л'  && unit === 'мл') qty = hint.value * 1000;
    if (hint.unit === 'мл' && unit === 'л')  qty = hint.value / 1000;
    if (hint.unit === 'кг' && unit === 'г')  qty = hint.value * 1000;
    if (hint.unit === 'г'  && unit === 'кг') qty = hint.value / 1000;
    this.newComp.quantity = qty;
  }

  saveNewComp(itemId: number) {
    if (!this.newComp.product || !this.newComp.quantity) return;
    this.inventoryApi.createComponent({ menu_item: itemId, product: this.newComp.product, quantity: this.newComp.quantity })
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
    this.inventoryApi.updateComponent(comp.id, this.editCompQty).subscribe(updated => {
      this.components.update(list => list.map(c => c.id === comp.id ? updated : c));
      this.editCompId.set(null);
    });
  }

  deleteComp(comp: MenuItemComponent) {
    this.inventoryApi.deleteComponent(comp.id).subscribe(() => {
      this.components.update(list => list.filter(c => c.id !== comp.id));
    });
  }

  catIcon(t: string): LucideIconInput { return t === 'bar' ? LucideGlassWater : t === 'kitchen' ? LucideUtensilsCrossed : LucideWind; }

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
    this.inventoryApi.getConsumption(this.dateFrom, this.dateTo).subscribe({
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
    this.inventoryApi.getMovements(this.movementsFilter.productId ?? undefined).subscribe({
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