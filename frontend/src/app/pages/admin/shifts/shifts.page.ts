import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Shift, ShiftDetail } from '../../../core/models';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">📅 Смены</h1>
        <button (click)="createShift()" class="btn btn-primary">+ Открыть смену</button>
      </div>

      @for (shift of shifts(); track shift.id) {
        <div class="card">
          <!-- Header -->
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-bold text-base">{{ formatDate(shift.date) }}</h3>
                @if (shift.is_open) {
                  <span class="badge badge-green">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>Открыта
                  </span>
                } @else {
                  <span class="badge badge-gray">Закрыта</span>
                }
              </div>
              @if (shift.opened_by_name) {
                <p class="text-xs" style="color:var(--color-muted)">
                  Открыл: {{ shift.opened_by_name }}
                  @if (shift.closed_at) { &nbsp;· Закрыта: {{ formatTime(shift.closed_at) }} }
                </p>
              }
            </div>
            <div class="flex items-center gap-2 flex-wrap justify-end">
              @if (shift.is_open) {
                <button (click)="closeShift(shift)" class="btn btn-ghost btn-sm">Закрыть смену</button>
              } @else {
                <button (click)="reopenShift(shift)" class="btn btn-ghost btn-sm">Открыть</button>
              }
              <button (click)="toggleDetail(shift)" class="btn btn-ghost btn-sm">
                {{ openedId() === shift.id ? '▲ Свернуть' : '▼ Детали' }}
              </button>
              <button (click)="exportShift(shift)" class="btn btn-outline btn-sm">📥 Excel</button>
            </div>
          </div>

          <!-- Quick stats -->
          <div class="grid grid-cols-3 gap-3 pt-3" style="border-top:1px solid var(--color-border)">
            <div class="text-center">
              <p class="text-2xl font-bold">{{ shift.tickets_count }}</p>
              <p class="section-title mt-0.5">Билетов</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold">{{ shift.orders_count }}</p>
              <p class="section-title mt-0.5">Заказов</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold" style="color:var(--color-gold-hover)">
                {{ shift.total_revenue | number:'1.0-0' }} ₽
              </p>
              <p class="section-title mt-0.5">Выручка</p>
            </div>
          </div>

          <!-- Detail panel -->
          @if (openedId() === shift.id) {
            @if (detailLoading()) {
              <div class="mt-4 pt-4 text-center" style="border-top:1px solid var(--color-border)">
                <p class="text-sm" style="color:var(--color-muted)">Загрузка...</p>
              </div>
            } @else if (detail()) {
              <div class="mt-4 pt-4 space-y-4" style="border-top:1px solid var(--color-border)">

                <!-- Summary chips -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div class="rounded-lg p-3 text-center" style="background:var(--color-surface2)">
                    <p class="font-bold text-lg" style="color:var(--color-gold-hover)">{{ detail()!.summary.total_revenue | number:'1.0-0' }} ₽</p>
                    <p class="text-xs section-title">Выручка</p>
                  </div>
                  <div class="rounded-lg p-3 text-center" style="background:var(--color-surface2)">
                    <p class="font-bold text-lg">{{ detail()!.summary.receipts_count }}</p>
                    <p class="text-xs section-title">Чеков</p>
                  </div>
                  <div class="rounded-lg p-3 text-center" style="background:var(--color-surface2)">
                    <p class="font-bold text-lg">{{ detail()!.summary.guests_count }}</p>
                    <p class="text-xs section-title">Гостей</p>
                  </div>
                  <div class="rounded-lg p-3 text-center" style="background:var(--color-surface2)">
                    <p class="font-bold text-lg">{{ detail()!.summary.avg_check | number:'1.0-0' }} ₽</p>
                    <p class="text-xs section-title">Ср. чек</p>
                  </div>
                </div>

                <!-- Two-column layout -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">

                  <!-- By category -->
                  <div>
                    <p class="section-title mb-2">По разделам</p>
                    @for (row of categoryRows(detail()!); track row.label) {
                      <div class="mb-2">
                        <div class="flex justify-between text-sm mb-1">
                          <span>{{ row.label }}</span>
                          <span class="font-medium">{{ row.amount | number:'1.0-0' }} ₽
                            <span style="color:var(--color-muted)"> · {{ row.pct }}%</span>
                          </span>
                        </div>
                        <div class="h-1.5 rounded-full" style="background:var(--color-surface2)">
                          <div class="h-1.5 rounded-full" style="background:var(--color-gold)" [style.width.%]="row.pct"></div>
                        </div>
                      </div>
                    }
                  </div>

                  <!-- By payment -->
                  <div>
                    <p class="section-title mb-2">По оплате</p>
                    @for (p of detail()!.by_payment; track p.method) {
                      <div class="flex justify-between text-sm py-1" style="border-bottom:1px solid var(--color-border)">
                        <span>{{ p.label }}</span>
                        <span class="font-medium">{{ p.amount | number:'1.0-0' }} ₽</span>
                      </div>
                    }
                    @if (detail()!.summary.deleted_count) {
                      <div class="flex justify-between text-sm py-1 mt-1">
                        <span style="color:#dc2626">Удалено позиций</span>
                        <span style="color:#dc2626" class="font-medium">
                          {{ detail()!.summary.deleted_count }} / {{ detail()!.summary.deleted_amount | number:'1.0-0' }} ₽
                        </span>
                      </div>
                    }
                  </div>
                </div>

                <!-- Employees -->
                @if (detail()!.employees.length) {
                  <div>
                    <p class="section-title mb-2">Сотрудники</p>
                    <div class="space-y-1">
                      @for (e of detail()!.employees; track e.user_id) {
                        <div class="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg" style="background:var(--color-surface2)">
                          <span class="font-medium">{{ e.display_name }}</span>
                          <div class="flex items-center gap-4" style="color:var(--color-muted)">
                            <span>{{ e.orders_count }} зак.</span>
                            <span class="font-bold" style="color:var(--color-gold-hover)">{{ e.revenue | number:'1.0-0' }} ₽</span>
                          </div>
                        </div>
                      }
                    </div>
                  </div>
                }

                <!-- Top items -->
                @if (detail()!.top_items.length) {
                  <div>
                    <p class="section-title mb-2">Топ позиций</p>
                    <div class="overflow-x-auto">
                      <table class="w-full text-sm">
                        <thead>
                          <tr style="border-bottom:1px solid var(--color-border)">
                            <th class="text-left py-1 section-title">#</th>
                            <th class="text-left py-1 section-title">Позиция</th>
                            <th class="text-right py-1 section-title">Кол-во</th>
                            <th class="text-right py-1 section-title">Выручка</th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (item of detail()!.top_items; track item.name; let i = $index) {
                            <tr style="border-bottom:1px solid var(--color-border)">
                              <td class="py-1.5" style="color:var(--color-muted)">{{ i + 1 }}</td>
                              <td class="py-1.5">
                                {{ item.name }}
                                @if (item.volume) { <span style="color:var(--color-muted)"> {{ item.volume }}</span> }
                              </td>
                              <td class="py-1.5 text-right">{{ item.qty }}</td>
                              <td class="py-1.5 text-right font-medium" style="color:var(--color-gold-hover)">{{ item.revenue | number:'1.0-0' }} ₽</td>
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

      @if (!shifts().length) {
        <div class="card text-center py-12">
          <span class="text-4xl block mb-3">📅</span>
          <p style="color:var(--color-muted)">Смен пока нет.</p>
        </div>
      }
    </div>
  `
})
export class ShiftsComponent implements OnInit {
  shifts        = signal<Shift[]>([]);
  openedId      = signal<number | null>(null);
  detail        = signal<ShiftDetail | null>(null);
  detailLoading = signal(false);

  constructor(private api: ApiService) {}

  ngOnInit() { this.load(); }

  load() { this.api.getShifts().subscribe(s => this.shifts.set(s)); }

  createShift()   { this.api.createShift({}).subscribe(() => this.load()); }
  closeShift(s: Shift)  { this.api.closeShift(s.id).subscribe(() => this.load()); }
  reopenShift(s: Shift) { this.api.reopenShift(s.id).subscribe(() => this.load()); }

  toggleDetail(shift: Shift) {
    if (this.openedId() === shift.id) {
      this.openedId.set(null);
      this.detail.set(null);
      return;
    }
    this.openedId.set(shift.id);
    this.detail.set(null);
    this.detailLoading.set(true);
    this.api.getShiftDetail(shift.id).subscribe({
      next:  d => { this.detail.set(d); this.detailLoading.set(false); },
      error: () => this.detailLoading.set(false),
    });
  }

  categoryRows(d: ShiftDetail) {
    const total = d.summary.total_revenue || 1;
    return [
      { label: 'Бар',     amount: d.by_category.bar,     pct: Math.round(d.by_category.bar     / total * 100) },
      { label: 'Кухня',   amount: d.by_category.kitchen, pct: Math.round(d.by_category.kitchen / total * 100) },
      { label: 'Кальян',  amount: d.by_category.hookah,  pct: Math.round(d.by_category.hookah  / total * 100) },
      { label: 'Билеты',  amount: d.by_category.tickets, pct: Math.round(d.by_category.tickets / total * 100) },
    ].filter(r => r.amount > 0);
  }

  exportShift(shift: Shift) {
    this.api.downloadExport(this.api.exportShift(shift.id)).subscribe(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'bardream_shift_' + shift.date + '.xlsx';
      a.click();
    });
  }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  }
  formatTime(dt: string) {
    return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }
}