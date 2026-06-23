import { Component, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { formatMoney as money } from '../../../shared/lib/formatters';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AnalyticsApi } from '../../../entities/analytics';
import { DashboardData, ShiftAnalytics, TopItem, Shift } from '../../../core/models';
import { Chart, registerables, ChartConfiguration } from 'chart.js';
import { LucideClock, LucideDownload } from '@lucide/angular';
import { SystemControlWidget } from '../../../widgets/system-control/system-control.widget';

Chart.register(...registerables);

const CAT_COLORS = {
  tickets: '#B8922A',
  bar:     '#7C3AED',
  kitchen: '#0D9488',
  hookah:  '#EA580C',
};


// Plugin: draw total in the middle of the doughnut
const donutCenter = {
  id: 'donutCenter',
  afterDraw(chart: any) {
    const total = chart.data.datasets[0].data.reduce((a: number, b: number) => a + (b || 0), 0);
    if (!total) return;
    const { ctx, chartArea: { left, right, top, bottom } } = chart;
    const cx = (left + right) / 2;
    const cy = (top + bottom) / 2;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#78716C';
    ctx.font = '600 11px Inter, sans-serif';
    ctx.fillText('Всего', cx, cy - 12);
    ctx.fillStyle = '#1C1917';
    ctx.font = '700 18px Inter, sans-serif';
    ctx.fillText(money(total), cx, cy + 8);
    ctx.restore();
  }
};

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, LucideClock, LucideDownload, SystemControlWidget],
  styles: [`
    .kpi-card {
      display: block; text-decoration: none; color: inherit;
      transition: transform .15s, box-shadow .15s, border-color .15s;
    }
    .kpi-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(0,0,0,.08);
      border-color: var(--color-gold);
    }
    .kpi-hint {
      display: flex; align-items: center; gap: 4px;
      margin-top: 8px; font-size: 0.72rem; font-weight: 600;
      color: var(--color-light); transition: color .15s;
    }
    .kpi-card:hover .kpi-hint { color: var(--color-gold-hover); }
    .card-link {
      font-size: 0.78rem; font-weight: 600; white-space: nowrap;
      color: var(--color-gold-hover); text-decoration: none;
      padding: 4px 8px; border-radius: 8px; transition: background .15s;
    }
    .card-link:hover { background: var(--color-gold-light); }
  `],
  template: `
    <div class="space-y-5">

      <app-system-control />

      <div class="flex items-center justify-between gap-3 flex-wrap">
        <h1 class="text-xl font-bold">Аналитика</h1>
        <div class="flex items-center gap-2">
          <a routerLink="/admin/reports" class="btn btn-ghost btn-sm"
             title="Детальные отчёты: категории, позиции, оплаты">Отчёты</a>
          <a routerLink="/admin/export" class="btn btn-outline btn-sm flex items-center gap-1.5"
             title="Скачать сводный отчёт или отчёт по смене в .xlsx">
            <svg lucideDownload [size]="14"></svg> Экспорт в Excel
          </a>
        </div>
      </div>

      @if (data()) {
        <!-- KPI row: каждая карточка ведёт на детальную страницу -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          @for (kpi of kpis(); track kpi.label) {
            <a class="card kpi-card" [routerLink]="kpi.link" [title]="kpi.hint">
              <p class="section-title mb-1">{{ kpi.label }}</p>
              <p class="text-2xl font-bold" style="color:var(--color-text)">{{ kpi.value }}</p>
              @if (kpi.sub) {
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ kpi.sub }}</p>
              }
              <p class="kpi-hint">{{ kpi.hint }} <span>→</span></p>
            </a>
          }
        </div>

        <!-- Current shift detail breakdown (only when open) -->
        @if (data()!.current_shift) {
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
            @for (c of currentShiftCats(); track c.label) {
              @if (c.label !== 'Итого') {
                <div class="card text-center p-3" [style.background]="c.bg">
                  <p class="font-bold text-lg leading-none" [style.color]="c.color">{{ c.value | number:'1.0-0' }} ₽</p>
                  <p class="text-xs mt-1 section-title">{{ c.label }}</p>
                </div>
              }
            }
          </div>
        }

        <!-- Charts row -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Donut -->
          <div class="card">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-semibold text-sm mb-1">Выручка по категориям</h3>
              <a routerLink="/admin/reports" class="card-link"
                 title="Отчёт по продажам с разбивкой по категориям">Подробнее →</a>
            </div>
            <p class="text-xs mb-3" style="color:var(--color-muted)">за последние 30 дней</p>
            @if (hasCategoryData()) {
              <div style="position:relative;height:260px">
                <canvas #donut></canvas>
              </div>
            } @else {
              <div class="flex flex-col items-center justify-center" style="height:260px">
                <span class="text-3xl mb-2">📭</span>
                <p class="text-sm" style="color:var(--color-muted)">Нет продаж за период</p>
              </div>
            }
          </div>

          <!-- Top items -->
          <div class="card">
            <div class="flex items-start justify-between gap-2">
              <h3 class="font-semibold text-sm mb-1">Топ позиций</h3>
              <a routerLink="/admin/reports" class="card-link"
                 title="Полный отчёт по всем позициям меню">Все позиции →</a>
            </div>
            <p class="text-xs mb-3" style="color:var(--color-muted)">по выручке</p>
            @for (item of topItems().slice(0,8); track item.menu_item__id) {
              <div class="py-1.5" style="border-bottom:1px solid var(--color-border)">
                <div class="flex items-center gap-2 mb-1">
                  <span class="flex-1 text-sm truncate">{{ item.menu_item__name }}</span>
                  <span class="text-xs badge badge-gold">{{ item.total_qty }} шт</span>
                  <span class="text-sm font-bold w-20 text-right" style="color:var(--color-gold-hover)">
                    {{ item.total_revenue | number:'1.0-0' }} ₽
                  </span>
                </div>
                <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--color-bg)">
                  <div class="h-full rounded-full" style="background:var(--color-gold)"
                       [style.width.%]="barWidth(item)"></div>
                </div>
              </div>
            }
            @if (!topItems().length) {
              <p class="text-sm text-center py-8" style="color:var(--color-muted)">Нет данных</p>
            }
          </div>
        </div>

        <!-- Shifts bar chart -->
        <div class="card">
          <div class="flex items-start justify-between gap-2">
            <h3 class="font-semibold text-sm mb-1">Выручка по сменам</h3>
            <a routerLink="/admin/shifts/day" class="card-link"
               title="Итоги по каждому дню с детализацией">Итоги дня →</a>
          </div>
          <p class="text-xs mb-3" style="color:var(--color-muted)">последние {{ shiftAnalytics().length }} смен · с разбивкой по категориям</p>
          @if (shiftAnalytics().length) {
            <div style="position:relative;height:300px">
              <canvas #shiftsChart></canvas>
            </div>
          } @else {
            <div class="flex flex-col items-center justify-center" style="height:200px">
              <span class="text-3xl mb-2">📭</span>
              <p class="text-sm" style="color:var(--color-muted)">Нет завершённых смен</p>
            </div>
          }
        </div>

      } @else {
        <div class="card text-center py-16">
          <svg lucideClock [size]="40" class="mx-auto mb-3" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Загрузка данных...</p>
        </div>
      }
    </div>
  `
})
export class DashboardComponent implements OnInit, OnDestroy {
  @ViewChild('donut') donutRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('shiftsChart') shiftsRef?: ElementRef<HTMLCanvasElement>;

  data           = signal<DashboardData | null>(null);
  topItems       = signal<TopItem[]>([]);
  shiftAnalytics = signal<ShiftAnalytics[]>([]);

  hasCategoryData = computed(() => {
    const c = this.data()?.by_category;
    return !!c && (c.tickets + c.bar + c.kitchen + c.hookah) > 0;
  });

  private donutChart?: Chart;
  private barChart?: Chart;
  private maxTop = 1;
  private redraw = () => { this.drawDonut(); this.drawBar(); };

  constructor(private analyticsApi: AnalyticsApi, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.analyticsApi.getDashboard().subscribe(d => {
      this.data.set(d);
      this.cdr.detectChanges();
      queueMicrotask(() => this.drawDonut());
    });
    this.analyticsApi.getTopItems().subscribe(i => {
      this.maxTop = Math.max(1, ...i.map(x => x.total_revenue));
      this.topItems.set(i);
    });
    this.analyticsApi.getShiftAnalytics(15).subscribe(s => {
      // keep only shifts that actually have revenue, oldest→newest
      this.shiftAnalytics.set(s.filter(x => x.total > 0).reverse());
      this.cdr.detectChanges();
      queueMicrotask(() => this.drawBar());
    });
    window.addEventListener('resize', this.redraw);
  }

  ngOnDestroy() {
    window.removeEventListener('resize', this.redraw);
    this.donutChart?.destroy();
    this.barChart?.destroy();
  }

  kpis() {
    const d = this.data();
    if (!d) return [];
    const avg = d.shifts_count ? Math.round(d.total_revenue / d.shifts_count) : 0;
    return [
      { label: 'Выручка за 30 дней', value: money(d.total_revenue), sub: undefined,
        link: '/admin/reports',         hint: 'Отчёт по продажам' },
      { label: 'Средняя за смену',   value: money(avg),             sub: undefined,
        link: '/admin/shifts/day',      hint: 'Итоги по дням' },
      { label: 'Заказов принято',    value: d.total_orders,         sub: 'гостей: ' + d.total_guests,
        link: '/admin/shifts/receipts', hint: 'Детали по чекам' },
      { label: 'Смен проведено',     value: d.shifts_count,         sub: undefined,
        link: '/admin/shifts/day',      hint: 'Итоги по дням' },
    ];
  }

  currentShiftCats() {
    const s = this.data()?.current_shift;
    if (!s) return [];
    const total = s.tickets + s.bar + s.kitchen + s.hookah;
    return [
      { label: 'Билеты', value: s.tickets, color: CAT_COLORS.tickets, bg: '#FBF6E9' },
      { label: 'Бар',    value: s.bar,     color: CAT_COLORS.bar,     bg: '#F3EEFE' },
      { label: 'Кухня',  value: s.kitchen, color: CAT_COLORS.kitchen, bg: '#E6FBF7' },
      { label: 'Кальян', value: s.hookah,  color: CAT_COLORS.hookah,  bg: '#FFF1E8' },
      { label: 'Итого',  value: total,     color: 'var(--color-text)', bg: 'rgba(0,0,0,0.04)' },
    ];
  }

  barWidth(item: TopItem): number {
    return Math.round((item.total_revenue / this.maxTop) * 100);
  }

  private drawDonut() {
    const d = this.data();
    if (!d || !this.donutRef || !this.hasCategoryData()) return;
    this.donutChart?.destroy();

    const cfg: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels: ['Билеты', 'Бар', 'Кухня', 'Кальян'],
        datasets: [{
          data: [d.by_category.tickets, d.by_category.bar, d.by_category.kitchen, d.by_category.hookah],
          backgroundColor: [CAT_COLORS.tickets, CAT_COLORS.bar, CAT_COLORS.kitchen, CAT_COLORS.hookah],
          borderWidth: 3,
          borderColor: '#fff',
          hoverOffset: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '62%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 14, usePointStyle: true, pointStyle: 'circle', font: { size: 12, family: 'Inter' } }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const val = ctx.parsed as number;
                const total = (ctx.dataset.data as number[]).reduce((a, b) => a + (Number(b) || 0), 0);
                const pct = total ? Math.round((val / total) * 100) : 0;
                return ` ${ctx.label}: ${money(val)} (${pct}%)`;
              }
            }
          }
        }
      },
      plugins: [donutCenter],
    };
    this.donutChart = new Chart(this.donutRef.nativeElement, cfg);
  }

  private drawBar() {
    const analytics = this.shiftAnalytics();
    if (!this.shiftsRef || !analytics.length) return;
    this.barChart?.destroy();

    const cfg: ChartConfiguration<'bar'> = {
      type: 'bar',
      data: {
        labels: analytics.map(s => new Date(s.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })),
        datasets: [
          { label: 'Билеты', data: analytics.map(s => s.tickets), backgroundColor: CAT_COLORS.tickets, stack: 'a', borderRadius: 2, maxBarThickness: 46 },
          { label: 'Бар',    data: analytics.map(s => s.bar),     backgroundColor: CAT_COLORS.bar,     stack: 'a', borderRadius: 2, maxBarThickness: 46 },
          { label: 'Кухня',  data: analytics.map(s => s.kitchen), backgroundColor: CAT_COLORS.kitchen, stack: 'a', borderRadius: 2, maxBarThickness: 46 },
          { label: 'Кальян', data: analytics.map(s => s.hookah),  backgroundColor: CAT_COLORS.hookah,  stack: 'a', borderRadius: { topLeft: 4, topRight: 4, bottomLeft: 0, bottomRight: 0 } as any, maxBarThickness: 46 },
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        scales: {
          x: {
            stacked: true,
            grid: { display: false },
            ticks: { font: { size: 11, family: 'Inter' }, color: '#78716C' }
          },
          y: {
            stacked: true,
            beginAtZero: true,
            grid: { color: '#F0EBE0' },
            ticks: {
              font: { size: 11, family: 'Inter' },
              color: '#78716C',
              callback: (v) => {
                const n = Number(v);
                return n >= 1000 ? (n / 1000) + 'к' : String(n);
              }
            }
          }
        },
        plugins: {
          legend: { labels: { usePointStyle: true, pointStyle: 'circle', font: { size: 12, family: 'Inter' } } },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${money(Number(ctx.parsed.y) || 0)}`,
              footer: (items) => {
                const sum = items.reduce((a, i) => a + (Number(i.parsed.y) || 0), 0);
                return 'Итого: ' + money(sum);
              }
            }
          }
        }
      }
    };
    this.barChart = new Chart(this.shiftsRef.nativeElement, cfg);
  }

}
