import { Component, OnInit, OnDestroy, signal, computed, ElementRef, ViewChild, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ApiService } from '../../../core/services/api.service';
import { DashboardData, ShiftAnalytics, TopItem, Shift } from '../../../core/models';
import { Chart, registerables, ChartConfiguration } from 'chart.js';

Chart.register(...registerables);

const CAT_COLORS = {
  tickets: '#B8922A',
  bar:     '#7C3AED',
  kitchen: '#0D9488',
  hookah:  '#EA580C',
};

const money = (v: number) => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 0 }).format(v) + ' ₽';

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
  imports: [CommonModule, RouterModule],
  template: `
    <div class="space-y-5">

      <!-- ── Shift status banner ─────────────────────────────────── -->
      @if (data()) {
        @if (!data()!.current_shift) {
          <!-- No shift open -->
          <div class="rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4"
               style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b">
            <div class="flex items-center gap-3 flex-1">
              <span class="text-4xl">🔴</span>
              <div>
                <p class="font-bold text-lg leading-tight" style="color:#78350f">Смена не открыта</p>
                <p class="text-sm mt-0.5" style="color:#92400e">Билеты и заказы не принимаются</p>
              </div>
            </div>
            <a routerLink="/admin/shifts/active"
               class="btn btn-primary w-full sm:w-auto flex-shrink-0"
               style="font-size:1rem;padding:14px 28px;min-height:52px;background:#f59e0b;color:#000;font-weight:700;border:none">
              ⚡ Открыть смену
            </a>
          </div>
        } @else {
          <!-- Shift is open -->
          <div class="rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3"
               style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #22c55e">
            <div class="flex items-center gap-3 flex-1">
              <span class="w-3 h-3 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
              <div>
                <p class="font-bold text-base leading-tight" style="color:#166534">
                  Смена открыта — {{ formatDate(data()!.current_shift!.date) }}
                </p>
                <p class="text-sm mt-0.5" style="color:#15803d">
                  {{ data()!.current_shift!.orders_count }} заказов ·
                  {{ data()!.current_shift!.tickets_count }} билетов
                </p>
              </div>
            </div>
            <div class="flex items-center gap-4 sm:gap-6">
              @for (c of currentShiftCats(); track c.label) {
                <div class="text-center">
                  <p class="font-bold text-base leading-none" [style.color]="c.color">
                    {{ c.value | number:'1.0-0' }} ₽
                  </p>
                  <p class="text-xs section-title mt-0.5">{{ c.label }}</p>
                </div>
              }
              <a routerLink="/admin/shifts/active"
                 class="btn btn-ghost btn-sm flex-shrink-0"
                 style="border-color:#22c55e;color:#166534">Управление</a>
            </div>
          </div>
        }
      }

      <h1 class="text-xl font-bold">Аналитика</h1>

      @if (data()) {
        <!-- KPI row -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          @for (kpi of kpis(); track kpi.label) {
            <div class="card">
              <p class="section-title mb-1">{{ kpi.label }}</p>
              <p class="text-2xl font-bold" style="color:var(--color-text)">{{ kpi.value }}</p>
              @if (kpi.sub) {
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ kpi.sub }}</p>
              }
            </div>
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
            <h3 class="font-semibold text-sm mb-1">Выручка по категориям</h3>
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
            <h3 class="font-semibold text-sm mb-1">Топ позиций</h3>
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
          <h3 class="font-semibold text-sm mb-1">Выручка по сменам</h3>
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
          <span class="text-4xl block mb-3">⏳</span>
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

  constructor(private api: ApiService, private cdr: ChangeDetectorRef) {}

  ngOnInit() {
    this.api.getDashboard().subscribe(d => {
      this.data.set(d);
      this.cdr.detectChanges();
      queueMicrotask(() => this.drawDonut());
    });
    this.api.getTopItems().subscribe(i => {
      this.maxTop = Math.max(1, ...i.map(x => x.total_revenue));
      this.topItems.set(i);
    });
    this.api.getShiftAnalytics(15).subscribe(s => {
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
      { label: 'Выручка за 30 дней', value: money(d.total_revenue), sub: undefined },
      { label: 'Средняя за смену',   value: money(avg),             sub: undefined },
      { label: 'Заказов принято',    value: d.total_orders,         sub: 'гостей: ' + d.total_guests },
      { label: 'Смен проведено',     value: d.shifts_count,         sub: undefined },
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

  formatDate(d: string): string {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  }
}
