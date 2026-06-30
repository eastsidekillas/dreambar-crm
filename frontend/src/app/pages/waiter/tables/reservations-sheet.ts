import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Reservation } from '../../../core/models';
import { BdBottomSheetComponent } from '../../../shared/ui';
import {
  LucideArmchair, LucideUsers,
  LucideTriangleAlert, LucideBanknote, LucideMessageCircle, LucideUserCheck,
} from '@lucide/angular';

const RESV_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pending:   { label: 'Ожидает',      color: '#92400e', bg: '#fffbeb', border: '#fcd34d' },
  confirmed: { label: 'Подтверждена', color: '#1e40af', bg: '#eff6ff', border: '#93c5fd' },
  arrived:   { label: 'Пришли',       color: '#166534', bg: '#f0fdf4', border: '#86efac' },
  completed: { label: 'Завершена',    color: '#6b7280', bg: '#f9fafb', border: '#e5e7eb' },
  cancelled: { label: 'Отменена',     color: '#991b1b', bg: '#fef2f2', border: '#fca5a5' },
};

/** Шторка «Брони на сегодня» — только отображение списка. */
@Component({
  selector: 'reservations-sheet',
  standalone: true,
  imports: [CommonModule, BdBottomSheetComponent, LucideArmchair, LucideUsers,
            LucideTriangleAlert, LucideBanknote, LucideMessageCircle, LucideUserCheck],
  template: `
    <bd-bottom-sheet title="Брони на сегодня" maxHeight="80dvh" (closed)="closed.emit()">
      <div class="px-4 py-3 space-y-2">
        @for (r of reservations; track r.id) {
          <div class="flex items-start gap-3 px-3 py-2.5 rounded-xl" [style]="cardStyle(r.status)">
            <div class="flex-shrink-0 text-center" style="min-width:48px">
              <p class="font-bold text-sm leading-none">{{ fmtTime(r.time_start) }}</p>
              @if (r.time_end) {
                <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ fmtTime(r.time_end) }}</p>
              }
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <p class="font-semibold text-sm">{{ r.name }}</p>
                <span class="text-xs px-1.5 py-0.5 rounded-full font-medium"
                      [style]="badgeStyle(r.status)">{{ label(r.status) }}</span>
              </div>
              <div class="flex items-center gap-2 mt-0.5 text-xs flex-wrap" style="color:var(--color-muted)">
                @if (r.table_number) {
                  <span class="font-medium flex items-center gap-0.5" style="color:var(--color-text)"><svg lucideArmchair [size]="12"></svg> {{ r.table_number }}</span>
                } @else {
                  <span class="flex items-center gap-0.5" style="color:#f59e0b"><svg lucideTriangleAlert [size]="12"></svg> Стол не назначен</span>
                }
                <span class="flex items-center gap-0.5"><svg lucideUsers [size]="12"></svg> {{ r.guests_count }}</span>
                @if (+r.deposit_amount > 0) {
                  <span class="flex items-center gap-0.5" [style.color]="r.deposit_paid ? '#16a34a' : '#92400e'">
                    <svg lucideBanknote [size]="12"></svg> {{ +r.deposit_amount | number:'1.0-0' }} ₽ {{ r.deposit_paid ? '✓' : '...' }}
                  </span>
                }
              </div>
              @if (r.wishes) {
                <p class="text-xs mt-0.5 truncate flex items-center gap-0.5" style="color:var(--color-muted)"><svg lucideMessageCircle [size]="12"></svg> {{ r.wishes }}</p>
              }
              @if (canArrive(r.status)) {
                <button (click)="onArrive(r)" [disabled]="busy().has(r.id)"
                        class="mt-2 w-full rounded-lg font-semibold text-sm flex items-center justify-center gap-1.5"
                        style="height:38px;background:#f0fdf4;color:#166534;border:1px solid #86efac">
                  <svg lucideUserCheck [size]="15"></svg> {{ busy().has(r.id) ? '...' : 'Гость пришёл' }}
                </button>
              }
            </div>
          </div>
        }
      </div>
    </bd-bottom-sheet>
  `,
})
export class ReservationsSheet {
  @Input() reservations: Reservation[] = [];
  @Output() arrive = new EventEmitter<Reservation>();
  @Output() closed = new EventEmitter<void>();

  /** id броней с отправленной отметкой «пришли» — чтобы не дёргать дважды. */
  busy = signal<Set<number>>(new Set());

  /** Отметить можно бронь, гость по которой ещё не пришёл и она не завершена/отменена. */
  canArrive(status: string): boolean { return status === 'pending' || status === 'confirmed'; }

  onArrive(r: Reservation) {
    if (this.busy().has(r.id)) return;
    this.busy.update(s => new Set(s).add(r.id));
    this.arrive.emit(r);
  }

  fmtTime(t: string): string { return t?.slice(0, 5) ?? ''; }
  cardStyle(status: string): string {
    const m = RESV_META[status] ?? RESV_META['pending'];
    return `background:${m.bg};border:1px solid ${m.border}`;
  }
  badgeStyle(status: string): string {
    const m = RESV_META[status] ?? RESV_META['pending'];
    return `background:${m.border};color:${m.color}`;
  }
  label(status: string): string { return RESV_META[status]?.label ?? status; }
}