import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApi } from '../../../entities/inventory';
import { StockReport } from '../../../core/models';
import { BdTableComponent, BdTableColumn } from '../../../shared/ui';
import { LucideClock, LucideBarChart2 } from '@lucide/angular';

@Component({
  selector: 'app-stock-report',
  standalone: true,
  imports: [CommonModule, FormsModule, BdTableComponent, LucideClock, LucideBarChart2],
  template: `
<div class="space-y-4">

  <!-- Period -->
  <div class="card">
    <p class="section-title mb-3">Период</p>
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
        <button (click)="load()" class="btn btn-primary" style="height:34px">Показать</button>
      </div>
    </div>
  </div>

  @if (loading()) {
    <div class="text-center py-8 flex items-center justify-center gap-2" style="color:var(--color-muted)">
      <svg lucideClock [size]="16"></svg> Загрузка...
    </div>
  } @else if (report(); as r) {

    <!-- Main numbers -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <div class="card">
        <p class="section-title">Потрачено на закупки</p>
        <p class="text-2xl font-bold mt-1">{{ r.spent | number:'1.0-0' }} ₽</p>
        <p class="text-xs mt-0.5" style="color:var(--color-muted)">приходы товара за период</p>
      </div>
      <div class="card">
        <p class="section-title">Прошло (себестоимость)</p>
        <p class="text-2xl font-bold mt-1">{{ r.cost_of_sales | number:'1.0-0' }} ₽</p>
        <p class="text-xs mt-0.5" style="color:var(--color-muted)">списано по продажам</p>
      </div>
      <div class="card">
        <p class="section-title">Выручка</p>
        <p class="text-2xl font-bold mt-1">{{ r.revenue | number:'1.0-0' }} ₽</p>
        <p class="text-xs mt-0.5" style="color:var(--color-muted)">по чекам за период</p>
      </div>
      <div class="card" style="background:var(--color-gold-light);border-color:var(--color-gold-mid)">
        <p class="section-title">Заработано</p>
        <p class="text-2xl font-bold mt-1" style="color:var(--color-gold-hover)">{{ r.profit | number:'1.0-0' }} ₽</p>
        <p class="text-xs mt-0.5" style="color:var(--color-muted)">выручка − себестоимость</p>
      </div>
    </div>

    <!-- Secondary numbers -->
    <div class="grid grid-cols-2 gap-3">
      <div class="card">
        <p class="section-title">Списано вручную</p>
        <p class="text-xl font-bold mt-1">{{ r.writeoffs | number:'1.0-0' }} ₽</p>
        <p class="text-xs mt-0.5" style="color:var(--color-muted)">бой, порча, угощения</p>
      </div>
      <div class="card">
        <p class="section-title">Расхождение по инвентаризации</p>
        <p class="text-xl font-bold mt-1"
           [style.color]="+r.discrepancy < 0 ? '#dc2626' : +r.discrepancy > 0 ? '#16a34a' : ''">
          {{ +r.discrepancy > 0 ? '+' : '' }}{{ r.discrepancy | number:'1.0-0' }} ₽
        </p>
        <p class="text-xs mt-0.5" style="color:var(--color-muted)">минус — недостача (ушло больше, чем продано)</p>
      </div>
    </div>

    <!-- Discrepancy breakdown -->
    @if (r.discrepancy_rows.length) {
      <div>
        <p class="section-title mb-2">Расхождения по товарам</p>
        <bd-table [columns]="discColumns" [rows]="r.discrepancy_rows" trackField="product_id">
          <ng-template let-row>
            <tr style="border-bottom:1px solid var(--color-border)">
              <td class="px-4 py-2.5 font-medium">{{ row.product_name }}</td>
              <td class="px-3 py-2.5 text-right font-semibold"
                  [style.color]="+row.quantity < 0 ? '#dc2626' : '#16a34a'">
                {{ +row.quantity > 0 ? '+' : '' }}{{ row.quantity | number:'1.0-2' }} {{ row.unit }}
              </td>
              <td class="px-3 py-2.5 text-right font-semibold"
                  [style.color]="+row.value < 0 ? '#dc2626' : '#16a34a'">
                {{ +row.value > 0 ? '+' : '' }}{{ row.value | number:'1.0-0' }} ₽
              </td>
            </tr>
          </ng-template>
        </bd-table>
      </div>
    }

    <p class="text-xs" style="color:var(--color-muted)">
      Суммы считаются по текущим закупочным ценам товаров.
    </p>

  } @else {
    <div class="text-center py-10" style="color:var(--color-muted)">
      <svg lucideBarChart2 [size]="40" class="mb-2 mx-auto"></svg>
      Выбери период и нажми «Показать»
    </div>
  }

</div>
  `,
})
export class StockReportPage implements OnInit {
  dateFrom = '';
  dateTo   = '';
  selectedPreset = signal('');
  report   = signal<StockReport | null>(null);
  loading  = signal(false);

  presets = [
    { label: 'Последний уикенд', days: 7 },
    { label: 'Последний месяц',  days: 30 },
    { label: 'Последние 3 мес',  days: 90 },
  ];

  discColumns: BdTableColumn[] = [
    { label: 'Товар' },
    { label: 'Расхождение',   align: 'right' },
    { label: 'Расхождение ₽', align: 'right' },
  ];

  constructor(private inventoryApi: InventoryApi) {}

  ngOnInit() {
    this.applyPreset(this.presets[0]);
    this.load();
  }

  applyPreset(preset: { label: string; days: number }) {
    const to   = new Date();
    const from = new Date();
    from.setDate(from.getDate() - preset.days);
    this.dateTo   = to.toISOString().slice(0, 10);
    this.dateFrom = from.toISOString().slice(0, 10);
    this.selectedPreset.set(preset.label);
  }

  load() {
    this.loading.set(true);
    this.inventoryApi.getStockReport(this.dateFrom, this.dateTo).subscribe({
      next: r => { this.report.set(r); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}
