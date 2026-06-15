import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { InventoryApi } from '../../../entities/inventory';
import { MenuApi } from '../../../entities/menu';
import { Product, InventoryMovement, MovementReason, MenuItem, PRODUCT_UNITS } from '../../../core/models';
import { BdTableComponent, BdTableColumn, BdDrawerComponent } from '../../../shared/ui';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import {
  LucideSearch, LucidePackage, LucidePlus, LucideMinus, LucideClock, LucidePencil,
} from '@lucide/angular';

const REASON_LABELS: Record<MovementReason, string> = {
  sale:       'Продажа',
  manual_in:  'Приход',
  manual_out: 'Списание',
  adjustment: 'Инвентаризация',
};

@Component({
  selector: 'app-stock',
  standalone: true,
  imports: [CommonModule, FormsModule, BdTableComponent, BdDrawerComponent,
    LucideSearch, LucidePackage, LucidePlus, LucideMinus, LucideClock, LucidePencil],
  template: `
<div class="space-y-3">

  <!-- Search + create -->
  <div class="flex items-center gap-2">
    <div class="relative flex-1" style="max-width:340px">
      <svg lucideSearch [size]="14" class="absolute"
           style="left:10px;top:50%;transform:translateY(-50%);color:var(--color-muted)"></svg>
      <input [ngModel]="search()" (ngModelChange)="search.set($event)"
             class="field" style="padding-left:30px"
             placeholder="Поиск по названию товара..."/>
    </div>
    <div class="flex gap-2 ml-auto">
      <button (click)="openFromMenu()" class="btn btn-ghost btn-sm"
              style="border:1px solid var(--color-border)">Из меню</button>
      <button (click)="openCreate()" class="btn btn-primary btn-sm">+ Товар</button>
    </div>
  </div>

  @if (filtered().length) {
    <bd-table [columns]="columns" [rows]="filtered()">
      <ng-template let-p>

        <!-- Product row -->
        <tr style="border-bottom:1px solid var(--color-border);cursor:pointer"
            [style.background]="movementsFor() === p.id ? 'var(--color-gold-light)' : ''"
            [style.opacity]="p.is_active ? '1' : '0.45'"
            (click)="toggleMovements(p)">
          <td class="px-4 py-2.5 font-medium">{{ p.name }}</td>
          <td class="px-3 py-2.5 text-right">
            @if (recommendPacks(p) > 0) {
              <span class="font-bold" style="color:#ea580c">{{ recommendPacks(p) }} уп.</span>
              <p class="text-xs" style="color:var(--color-muted)">
                ≈ {{ recommendPacks(p) * p.pack_size | number:'1.0-0' }} {{ p.unit }}
              </p>
            } @else {
              <span style="color:var(--color-muted)">—</span>
            }
          </td>
          <td class="px-3 py-2.5 text-right">
            <span class="font-bold text-base" [style.color]="stockColor(p)">
              {{ p.stock_quantity | number:'1.0-2' }}
            </span>
            <span class="text-xs ml-0.5" style="color:var(--color-muted)">{{ p.unit }}</span>
          </td>
          <td class="px-3 py-2.5 text-right hidden sm:table-cell" style="color:var(--color-muted)">
            {{ unitPrice(p) | number:'1.0-2' }} ₽/{{ p.unit }}
          </td>
          <td class="px-3 py-2.5 text-right font-semibold hidden sm:table-cell">
            {{ stockValue(p) | number:'1.0-0' }} ₽
          </td>
          <td class="px-3 py-2.5">
            <div class="flex gap-1 justify-end" (click)="$event.stopPropagation()">
              <button (click)="startAdjust(p, 'manual_in')" title="Приход"
                      class="btn btn-sm" style="background:#dcfce7;color:#16a34a">
                <svg lucidePlus [size]="14"></svg>
              </button>
              <button (click)="startAdjust(p, 'manual_out')" title="Списание"
                      class="btn btn-sm" style="background:#fee2e2;color:#dc2626">
                <svg lucideMinus [size]="14"></svg>
              </button>
              <button (click)="openEdit(p)" title="Редактировать" class="btn btn-ghost btn-sm">
                <svg lucidePencil [size]="14"></svg>
              </button>
            </div>
          </td>
        </tr>

        <!-- Movements block -->
        @if (movementsFor() === p.id) {
          <tr style="border-bottom:2px solid var(--color-gold)">
            <td colspan="6" class="px-4 py-3" style="background:var(--color-bg)">
              <p class="font-semibold text-sm mb-2">Движение товара «{{ p.name }}»</p>
              @if (movementsLoading()) {
                <p class="text-sm flex items-center gap-2" style="color:var(--color-muted)">
                  <svg lucideClock [size]="14"></svg> Загрузка...
                </p>
              } @else if (movements().length) {
                @for (m of movements(); track m.id) {
                  <div class="flex items-center gap-3 py-1.5 text-sm"
                       style="border-bottom:1px solid var(--color-border)">
                    <span class="whitespace-nowrap text-xs" style="color:var(--color-muted)">
                      {{ m.created_at | date:'dd.MM.yy HH:mm' }}
                    </span>
                    <span class="text-xs px-2 py-0.5 rounded-full" [style]="reasonStyle(m.reason)">
                      {{ reasonLabel(m.reason) }}
                    </span>
                    <span class="font-bold whitespace-nowrap"
                          [style.color]="m.quantity >= 0 ? '#16a34a' : '#dc2626'">
                      {{ m.quantity >= 0 ? '+' : '' }}{{ m.quantity | number:'1.0-3' }}
                      <span class="font-normal text-xs" style="color:var(--color-muted)">{{ m.product_unit }}</span>
                    </span>
                    <span class="text-xs ml-auto" style="color:var(--color-muted)">
                      {{ m.created_by_name ?? '' }} {{ m.note ? '· ' + m.note : '' }}
                    </span>
                  </div>
                }
              } @else {
                <p class="text-sm" style="color:var(--color-muted)">Движений по товару нет</p>
              }
            </td>
          </tr>
        }

      </ng-template>
    </bd-table>
  } @else {
    <div class="text-center py-10" style="color:var(--color-muted)">
      <svg lucidePackage [size]="48" class="mb-2 mx-auto"></svg>
      {{ products().length ? 'Ничего не найдено' : 'Товары ещё не добавлены' }}
    </div>
  }

  <!-- ── Drawer: приход / списание ──────────────────────────────── -->
  @if (adjustProduct(); as p) {
    <bd-drawer [title]="(adjustMode() === 'manual_in' ? 'Приход — ' : 'Списание — ') + p.name"
               (closed)="adjustProduct.set(null)">
      <div class="space-y-3">
        <p class="text-sm" [style.color]="adjustMode() === 'manual_in' ? '#16a34a' : '#dc2626'">
          {{ adjustMode() === 'manual_in' ? '+ Приход товара на склад' : '− Списание товара со склада' }}
        </p>
        <div>
          <label class="section-title block mb-1">Количество ({{ p.unit }})</label>
          <input [(ngModel)]="adjustQty" type="number" min="0" step="any" class="field" placeholder="0"/>
        </div>
        <div>
          <label class="section-title block mb-1">Комментарий (необязательно)</label>
          <input [(ngModel)]="adjustNote" class="field" placeholder="Поступление от поставщика..."/>
        </div>
        <p class="text-xs" style="color:var(--color-muted)">
          Текущий остаток: {{ p.stock_quantity | number:'1.0-2' }} {{ p.unit }}
        </p>
        <div class="flex gap-2 pt-1">
          <button (click)="applyAdjust(p)" class="btn btn-primary btn-sm">Применить</button>
          <button (click)="adjustProduct.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
        </div>
      </div>
    </bd-drawer>
  }

  <!-- ── Drawer: добавление товаров из меню ─────────────────────── -->
  @if (fromMenuOpen()) {
    <bd-drawer title="Добавить из меню" (closed)="fromMenuOpen.set(false)">
      <div class="space-y-3">
        <p class="text-xs" style="color:var(--color-muted)">
          Для готовых позиций (бутылки, снеки): создаётся товар на складе в штуках
          и рецептура «1 шт» — продажи будут списываться автоматически.
          Показаны только позиции без рецептуры.
        </p>
        <input [ngModel]="menuSearch()" (ngModelChange)="menuSearch.set($event)"
               class="field" placeholder="Поиск по меню..."/>
        @if (fromMenuLoading()) {
          <p class="text-sm" style="color:var(--color-muted)">Загрузка...</p>
        } @else if (filteredMenuGroups().length) {
          @for (g of filteredMenuGroups(); track g.name) {
            <div>
              <p class="section-title mb-1">{{ g.name }}</p>
              @for (mi of g.items; track mi.id) {
                <label class="flex items-center gap-2 py-1 text-sm" style="cursor:pointer">
                  <input type="checkbox" [checked]="selectedMenuIds().has(mi.id)"
                         (change)="toggleMenuItem(mi.id)"/>
                  <span>{{ mi.name }}</span>
                  @if (mi.volume) {
                    <span class="text-xs" style="color:var(--color-muted)">{{ mi.volume }}</span>
                  }
                </label>
              }
            </div>
          }
        } @else {
          <p class="text-sm" style="color:var(--color-muted)">
            {{ menuSearch() ? 'Ничего не найдено' : 'У всех позиций меню рецептуры уже заполнены' }}
          </p>
        }
        <div class="flex gap-2 pt-1">
          <button (click)="addFromMenu()" class="btn btn-primary btn-sm"
                  [disabled]="!selectedMenuIds().size || fromMenuSaving()">
            {{ fromMenuSaving() ? 'Добавление...' : 'Добавить (' + selectedMenuIds().size + ')' }}
          </button>
          <button (click)="fromMenuOpen.set(false)" class="btn btn-ghost btn-sm">Отмена</button>
        </div>
      </div>
    </bd-drawer>
  }

  <!-- ── Drawer: создание / редактирование товара ───────────────── -->
  @if (formOpen()) {
    <bd-drawer [title]="formOpen() === 'create' ? 'Новый товар' : 'Редактировать товар'"
               (closed)="formOpen.set(null)">
      <div class="space-y-3">
        <div>
          <label class="section-title block mb-1">Название</label>
          <input [(ngModel)]="form.name" class="field" placeholder="Водка TUNDRA"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="section-title block mb-1">Единица</label>
            <select [(ngModel)]="form.unit" class="field">
              @for (u of units; track u) { <option [value]="u">{{ u }}</option> }
            </select>
          </div>
          <div>
            <label class="section-title block mb-1">Объём упаковки</label>
            <input [(ngModel)]="form.pack_size" type="number" min="0.001" step="any" class="field" placeholder="500"/>
          </div>
          <div>
            <label class="section-title block mb-1">Цена упаковки ₽</label>
            <input [(ngModel)]="form.purchase_price" type="number" min="0" step="any" class="field" placeholder="800"/>
          </div>
          <div>
            <label class="section-title block mb-1">Минимальный остаток</label>
            <input [(ngModel)]="form.min_stock" type="number" min="0" step="any" class="field" placeholder="необязательно"/>
          </div>
          @if (formOpen() === 'edit') {
            <div>
              <label class="section-title block mb-1">Остаток</label>
              <input [(ngModel)]="form.stock_quantity" type="number" step="any" class="field"/>
            </div>
          }
        </div>
        <div class="flex gap-2 pt-1">
          <button (click)="saveForm()" class="btn btn-primary btn-sm">Сохранить</button>
          <button (click)="formOpen.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
        </div>
      </div>
    </bd-drawer>
  }

</div>
  `,
})
export class StockPage implements OnInit {
  products = signal<Product[]>([]);
  search   = signal('');

  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.products();
    return term ? list.filter(p => p.name.toLowerCase().includes(term)) : list;
  });

  columns: BdTableColumn[] = [
    { label: 'Название продукта' },
    { label: 'Реком. заказать', align: 'right' },
    { label: 'Остаток',         align: 'right' },
    { label: 'Цена за единицу', align: 'right', visibleFrom: 'sm' },
    { label: 'Стоимость',       align: 'right', visibleFrom: 'sm' },
    { label: '' },
  ];

  units = PRODUCT_UNITS;

  // ── Приход / списание (drawer) ────────────────────────────────────
  adjustProduct = signal<Product | null>(null);
  adjustMode    = signal<MovementReason>('manual_in');
  adjustQty: any = '';
  adjustNote = '';

  // ── Создание / редактирование товара (drawer) ────────────────────
  formOpen = signal<'create' | 'edit' | null>(null);
  form: Partial<Product> = {};
  private editTarget: Product | null = null;

  // ── Движения товара ───────────────────────────────────────────────
  movementsFor     = signal<number | null>(null);
  movements        = signal<InventoryMovement[]>([]);
  movementsLoading = signal(false);

  // ── Добавление из меню (drawer) ───────────────────────────────────
  fromMenuOpen    = signal(false);
  fromMenuLoading = signal(false);
  fromMenuSaving  = signal(false);
  menuSearch      = signal('');
  unlinkedMenuItems = signal<MenuItem[]>([]);
  selectedMenuIds   = signal<Set<number>>(new Set());

  filteredMenuGroups = computed(() => {
    const term = this.menuSearch().trim().toLowerCase();
    const items = this.unlinkedMenuItems()
      .filter(mi => !term || mi.name.toLowerCase().includes(term));
    const groups = new Map<string, MenuItem[]>();
    for (const mi of items) {
      const key = mi.category_name || 'Без категории';
      (groups.get(key) ?? groups.set(key, []).get(key)!).push(mi);
    }
    return [...groups.entries()].map(([name, list]) => ({ name, items: list }));
  });

  constructor(private inventoryApi: InventoryApi, private menuApi: MenuApi,
              private toast: ToastService) {}

  ngOnInit() {
    this.inventoryApi.getProducts().subscribe(p => this.products.set(p));
  }

  stockColor(p: Product): string {
    if (p.stock_quantity <= 0) return '#dc2626';
    if (p.is_low) return '#ea580c';
    return 'var(--color-text)';
  }

  /** Цена за единицу (₽ за мл / г / шт) */
  unitPrice(p: Product): number {
    return +p.pack_size > 0 ? +p.purchase_price / +p.pack_size : 0;
  }

  /** Стоимость остатка по закупочной цене */
  stockValue(p: Product): number {
    return this.unitPrice(p) * +p.stock_quantity;
  }

  /** Сколько упаковок докупить до минимального остатка */
  recommendPacks(p: Product): number {
    if (p.min_stock == null || +p.pack_size <= 0) return 0;
    const need = +p.min_stock - +p.stock_quantity;
    return need > 0 ? Math.ceil(need / +p.pack_size) : 0;
  }

  startAdjust(p: Product, mode: MovementReason) {
    this.adjustProduct.set(p);
    this.adjustMode.set(mode);
    this.adjustQty = '';
    this.adjustNote = '';
  }

  applyAdjust(p: Product) {
    const qty = parseFloat(this.adjustQty);
    if (isNaN(qty) || qty <= 0) return;
    this.inventoryApi.adjustStock({
      product: p.id, quantity: qty, reason: this.adjustMode(), note: this.adjustNote,
    }).subscribe(updated => {
      this.products.update(list => list.map(x => x.id === p.id ? updated : x));
      this.adjustProduct.set(null);
      if (this.movementsFor() === p.id) this.loadMovements(p.id);
    });
  }

  openCreate() {
    this.form = { name: '', unit: 'мл', pack_size: 1, purchase_price: 0, min_stock: null };
    this.editTarget = null;
    this.formOpen.set('create');
  }

  openEdit(p: Product) {
    this.form = {
      name: p.name, unit: p.unit, pack_size: p.pack_size,
      purchase_price: p.purchase_price, min_stock: p.min_stock,
      stock_quantity: p.stock_quantity,
    };
    this.editTarget = p;
    this.formOpen.set('edit');
  }

  saveForm() {
    if (!this.form.name) return;
    if (this.formOpen() === 'create') {
      this.inventoryApi.createProduct(this.form).subscribe(p => {
        this.products.update(list => [...list, p].sort((a, b) => a.name.localeCompare(b.name)));
        this.formOpen.set(null);
      });
    } else if (this.editTarget) {
      const id = this.editTarget.id;
      this.inventoryApi.updateProduct(id, this.form).subscribe(updated => {
        this.products.update(list => list.map(x => x.id === id ? updated : x));
        this.formOpen.set(null);
      });
    }
  }

  openFromMenu() {
    this.fromMenuOpen.set(true);
    this.fromMenuLoading.set(true);
    this.menuSearch.set('');
    this.selectedMenuIds.set(new Set());
    forkJoin([this.menuApi.getMenuItems(), this.inventoryApi.getComponents()]).subscribe({
      next: ([items, components]) => {
        const linked = new Set(components.map(c => c.menu_item));
        this.unlinkedMenuItems.set(items.filter(mi => mi.is_active && !linked.has(mi.id)));
        this.fromMenuLoading.set(false);
      },
      error: () => this.fromMenuLoading.set(false),
    });
  }

  toggleMenuItem(id: number) {
    this.selectedMenuIds.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  addFromMenu() {
    const ids = [...this.selectedMenuIds()];
    if (!ids.length) return;
    this.fromMenuSaving.set(true);
    this.inventoryApi.createProductsFromMenu(ids).subscribe({
      next: created => {
        this.products.update(list =>
          [...list, ...created].sort((a, b) => a.name.localeCompare(b.name)));
        this.fromMenuSaving.set(false);
        this.fromMenuOpen.set(false);
      },
      error: e => {
        this.toast.apiError(e, 'Не удалось создать товары из меню');
        this.fromMenuSaving.set(false);
      },
    });
  }

  toggleMovements(p: Product) {
    if (this.movementsFor() === p.id) {
      this.movementsFor.set(null);
      return;
    }
    this.movementsFor.set(p.id);
    this.loadMovements(p.id);
  }

  private loadMovements(productId: number) {
    this.movementsLoading.set(true);
    this.inventoryApi.getMovements(productId).subscribe({
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