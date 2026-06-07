import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { ForecastDay } from '../../../core/models';

const MONTHS = ['', 'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const CATS = [
  { key: 'bar'     as const, icon: '🍹', label: 'Бар',    color: 'var(--color-bar,#3b82f6)'     },
  { key: 'kitchen' as const, icon: '🍽', label: 'Кухня',  color: 'var(--color-kitchen,#f59e0b)' },
  { key: 'hookah'  as const, icon: '💨', label: 'Кальян', color: 'var(--color-hookah,#8b5cf6)'  },
  { key: 'tickets' as const, icon: '🎫', label: 'Билеты', color: 'var(--color-gold,#d4a017)'    },
];

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">

      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 class="text-xl font-bold">🔮 Прогноз на неделю</h1>
          <p class="text-sm" style="color:var(--color-muted)">{{ weekLabel() }} · на основе прошлых смен</p>
        </div>
        <button (click)="load()" class="btn btn-outline btn-sm" [disabled]="loading()">
          🔄 Обновить
        </button>
      </div>

      @if (loading()) {
        <div class="text-center py-16" style="color:var(--color-muted)">
          <span class="text-3xl block mb-2">⏳</span>
          Загрузка прогноза...
        </div>
      } @else {

        <!-- Week summary banner -->
        @if (totalForecast() > 0) {
          <div class="card" style="background:var(--color-gold-light);border-color:var(--color-gold-mid)">
            <div class="flex flex-wrap gap-6 items-end">
              <div>
                <p class="section-title mb-1">Прогноз выручки за неделю</p>
                <p class="text-3xl font-bold" style="color:var(--color-gold-hover)">
                  {{ totalForecast() | number:'1.0-0' }} ₽
                </p>
                @if (totalAdjusted() !== totalForecast()) {
                  <p class="text-sm mt-0.5" style="color:var(--color-text)">
                    со скорректированным: <strong>{{ totalAdjusted() | number:'1.0-0' }} ₽</strong>
                  </p>
                }
              </div>
              <div class="flex gap-4 flex-wrap">
                <div>
                  <p class="section-title mb-0.5">Рабочих дней</p>
                  <p class="text-xl font-bold">{{ workdays().length }}</p>
                </div>
                <div>
                  <p class="section-title mb-0.5">Всего чеков</p>
                  <p class="text-xl font-bold">{{ totalReceipts() }}</p>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Workday cards -->
        @for (day of workdays(); track day.date; let i = $index) {
          <div class="card">

            <!-- ── Card header ─────────────────────────── -->
            <div class="flex items-start justify-between gap-2 mb-4">
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-lg font-bold">{{ day.weekday_name }}</span>
                  <span class="text-base" style="color:var(--color-muted)">{{ fmtDate(day.date) }}</span>
                </div>
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">
                  Прогноз на основе {{ day.samples }} {{ pluralSmens(day.samples) }}
                </p>
              </div>
              <!-- Adjustment chip -->
              @if (getAdj(day.date)) {
                <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                     style="background:var(--color-green-bg,#dcfce7);color:#166534">
                  ✏ {{ getAdj(day.date)! | number:'1.0-0' }} ₽
                </div>
              }
            </div>

            <!-- ── Big numbers ─────────────────────────── -->
            <div class="grid grid-cols-3 gap-3 mb-5">
              <div class="rounded-xl p-3 text-center" style="background:var(--color-gold-light)">
                <p class="text-xs font-medium mb-1" style="color:var(--color-gold-hover)">Прогноз</p>
                <p class="text-xl font-bold leading-tight" style="color:var(--color-gold-hover)">
                  {{ day.revenue | number:'1.0-0' }}
                </p>
                <p class="text-xs" style="color:var(--color-gold-hover)">₽</p>
              </div>
              <div class="rounded-xl p-3 text-center" style="background:var(--color-bg)">
                <p class="text-xs font-medium mb-1" style="color:var(--color-muted)">Чеков</p>
                <p class="text-xl font-bold leading-tight">{{ day.receipts_count }}</p>
                <p class="text-xs" style="color:var(--color-muted)">штук</p>
              </div>
              <div class="rounded-xl p-3 text-center" style="background:var(--color-bg)">
                <p class="text-xs font-medium mb-1" style="color:var(--color-muted)">Средний чек</p>
                <p class="text-xl font-bold leading-tight">{{ day.avg_check | number:'1.0-0' }}</p>
                <p class="text-xs" style="color:var(--color-muted)">₽</p>
              </div>
            </div>

            <!-- ── Category breakdown (always visible) ── -->
            <div class="space-y-2 mb-5">
              <p class="section-title">По типам заказа</p>
              @for (cat of catRows(day); track cat.key) {
                <div class="flex items-center gap-2">
                  <span class="text-sm w-5 shrink-0">{{ cat.icon }}</span>
                  <span class="text-xs w-14 shrink-0" style="color:var(--color-muted)">{{ cat.label }}</span>
                  <div class="flex-1 h-2.5 rounded-full overflow-hidden" style="background:var(--color-border)">
                    <div class="h-full rounded-full transition-all duration-500"
                         [style.width]="cat.pct + '%'"
                         [style.background]="cat.color">
                    </div>
                  </div>
                  <span class="text-xs w-8 text-right shrink-0 font-semibold"
                        style="color:var(--color-muted)">{{ cat.pct }}%</span>
                  <span class="text-xs w-20 text-right shrink-0 font-medium">
                    {{ cat.value | number:'1.0-0' }} ₽
                  </span>
                </div>
              }
            </div>

            <!-- ── Footer: adjustment + hours toggle ──── -->
            <div class="flex items-center gap-3 flex-wrap pt-3"
                 style="border-top:1px solid var(--color-border)">
              <div class="flex items-center gap-2 flex-1 min-w-0">
                <label class="text-xs shrink-0" style="color:var(--color-muted)">Скорр. сумма ₽</label>
                <input type="number"
                       [ngModel]="getAdj(day.date)"
                       (ngModelChange)="setAdj(day.date, $event)"
                       [placeholder]="day.revenue"
                       class="field text-sm"
                       style="width:120px;height:30px"/>
                @if (getAdj(day.date)) {
                  <button (click)="setAdj(day.date, null)"
                          class="text-xs shrink-0" style="color:var(--color-muted)">✕ Сбросить</button>
                }
              </div>
              <button (click)="toggleHours(i)" class="btn btn-sm shrink-0"
                      [style]="hoursOpen(i)
                        ? 'background:var(--color-gold);color:#fff;border:none'
                        : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
                🕐 По часам {{ hoursOpen(i) ? '▲' : '▼' }}
              </button>
            </div>

            <!-- ── Hourly breakdown (expandable) ──────── -->
            @if (hoursOpen(i)) {
              <div class="mt-4 pt-4" style="border-top:1px solid var(--color-border)">
                <p class="section-title mb-3">Выручка по часам (среднее за смену)</p>
                @if (day.by_hour.length) {
                  @for (h of day.by_hour; track h.hour) {
                    <div class="flex items-center gap-2 mb-1.5">
                      <span class="text-xs w-12 text-right shrink-0 font-mono tabular-nums"
                            style="color:var(--color-muted)">{{ padHour(h.hour) }}:00</span>
                      <div class="flex-1 h-4 rounded overflow-hidden" style="background:var(--color-border)">
                        <div class="h-full rounded transition-all duration-500"
                             style="background:var(--color-gold)"
                             [style.width]="pct(h.revenue, maxHourRev(day)) + '%'">
                        </div>
                      </div>
                      <span class="text-xs w-24 text-right shrink-0 font-medium">
                        {{ h.revenue | number:'1.0-0' }} ₽
                      </span>
                      <span class="text-xs w-14 text-right shrink-0" style="color:var(--color-muted)">
                        ~{{ h.receipts | number:'1.0-0' }} чек
                      </span>
                    </div>
                  }
                } @else {
                  <p class="text-sm" style="color:var(--color-muted)">Недостаточно данных</p>
                }
              </div>
            }

          </div>
        }

        <!-- Non-workdays (compact, at bottom) -->
        @if (offdays().length) {
          <div class="card card-sm">
            <p class="section-title mb-2">Остальные дни — нет данных</p>
            <div class="flex flex-wrap gap-2">
              @for (day of offdays(); track day.date) {
                <span class="text-xs px-2.5 py-1 rounded-full"
                      style="background:var(--color-border);color:var(--color-muted)">
                  {{ day.weekday_name }} {{ fmtDate(day.date) }}
                </span>
              }
            </div>
          </div>
        }

      }
    </div>
  `,
})
export class ForecastPage implements OnInit {
  days    = signal<ForecastDay[]>([]);
  loading = signal(true);

  private openHours  = signal<Set<number>>(new Set());
  adjustments        = signal<Record<string, number>>({});

  workdays = computed(() => this.days().filter(d => d.samples > 0));
  offdays  = computed(() => this.days().filter(d => d.samples === 0));

  totalForecast  = computed(() => this.workdays().reduce((s, d) => s + d.revenue, 0));
  totalReceipts  = computed(() => this.workdays().reduce((s, d) => s + d.receipts_count, 0));
  totalAdjusted  = computed(() => {
    const adj = this.adjustments();
    return this.workdays().reduce((s, d) => s + (adj[d.date] ?? d.revenue), 0);
  });

  weekLabel = computed(() => {
    const d = this.days();
    if (!d.length) return '';
    return `${this.fmtDate(d[0].date)} – ${this.fmtDate(d[d.length - 1].date)}`;
  });

  constructor(private api: ApiService) {
    try {
      const stored = localStorage.getItem('forecast_adjustments');
      if (stored) this.adjustments.set(JSON.parse(stored));
    } catch {}
  }

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getForecast().subscribe({
      next: data => { this.days.set(data); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  fmtDate(iso: string): string {
    const [, m, day] = iso.split('-');
    return `${parseInt(day)} ${MONTHS[parseInt(m)]}`;
  }

  padHour(h: number): string { return h < 10 ? '0' + h : String(h); }

  getAdj(date: string): number | null { return this.adjustments()[date] ?? null; }

  setAdj(date: string, value: number | string | null) {
    const num = value === null || value === '' ? null : Number(value);
    const adj = { ...this.adjustments() };
    if (num === null || isNaN(num)) { delete adj[date]; } else { adj[date] = num; }
    this.adjustments.set(adj);
    localStorage.setItem('forecast_adjustments', JSON.stringify(adj));
  }

  hoursOpen(i: number): boolean { return this.openHours().has(i); }

  toggleHours(i: number) {
    const s = new Set(this.openHours());
    s.has(i) ? s.delete(i) : s.add(i);
    this.openHours.set(s);
  }

  pct(value: number, max: number): number {
    return max > 0 ? Math.round((value / max) * 100) : 0;
  }

  maxHourRev(day: ForecastDay): number {
    return Math.max(...day.by_hour.map(h => h.revenue), 1);
  }

  catRows(day: ForecastDay) {
    const total = day.revenue || 1;
    return CATS.map(c => ({
      ...c,
      value: day.by_category[c.key],
      pct:   Math.round(day.by_category[c.key] / total * 100),
    }));
  }

  pluralSmens(n: number): string {
    if (n % 10 === 1 && n % 100 !== 11) return 'прошлой смены';
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'прошлых смен';
    return 'прошлых смен';
  }
}