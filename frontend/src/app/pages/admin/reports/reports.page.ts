import {
  Component, OnInit, OnDestroy, signal, ViewChild, ElementRef, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Chart } from 'chart.js/auto';
import { AnalyticsApi } from '../../../entities/analytics';
import { SalesReport } from '../../../core/models';

type ChartMetric = 'revenue' | 'receipts' | 'avgcheck';

const PAY_COLORS = ['#3b82f6', '#6b7280', '#10b981', '#f59e0b', '#ef4444'];
const CAT_COLORS: Record<string, string> = {
  bar: '#f59e0b', kitchen: '#3b82f6', hookah: '#8b5cf6', tickets: '#10b981',
};

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">

      <!-- Header -->
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 class="text-xl font-bold">Основные показатели</h1>
          <p class="text-xs mt-0.5" style="color:var(--color-muted)">Выручка, динамика, структура продаж</p>
        </div>
      </div>

      <!-- Date filter -->
      <div class="card">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="section-title block mb-1">Дата от</label>
            <input type="date" [(ngModel)]="dateFrom" class="field" style="color-scheme:light"/>
          </div>
          <div>
            <label class="section-title block mb-1">Дата до</label>
            <input type="date" [(ngModel)]="dateTo" class="field" style="color-scheme:light"/>
          </div>
          <button (click)="load()" [disabled]="loading()" class="btn btn-primary">
            {{ loading() ? '...' : 'Загрузить' }}
          </button>
          <div class="flex gap-1">
            <button (click)="setPreset(7)"  class="btn btn-ghost btn-sm">7 дней</button>
            <button (click)="setPreset(30)" class="btn btn-ghost btn-sm">30 дней</button>
            <button (click)="setPreset(0)"  class="btn btn-ghost btn-sm">Всё время</button>
          </div>
        </div>
      </div>

      @if (!report() && !loading()) {
        <div class="card text-center py-10" style="color:var(--color-muted)">
          Выберите период и нажмите «Загрузить»
        </div>
      }

      @if (report(); as r) {

        <!-- 4 summary cards -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="card text-center py-3">
            <p class="text-2xl font-bold" style="color:var(--color-gold-hover)">
              {{ r.summary.total_revenue | number:'1.0-0' }} ₽
            </p>
            <p class="section-title mt-0.5">Выручка</p>
          </div>
          <div class="card text-center py-3">
            <p class="text-2xl font-bold">{{ r.summary.receipts_count }}</p>
            <p class="section-title mt-0.5">Чеков</p>
          </div>
          <div class="card text-center py-3">
            <p class="text-2xl font-bold">{{ r.summary.avg_check | number:'1.0-0' }} ₽</p>
            <p class="section-title mt-0.5">Средний чек</p>
          </div>
          <div class="card text-center py-3">
            <p class="text-2xl font-bold"
               [style.color]="r.summary.deleted_count ? '#dc2626' : 'inherit'">
              {{ r.summary.deleted_amount | number:'1.0-0' }} ₽
            </p>
            <p class="section-title mt-0.5">
              Возвраты
              @if (r.summary.deleted_count) {
                <span style="color:#dc2626"> ({{ r.summary.deleted_count }})</span>
              }
            </p>
          </div>
        </div>

        <!-- Sales dynamics chart -->
        <div class="card">
          <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 class="font-semibold">Динамика продаж</h3>
            <div class="flex rounded-md overflow-hidden" style="border:1px solid var(--color-border)">
              @for (m of chartMetrics; track m.id) {
                <button (click)="setMetric(m.id)"
                  class="px-3 py-1 text-xs font-medium transition-colors"
                  [style]="chartMetric() === m.id
                    ? 'background:var(--color-gold);color:#000'
                    : 'background:transparent'">
                  {{ m.label }}
                </button>
              }
            </div>
          </div>
          <div style="position:relative; height:220px">
            <canvas #lineCanvas></canvas>
          </div>
        </div>

        <!-- Two pie charts -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="card">
            <h3 class="font-semibold mb-3">Выручка по типам оплаты</h3>
            <div style="position:relative; height:230px">
              <canvas #payCanvas></canvas>
            </div>
          </div>
          <div class="card">
            <h3 class="font-semibold mb-3">Выручка по категориям</h3>
            <div style="position:relative; height:230px">
              <canvas #catCanvas></canvas>
            </div>
          </div>
        </div>

        <!-- Top items -->
        @if (r.top_items.length) {
          <div class="card">
            <h3 class="font-semibold mb-3">Топ позиций</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr style="border-bottom:1px solid var(--color-border)">
                    <th class="text-left py-2 section-title">#</th>
                    <th class="text-left py-2 section-title">Позиция</th>
                    <th class="text-left py-2 section-title hidden md:table-cell">Раздел</th>
                    <th class="text-right py-2 section-title">Кол-во</th>
                    <th class="text-right py-2 section-title">Выручка</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of r.top_items; track item.id; let i = $index) {
                    <tr style="border-bottom:1px solid var(--color-border)">
                      <td class="py-2" style="color:var(--color-muted)">{{ i + 1 }}</td>
                      <td class="py-2">
                        <span class="font-medium">{{ item.name }}</span>
                        @if (item.volume) {
                          <span class="text-xs ml-1" style="color:var(--color-muted)">{{ item.volume }}</span>
                        }
                      </td>
                      <td class="py-2 hidden md:table-cell">
                        <span class="badge" [class]="typeBadge(item.type)">{{ typeLabel(item.type) }}</span>
                      </td>
                      <td class="py-2 text-right">{{ item.qty }}</td>
                      <td class="py-2 text-right font-bold" style="color:var(--color-gold-hover)">
                        {{ item.revenue | number:'1.0-0' }} ₽
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

      }
    </div>
  `,
})
export class ReportsComponent implements OnInit, OnDestroy {
  private analyticsApi = inject(AnalyticsApi);

  report      = signal<SalesReport | null>(null);
  loading     = signal(false);
  chartMetric = signal<ChartMetric>('revenue');

  dateFrom = '';
  dateTo   = '';

  chartMetrics = [
    { id: 'revenue'  as ChartMetric, label: 'Выручка' },
    { id: 'receipts' as ChartMetric, label: 'Чеков' },
    { id: 'avgcheck' as ChartMetric, label: 'Ср. чек' },
  ];

  @ViewChild('lineCanvas') lineRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('payCanvas')  payRef?:  ElementRef<HTMLCanvasElement>;
  @ViewChild('catCanvas')  catRef?:  ElementRef<HTMLCanvasElement>;

  private lineChart?: Chart;
  private payChart?:  Chart;
  private catChart?:  Chart;

  ngOnInit() { this.setPreset(30); }
  ngOnDestroy() { this.destroyCharts(); }

  setPreset(days: number) {
    const to   = new Date();
    const from = new Date();
    if (days > 0) from.setDate(from.getDate() - days + 1);
    this.dateTo   = to.toISOString().slice(0, 10);
    this.dateFrom = days > 0 ? from.toISOString().slice(0, 10) : '';
    this.load();
  }

  load() {
    this.loading.set(true);
    this.analyticsApi.getSalesReport(this.dateFrom || undefined, this.dateTo || undefined).subscribe({
      next: r => {
        this.report.set(r);
        this.loading.set(false);
        setTimeout(() => this.initCharts(r), 50);
      },
      error: () => this.loading.set(false),
    });
  }

  setMetric(m: ChartMetric) {
    this.chartMetric.set(m);
    const r = this.report();
    if (!r || !this.lineChart) return;
    this.lineChart.data.datasets[0].data  = this.buildLineData(r, m);
    this.lineChart.data.datasets[0].label = this.chartMetrics.find(x => x.id === m)?.label ?? '';
    (this.lineChart.options!.scales!['y'] as any).ticks = {
      callback: (v: any) => this.fmtTick(v, m),
    };
    this.lineChart.update();
  }

  private buildLineData(r: SalesReport, metric: ChartMetric): number[] {
    return [...r.by_shift].reverse().map(s => {
      if (metric === 'revenue')  return s.revenue;
      if (metric === 'receipts') return s.receipts_count;
      return s.receipts_count ? Math.round(s.revenue / s.receipts_count) : 0;
    });
  }

  private fmtTick(v: any, metric: ChartMetric): string {
    const n = Number(v);
    return metric === 'receipts' ? String(n) : n.toLocaleString('ru-RU') + ' ₽';
  }

  private initCharts(r: SalesReport) {
    this.destroyCharts();
    if (!this.lineRef || !this.payRef || !this.catRef) return;

    const shifts = [...r.by_shift].reverse();
    const metric = this.chartMetric();

    this.lineChart = new Chart(this.lineRef.nativeElement, {
      type: 'line',
      data: {
        labels: shifts.map(s => this.formatDate(s.date)),
        datasets: [{
          label: this.chartMetrics.find(m => m.id === metric)?.label ?? '',
          data: this.buildLineData(r, metric),
          borderColor: '#f59e0b',
          backgroundColor: 'rgba(245,158,11,0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: shifts.length === 1 ? 6 : 3,
          pointBackgroundColor: '#f59e0b',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: {
            ticks: { callback: (v: any) => this.fmtTick(v, metric) },
            grid:  { color: 'rgba(0,0,0,0.05)' },
          },
          x: { grid: { display: false } },
        },
      },
    });

    const payData = r.by_payment.filter(p => p.amount > 0);
    this.payChart = new Chart(this.payRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: payData.map(p => p.label),
        datasets: [{
          data: payData.map(p => p.amount),
          backgroundColor: PAY_COLORS.slice(0, payData.length),
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${(ctx.parsed as number).toLocaleString('ru-RU')} ₽` } },
        },
      },
    });

    const catEntries = [
      { label: 'Бар',    value: r.by_category.bar,     color: CAT_COLORS['bar'] },
      { label: 'Кухня',  value: r.by_category.kitchen, color: CAT_COLORS['kitchen'] },
      { label: 'Кальян', value: r.by_category.hookah,  color: CAT_COLORS['hookah'] },
      { label: 'Билеты', value: r.by_category.tickets, color: CAT_COLORS['tickets'] },
    ].filter(e => e.value > 0);

    this.catChart = new Chart(this.catRef.nativeElement, {
      type: 'doughnut',
      data: {
        labels: catEntries.map(e => e.label),
        datasets: [{
          data: catEntries.map(e => e.value),
          backgroundColor: catEntries.map(e => e.color),
          borderWidth: 2,
          borderColor: '#ffffff',
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 11 }, padding: 10, boxWidth: 12 } },
          tooltip: { callbacks: { label: ctx => ` ${(ctx.parsed as number).toLocaleString('ru-RU')} ₽` } },
        },
      },
    });
  }

  private destroyCharts() {
    this.lineChart?.destroy(); this.lineChart = undefined;
    this.payChart?.destroy();  this.payChart  = undefined;
    this.catChart?.destroy();  this.catChart  = undefined;
  }

  typeLabel(t: string) { return t === 'bar' ? 'Бар' : t === 'kitchen' ? 'Кухня' : 'Кальян'; }
  typeBadge(t: string) { return t === 'bar' ? 'badge-amber' : t === 'kitchen' ? 'badge-blue' : 'badge-gray'; }

  formatDate(d: string) {
    return new Date(d + 'T00:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
}