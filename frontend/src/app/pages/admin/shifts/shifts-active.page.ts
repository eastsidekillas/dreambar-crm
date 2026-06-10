import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Shift, ShiftDetail } from '../../../core/models';
import {
  LucideDynamicIcon,
  LucideBanknote, LucideCreditCard, LucideSmartphone, LucideShuffle,
  LucideGlassWater, LucideUtensilsCrossed, LucideWind, LucideTicket,
  LucideTrash2, LucideDownload,
} from '@lucide/angular';

const PAY_ICON: Record<string, LucideIconInput> = {
  cash: LucideBanknote, card: LucideCreditCard, transfer: LucideSmartphone, mixed: LucideShuffle,
};

@Component({
  selector: 'app-shifts-active',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon,
    LucideTrash2, LucideDownload],
  template: `
<div class="space-y-4">

  <!-- ── Open shift hero (when no open shift) ──────────────────── -->
  @if (openShifts().length === 0) {
    <div class="rounded-2xl p-6 text-center"
         style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:2px solid #f59e0b">
      <span class="text-5xl block mb-3">🔴</span>
      <p class="text-xl font-bold mb-1" style="color:#78350f">Смена не открыта</p>
      <p class="text-sm mb-5" style="color:#92400e">
        Заказы и билеты не принимаются. Откройте смену чтобы начать работу.
      </p>
      <button (click)="createShift()"
              class="btn btn-primary"
              style="font-size:1.1rem;padding:16px 40px;min-height:56px;background:#f59e0b;color:#000;font-weight:800;border:none;border-radius:14px">
        ⚡ Открыть смену
      </button>
    </div>
  } @else {
    <!-- Current open shift highlight -->
    @for (s of openShifts(); track s.id) {
      <div class="rounded-2xl p-4 flex items-center gap-4 flex-wrap"
           style="background:linear-gradient(135deg,#f0fdf4,#dcfce7);border:2px solid #22c55e">
        <span class="w-3 h-3 rounded-full bg-green-500 animate-pulse flex-shrink-0"></span>
        <div class="flex-1">
          <p class="font-bold" style="color:#166534">Смена открыта — {{ formatDate(s.date) }}</p>
          <p class="text-sm" style="color:#15803d">
            {{ formatTime(s.opened_at) }} · {{ s.orders_count }} заказов · {{ s.total_revenue | number:'1.0-0' }} ₽
          </p>
        </div>
        <button (click)="closeShift(s)"
                class="btn flex-shrink-0"
                style="background:#dc2626;color:white;border:none;padding:12px 24px;font-size:0.95rem;min-height:48px">
          Закрыть смену
        </button>
      </div>
    }
  }

  <div class="flex items-center justify-between flex-wrap gap-3">
    <p class="font-semibold text-sm" style="color:var(--color-muted)">
      История смен ({{ shifts().length }})
    </p>
    @if (openShifts().length > 0) {
      <button (click)="createShift()" class="btn btn-ghost btn-sm" [disabled]="true"
              style="opacity:0.5">Открыть ещё</button>
    }
  </div>

  <div class="space-y-3">
    @for (shift of shifts(); track shift.id) {
      <div class="card overflow-hidden"
           [style.border-color]="shift.is_open ? 'var(--color-gold)' : 'var(--color-border)'">

        <div class="flex items-center gap-3 flex-wrap">

          <div class="flex items-center gap-2 min-w-[140px]">
            <span class="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  [style.background]="shift.is_open ? '#22c55e' : '#94a3b8'"></span>
            <div>
              <p class="font-bold text-sm leading-none">{{ formatDate(shift.date) }}</p>
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">
                {{ formatTime(shift.opened_at) }}
                @if (shift.closed_at) { — {{ formatTime(shift.closed_at) }} }
                @else { — сейчас }
              </p>
            </div>
          </div>

          <div class="flex items-center gap-4 flex-1 flex-wrap ml-2">
            <div class="text-center min-w-[60px]">
              <p class="font-bold text-base leading-none">{{ shift.tickets_count }}</p>
              <p class="text-xs section-title mt-0.5">Билеты</p>
            </div>
            <div class="text-center min-w-[60px]">
              <p class="font-bold text-base leading-none">{{ shift.orders_count }}</p>
              <p class="text-xs section-title mt-0.5">Заказы</p>
            </div>
            <div class="text-center min-w-[80px]">
              <p class="font-bold text-base leading-none" style="color:var(--color-gold-hover)">
                {{ shift.total_revenue | number:'1.0-0' }} ₽
              </p>
              <p class="text-xs section-title mt-0.5">Выручка</p>
            </div>
            <div class="flex-1"></div>
            <p class="text-xs" style="color:var(--color-muted)">{{ shift.opened_by_name }}</p>
          </div>

          <div>
            @if (shift.is_open) {
              <span class="badge badge-green">
                <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>Открыта
              </span>
            } @else {
              <span class="badge badge-gray">Закрыта</span>
            }
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            @if (!shift.is_open) {
              <button (click)="reopenShift(shift)" class="btn btn-ghost btn-sm">↩ Открыть</button>
            }
            <button (click)="toggleDetail(shift)" class="btn btn-ghost btn-sm"
                    style="min-height:40px;min-width:80px">
              {{ openedId() === shift.id ? '▲ Свернуть' : '▼ Детали' }}
            </button>
            <button (click)="exportShift(shift)" class="btn btn-ghost btn-sm"
                    style="min-height:40px" title="Excel"><svg lucideDownload [size]="14"></svg></button>
          </div>
        </div>

        @if (openedId() === shift.id) {
          @if (detailLoading()) {
            <div class="mt-4 pt-4 text-center text-sm"
                 style="border-top:1px solid var(--color-border);color:var(--color-muted)">
              Загрузка...
            </div>
          } @else if (detail()) {
            <div class="mt-4 pt-4 space-y-4" style="border-top:1px solid var(--color-border)">

              <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                @for (s of summaryChips(detail()!); track s.label) {
                  <div class="rounded-xl p-3 text-center" style="background:var(--color-surface2)">
                    <p class="font-bold text-lg leading-none" [style.color]="s.color ?? 'var(--color-text)'">
                      {{ s.value }}
                    </p>
                    <p class="text-xs section-title mt-1">{{ s.label }}</p>
                  </div>
                }
              </div>

              <div class="grid grid-cols-1 md:grid-cols-3 gap-4">

                <div>
                  <p class="section-title mb-3">По разделам</p>
                  @for (row of categoryRows(detail()!); track row.label) {
                    <div class="mb-3">
                      <div class="flex justify-between text-sm mb-1">
                        <span class="flex items-center gap-1"><svg [lucideIcon]="row.icon" [size]="14"></svg> {{ row.label }}</span>
                        <span class="font-medium">{{ row.amount | number:'1.0-0' }} ₽
                          <span style="color:var(--color-muted)">{{ row.pct }}%</span>
                        </span>
                      </div>
                      <div class="h-1.5 rounded-full" style="background:var(--color-surface2)">
                        <div class="h-1.5 rounded-full" style="background:var(--color-gold)"
                             [style.width.%]="row.pct"></div>
                      </div>
                    </div>
                  }
                </div>

                <div>
                  <p class="section-title mb-3">По типу оплаты</p>
                  @for (p of detail()!.by_payment; track p.method) {
                    <div class="flex items-center justify-between text-sm py-2"
                         style="border-bottom:1px solid var(--color-border)">
                      <span class="flex items-center gap-1.5">
                        <svg [lucideIcon]="payIcon(p.method)" [size]="14"></svg> {{ p.label }}
                      </span>
                      <span class="font-semibold">{{ p.amount | number:'1.0-0' }} ₽</span>
                    </div>
                  }
                  @if (detail()!.summary.deleted_count) {
                    <div class="flex justify-between text-sm py-2 mt-1">
                      <span class="flex items-center gap-1" style="color:#ef4444"><svg lucideTrash2 [size]="14"></svg> Удалено позиций</span>
                      <span style="color:#ef4444" class="font-medium">
                        {{ detail()!.summary.deleted_count }} шт /
                        {{ detail()!.summary.deleted_amount | number:'1.0-0' }} ₽
                      </span>
                    </div>
                  }
                </div>

                <div>
                  <p class="section-title mb-3">Сотрудники</p>
                  @for (e of detail()!.employees; track e.user_id) {
                    <div class="flex items-center justify-between text-sm py-2"
                         style="border-bottom:1px solid var(--color-border)">
                      <span class="font-medium">{{ e.display_name }}</span>
                      <div class="flex gap-3 text-xs" style="color:var(--color-muted)">
                        <span>{{ e.orders_count }} зак.</span>
                        <span class="font-semibold" style="color:var(--color-gold-hover)">
                          {{ e.revenue | number:'1.0-0' }} ₽
                        </span>
                      </div>
                    </div>
                  }
                  @if (!detail()!.employees.length) {
                    <p class="text-sm" style="color:var(--color-muted)">Нет данных</p>
                  }
                </div>
              </div>

              @if (detail()!.top_items.length) {
                <div>
                  <p class="section-title mb-2">Топ позиций</p>
                  <div class="overflow-x-auto rounded-xl" style="border:1px solid var(--color-border)">
                    <table class="w-full text-sm">
                      <thead>
                        <tr style="background:var(--color-surface2)">
                          <th class="text-left px-3 py-2 section-title font-medium">#</th>
                          <th class="text-left px-3 py-2 section-title font-medium">Позиция</th>
                          <th class="text-right px-3 py-2 section-title font-medium">Кол-во</th>
                          <th class="text-right px-3 py-2 section-title font-medium">Выручка</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of detail()!.top_items.slice(0, 10); track item.name; let i = $index) {
                          <tr style="border-top:1px solid var(--color-border)">
                            <td class="px-3 py-2" style="color:var(--color-muted)">{{ i + 1 }}</td>
                            <td class="px-3 py-2">
                              {{ item.name }}
                              @if (item.volume) {
                                <span style="color:var(--color-muted)"> {{ item.volume }}</span>
                              }
                            </td>
                            <td class="px-3 py-2 text-right">{{ item.qty }}</td>
                            <td class="px-3 py-2 text-right font-semibold"
                                style="color:var(--color-gold-hover)">
                              {{ item.revenue | number:'1.0-0' }} ₽
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              }

            </div>
          }
        }

      </div>
    }
  </div>

</div>
  `,
})
export class ShiftsActivePage implements OnInit {
  shifts        = signal<Shift[]>([]);
  openedId      = signal<number | null>(null);
  detail        = signal<ShiftDetail | null>(null);
  detailLoading = signal(false);

  openShifts = computed(() => this.shifts().filter(s => s.is_open));

  constructor(private api: ApiService) {}
  ngOnInit() { this.load(); }

  load() { this.api.getShifts().subscribe(s => this.shifts.set(s)); }

  createShift()         { this.api.createShift({}).subscribe(() => this.load()); }
  closeShift(s: Shift)  { this.api.closeShift(s.id).subscribe(() => this.load()); }
  reopenShift(s: Shift) { this.api.reopenShift(s.id).subscribe(() => this.load()); }

  toggleDetail(shift: Shift) {
    if (this.openedId() === shift.id) { this.openedId.set(null); this.detail.set(null); return; }
    this.openedId.set(shift.id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.api.getShiftDetail(shift.id).subscribe({
      next:  d => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }

  exportShift(shift: Shift) {
    this.api.downloadExport(this.api.exportShift(shift.id)).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `bardream_shift_${shift.date}.xlsx`;
      a.click();
    });
  }

  summaryChips(d: ShiftDetail) {
    return [
      { label: 'Выручка', value: (d.summary.total_revenue | 0).toLocaleString('ru') + ' ₽', color: 'var(--color-gold-hover)' },
      { label: 'Чеков',   value: String(d.summary.receipts_count) },
      { label: 'Гостей',  value: String(d.summary.guests_count) },
      { label: 'Ср. чек', value: (d.summary.avg_check | 0).toLocaleString('ru') + ' ₽' },
    ];
  }

  categoryRows(d: ShiftDetail) {
    const total = d.summary.total_revenue || 1;
    return [
      { label: 'Бар',    icon: LucideGlassWater,      amount: d.by_category.bar,     pct: Math.round(d.by_category.bar     / total * 100) },
      { label: 'Кухня',  icon: LucideUtensilsCrossed, amount: d.by_category.kitchen, pct: Math.round(d.by_category.kitchen / total * 100) },
      { label: 'Кальян', icon: LucideWind,            amount: d.by_category.hookah,  pct: Math.round(d.by_category.hookah  / total * 100) },
      { label: 'Билеты', icon: LucideTicket,          amount: d.by_category.tickets, pct: Math.round(d.by_category.tickets / total * 100) },
    ].filter(r => r.amount > 0);
  }

  payIcon(method: string): LucideIconInput { return PAY_ICON[method] ?? LucideBanknote; }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' });
  }
  formatTime(dt: string) {
    return new Date(dt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
}