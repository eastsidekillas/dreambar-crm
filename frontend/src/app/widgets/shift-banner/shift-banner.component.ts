import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BdBadgeComponent } from '../../shared/ui';
import { Shift } from '../../core/models';
import { formatDate, formatMoney } from '../../shared/lib/formatters';

@Component({
  selector: 'shift-banner',
  standalone: true,
  imports: [CommonModule, BdBadgeComponent],
  template: `
    @if (shift) {
      <div class="flex items-center justify-between px-4 py-2.5"
           style="background:#111009;border-bottom:1px solid rgba(198,160,99,0.15)">
        <div>
          <div class="flex items-center gap-2">
            <bd-badge status="live">СМЕНА</bd-badge>
            <span style="font-family:'Oswald',sans-serif;font-weight:300;font-size:0.7rem;color:#9c7a45;letter-spacing:0.1em">
              {{ fmt(shift.date) }}
            </span>
          </div>
          <p style="font-family:'Oswald',sans-serif;font-weight:200;font-size:0.58rem;letter-spacing:0.12em;color:#6f5a37;margin-top:1px">
            {{ shift.orders_count }} заказов &nbsp;·&nbsp; {{ shift.tickets_count }} билетов
          </p>
        </div>
        <span style="font-family:'Oswald',sans-serif;font-weight:500;font-size:1rem;color:#c6a063">
          {{ money(shift.total_revenue) }}
        </span>
      </div>
    } @else {
      <div class="flex items-center justify-between px-4 py-2.5"
           style="background:#111009;border-bottom:1px solid rgba(198,160,99,0.12)">
        <span style="font-family:'Oswald',sans-serif;font-weight:200;font-size:0.62rem;letter-spacing:0.2em;color:#6f5a37;text-transform:uppercase">
          Смена не открыта
        </span>
        <button (click)="open.emit()"
                style="font-family:'Oswald',sans-serif;font-weight:400;font-size:0.6rem;letter-spacing:0.18em;color:#c6a063;text-transform:uppercase;background:none;border:1px solid rgba(198,160,99,0.4);padding:5px 14px;cursor:pointer;min-height:36px">
          ОТКРЫТЬ СМЕНУ
        </button>
      </div>
    }
  `
})
export class ShiftBannerComponent {
  @Input() shift: Shift | null = null;
  @Output() open = new EventEmitter<void>();

  fmt  = (d: string) => formatDate(d);
  money = (n: number) => formatMoney(n);
}
