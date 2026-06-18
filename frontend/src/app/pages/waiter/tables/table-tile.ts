import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucidePlus, LucideUsers } from '@lucide/angular';
import { Order, Reservation } from '../../../core/models';
import { bill, orderStatus } from '../../../entities/order';

export type TableStatus = 'free' | 'occupied' | 'reserved';

/** Карточка стола в плане зала. Презентационная: данные приходят входами,
 * тап отдаётся событием (mine = занят текущим официантом). */
@Component({
  selector: 'table-tile',
  standalone: true,
  imports: [CommonModule, LucidePlus, LucideUsers],
  template: `
    <button (click)="tap.emit(num)" [disabled]="status === 'occupied' && !mine"
            class="flex flex-col text-left rounded-2xl overflow-hidden transition-transform active:scale-[0.98] w-full"
            style="min-height:150px"
            [style.background]="tileBg()"
            [style.border]="tileBorder()"
            [style.opacity]="status === 'occupied' && !mine ? '0.55' : '1'"
            [style.box-shadow]="ready ? '0 0 0 2px #16a34a' : null">

      <!-- ── Тело: номер · статус · дата + позиции ── -->
      <div class="px-3 pt-2.5 pb-2 flex-1 min-h-0 w-full">
        <div class="flex items-start justify-between gap-1">
          <span class="font-bold text-base leading-tight truncate"
                [style.color]="ready ? '#16a34a' : tileText()">{{ order ? order.table_number : num }}</span>
          @if (mine && order) {
            <span class="text-xs flex-shrink-0" style="color:var(--color-muted)">{{ fmtClock(order.created_at) }}</span>
          } @else if (status === 'reserved' && resv) {
            <span class="text-xs flex-shrink-0" style="color:#2563eb">{{ fmtTime(resv.time_start) }}</span>
          }
        </div>

        <!-- статус -->
        @if (mine && order) {
          @if (readyCount(order) > 0) {
            <span class="text-xs font-semibold" style="color:#16a34a">Блюда готовы · {{ readyCount(order) }}</span>
          } @else {
            @let st = orderState(order);
            <span class="text-xs font-semibold" [style.color]="st.color">{{ st.label }}</span>
          }
        } @else if (status === 'reserved' && resv) {
          <span class="text-xs font-semibold truncate block" style="color:#1d4ed8">{{ resv.name }}</span>
        } @else if (status === 'occupied') {
          <span class="text-xs font-medium" style="color:var(--color-muted)">Занят</span>
        } @else {
          <span class="text-xs font-medium" style="color:var(--color-muted)">Свободен</span>
        }

        <!-- позиции (превью) -->
        @if (mine && order && itemNames(order).length) {
          <div class="mt-2 pt-2 space-y-0.5" style="border-top:1px solid var(--color-gold-mid)">
            @for (name of itemNames(order).slice(0, 3); track $index) {
              <p class="text-xs truncate leading-snug" style="color:var(--color-text)">{{ name }}</p>
            }
            @if (itemNames(order).length > 3) {
              <p class="text-xs leading-none" style="color:var(--color-muted)">…</p>
            }
          </div>
        } @else if (status === 'free') {
          <div class="flex items-center justify-center mt-4" style="color:var(--color-light)">
            <svg lucidePlus [size]="24"></svg>
          </div>
        }
      </div>

      <!-- ── Подвал: гости · сумма ── -->
      @if (mine && order) {
        <div class="flex items-center justify-between px-3 py-2 w-full"
             style="border-top:1px solid var(--color-gold-mid)">
          <span class="text-xs flex items-center gap-1" style="color:var(--color-muted)">
            <svg lucideUsers [size]="13"></svg> {{ order.guests || '—' }}
          </span>
          <span class="font-bold text-sm" style="color:var(--color-gold-hover)">{{ unpaidTotal(order) | number:'1.0-0' }} ₽</span>
        </div>
      } @else if (status === 'reserved' && resv) {
        <div class="flex items-center justify-between px-3 py-2 w-full" style="border-top:1px solid #bfdbfe">
          <span class="text-xs flex items-center gap-1" style="color:#2563eb">
            <svg lucideUsers [size]="13"></svg> {{ resv.guests_count }}
          </span>
          @if (+resv.deposit_amount > 0) {
            <span class="text-xs font-semibold" style="color:#2563eb">{{ +resv.deposit_amount | number:'1.0-0' }} ₽</span>
          }
        </div>
      }
    </button>
  `,
})
export class TableTile {
  @Input({ required: true }) num!: string;
  @Input({ required: true }) status: TableStatus = 'free';
  @Input() order: Order | null = null;
  @Input() resv: Reservation | null = null;
  @Input() mine = false;

  @Output() tap = new EventEmitter<string>();

  readyCount  = bill.readyCount;
  unpaidTotal = bill.unpaidTotal;
  orderState  = orderStatus;

  /** Свой занятый стол с готовыми блюдами — подсветить рамкой. */
  get ready(): boolean { return this.mine && !!this.order && bill.readyCount(this.order) > 0; }

  itemNames(o: Order): string[] { return bill.unpaidItems(o).map(i => i.menu_item_name); }
  fmtTime(t: string): string { return t?.slice(0, 5) ?? ''; }
  /** Время создания заказа ЧЧ:ММ — в углу карточки. */
  fmtClock(iso: string): string {
    const d = new Date(iso);
    return isNaN(d.getTime()) ? '' : d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  // ── Стиль плитки по статусу (mine = занят мной) ──
  tileBg(): string {
    if (this.status === 'occupied') return this.mine ? 'var(--color-gold-light)' : 'var(--color-surface2)';
    if (this.status === 'reserved') return '#eff6ff';
    return 'var(--color-surface)';
  }
  tileBorder(): string {
    if (this.status === 'occupied') return this.mine ? '1.5px solid var(--color-gold-mid)' : '1px solid var(--color-border)';
    if (this.status === 'reserved') return '1.5px solid #bfdbfe';
    return '1px solid var(--color-border)';
  }
  tileText(): string {
    if (this.status === 'occupied') return this.mine ? 'var(--color-gold-hover)' : 'var(--color-muted)';
    if (this.status === 'reserved') return '#1d4ed8';
    return 'var(--color-text)';
  }
}