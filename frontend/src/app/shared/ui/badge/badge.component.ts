import { Component, Input } from '@angular/core';

type Status = 'open' | 'closed' | 'cancelled' | 'live' | 'default';

const COLORS: Record<Status, { color: string; bg: string }> = {
  live:      { color: '#2ecc71', bg: 'rgba(46,204,113,0.12)' },
  closed:    { color: '#2ecc71', bg: 'rgba(46,204,113,0.12)' },
  open:      { color: '#f5a623', bg: 'rgba(245,166,35,0.12)'  },
  cancelled: { color: '#c0392b', bg: 'rgba(192,57,43,0.12)'  },
  default:   { color: '#6f5a37', bg: 'transparent'            },
};

@Component({
  selector: 'bd-badge',
  standalone: true,
  template: `
    <span class="inline-flex items-center gap-1"
          [style.color]="c.color"
          [style.background]="c.bg"
          style="font-family:'Oswald',sans-serif;font-weight:300;font-size:0.58rem;letter-spacing:0.16em;text-transform:uppercase;padding:2px 7px;border:1px solid currentColor;border-radius:1px">
      @if (status === 'live') {
        <span class="w-1.5 h-1.5 rounded-full animate-pulse" style="background:#2ecc71;flex-shrink:0"></span>
      }
      <ng-content />
    </span>
  `
})
export class BdBadgeComponent {
  @Input() status: Status = 'default';
  get c() { return COLORS[this.status] ?? COLORS.default; }
}
