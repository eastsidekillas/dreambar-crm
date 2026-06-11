import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApi } from '../../../entities/inventory';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Product } from '../../../core/models';
import { BdTableComponent, BdTableColumn } from '../../../shared/ui';
import { LucideSearch, LucidePackage, LucideClipboardCheck } from '@lucide/angular';

@Component({
  selector: 'app-stocktake',
  standalone: true,
  imports: [CommonModule, FormsModule, BdTableComponent,
    LucideSearch, LucidePackage, LucideClipboardCheck],
  template: `
<div class="space-y-3">

  <p class="text-sm" style="color:var(--color-muted)">
    Пройди по полкам и внеси фактический остаток. Пустое поле — товар не пересчитывался.
    Система запишет расхождение по каждой позиции.
  </p>

  <!-- Search + apply -->
  <div class="flex items-center gap-2 flex-wrap">
    <div class="relative flex-1" style="max-width:340px">
      <svg lucideSearch [size]="14" class="absolute"
           style="left:10px;top:50%;transform:translateY(-50%);color:var(--color-muted)"></svg>
      <input [ngModel]="search()" (ngModelChange)="search.set($event)"
             class="field" style="padding-left:30px"
             placeholder="Поиск по названию товара..."/>
    </div>
    <span class="text-xs ml-auto" style="color:var(--color-muted)">
      Пересчитано: {{ countedCount() }} / {{ products().length }}
    </span>
    <button (click)="apply()" [disabled]="!countedCount() || saving()"
            class="btn btn-primary btn-sm flex items-center gap-1.5"
            [style.opacity]="countedCount() && !saving() ? '1' : '0.5'">
      <svg lucideClipboardCheck [size]="14"></svg>
      {{ saving() ? 'Сохранение...' : 'Применить инвентаризацию' }}
    </button>
  </div>

  @if (filtered().length) {
    <bd-table [columns]="columns" [rows]="filtered()">
      <ng-template let-p>
        <tr style="border-bottom:1px solid var(--color-border)"
            [style.background]="actual[p.id] !== '' && actual[p.id] != null ? '#fffbeb' : ''">
          <td class="px-4 py-2.5 font-medium">{{ p.name }}</td>
          <td class="px-3 py-2.5 text-right" style="color:var(--color-muted)">
            {{ p.stock_quantity | number:'1.0-2' }} {{ p.unit }}
          </td>
          <td class="px-3 py-2.5 text-right">
            <input [(ngModel)]="actual[p.id]" type="number" min="0" step="any"
                   class="field text-right" style="height:30px;width:110px;display:inline-block"
                   [placeholder]="'факт, ' + p.unit"/>
          </td>
          <td class="px-3 py-2.5 text-right font-semibold"
              [style.color]="diffColor(p)">
            @if (diff(p) !== null) {
              {{ diff(p)! > 0 ? '+' : '' }}{{ diff(p) | number:'1.0-2' }} {{ p.unit }}
            } @else {
              <span style="color:var(--color-muted);font-weight:400">—</span>
            }
          </td>
          <td class="px-3 py-2.5 text-right font-semibold hidden sm:table-cell"
              [style.color]="diffColor(p)">
            @if (diff(p) !== null) {
              {{ diff(p)! > 0 ? '+' : '' }}{{ diff(p)! * unitPrice(p) | number:'1.0-0' }} ₽
            }
          </td>
        </tr>
      </ng-template>

      <tfoot>
        <tr style="background:var(--color-bg);border-top:2px solid var(--color-border)">
          <td class="px-4 py-2.5 font-bold" colspan="3">Итого расхождение</td>
          <td class="px-3 py-2.5 text-right font-bold" [style.color]="totalDiffValue() < 0 ? '#dc2626' : totalDiffValue() > 0 ? '#16a34a' : ''">
          </td>
          <td class="px-3 py-2.5 text-right font-bold text-base"
              [style.color]="totalDiffValue() < 0 ? '#dc2626' : totalDiffValue() > 0 ? '#16a34a' : ''">
            {{ totalDiffValue() > 0 ? '+' : '' }}{{ totalDiffValue() | number:'1.0-0' }} ₽
          </td>
        </tr>
      </tfoot>
    </bd-table>
  } @else {
    <div class="text-center py-10" style="color:var(--color-muted)">
      <svg lucidePackage [size]="48" class="mb-2 mx-auto"></svg>
      {{ products().length ? 'Ничего не найдено' : 'Товары ещё не добавлены' }}
    </div>
  }

</div>
  `,
})
export class StocktakePage implements OnInit {
  products = signal<Product[]>([]);
  search   = signal('');
  saving   = signal(false);

  /** id товара → введённый фактический остаток (строка из input) */
  actual: Record<number, any> = {};

  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.products();
    return term ? list.filter(p => p.name.toLowerCase().includes(term)) : list;
  });

  columns: BdTableColumn[] = [
    { label: 'Название продукта' },
    { label: 'Учётный остаток', align: 'right' },
    { label: 'Факт',            align: 'right' },
    { label: 'Расхождение',     align: 'right' },
    { label: 'Расхождение ₽',   align: 'right', visibleFrom: 'sm' },
  ];

  constructor(private inventoryApi: InventoryApi, private toast: ToastService) {}

  ngOnInit() {
    this.inventoryApi.getProducts().subscribe(p =>
      this.products.set(p.filter(x => x.is_active))
    );
  }

  private parsed(p: Product): number | null {
    const raw = this.actual[p.id];
    if (raw === '' || raw == null) return null;
    const v = parseFloat(raw);
    return isNaN(v) || v < 0 ? null : v;
  }

  diff(p: Product): number | null {
    const v = this.parsed(p);
    return v === null ? null : v - +p.stock_quantity;
  }

  diffColor(p: Product): string {
    const d = this.diff(p);
    if (d === null || d === 0) return 'var(--color-text)';
    return d < 0 ? '#dc2626' : '#16a34a';
  }

  unitPrice(p: Product): number {
    return +p.pack_size > 0 ? +p.purchase_price / +p.pack_size : 0;
  }

  countedCount(): number {
    return this.products().filter(p => this.parsed(p) !== null).length;
  }

  totalDiffValue(): number {
    return this.products().reduce((s, p) => {
      const d = this.diff(p);
      return d === null ? s : s + d * this.unitPrice(p);
    }, 0);
  }

  apply() {
    const items = this.products()
      .map(p => ({ product: p.id, actual_qty: this.parsed(p) }))
      .filter((x): x is { product: number; actual_qty: number } => x.actual_qty !== null);
    if (!items.length || this.saving()) return;
    if (!confirm(`Применить инвентаризацию по ${items.length} позициям? Остатки будут перезаписаны фактом.`)) return;

    this.saving.set(true);
    this.inventoryApi.stocktake(items).subscribe({
      next: updated => {
        const byId = new Map(updated.map(p => [p.id, p]));
        this.products.update(list => list.map(p => byId.get(p.id) ?? p));
        this.actual = {};
        this.saving.set(false);
        this.toast.success(`Инвентаризация применена: ${updated.length} позиций`);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Не удалось применить инвентаризацию');
      },
    });
  }
}