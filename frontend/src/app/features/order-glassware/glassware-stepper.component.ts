import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideWine } from '@lucide/angular';
import { Order } from '../../core/models';

// Посуда к столу — фиксированный набор типов (коды совпадают с бэкендом).
const GLASS_KINDS = [
  { code: 'wine',  label: 'Бокал' },
  { code: 'glass', label: 'Стакан' },
  { code: 'shot',  label: 'Рюмка' },
];

/** Степперы «Посуда к столу» — подсказка сколько нести, НЕ в счёте.
 * Презентационный: текущие значения из [order], изменение через (change). */
@Component({
  selector: 'glassware-stepper',
  standalone: true,
  imports: [CommonModule, LucideWine],
  host: { class: 'block' },
  template: `
    <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px">
      <div class="flex items-center gap-1.5 px-3 py-2" style="border-bottom:1px solid var(--color-border)">
        <svg lucideWine [size]="14" style="color:var(--color-gold-hover)"></svg>
        <span class="font-bold text-sm">Посуда к столу</span>
        <span class="text-xs" style="color:var(--color-muted)">· не в счёте</span>
      </div>
      <div class="px-3 py-1">
        @for (g of kinds; track g.code) {
          <div class="flex items-center gap-2 py-1.5">
            <span class="flex-1 text-sm">{{ g.label }}</span>
            <button (click)="change.emit({ kind: g.code, count: count(g.code) - 1 })" [disabled]="!count(g.code)"
                    class="flex items-center justify-center rounded-full font-bold"
                    [style.opacity]="count(g.code) ? '1' : '0.4'"
                    style="width:34px;height:34px;background:var(--color-bg);border:1.5px solid var(--color-border);color:var(--color-text)">−</button>
            <span class="text-center font-bold" style="width:28px"
                  [style.color]="count(g.code) ? 'var(--color-text)' : 'var(--color-muted)'">{{ count(g.code) }}</span>
            <button (click)="change.emit({ kind: g.code, count: count(g.code) + 1 })"
                    class="flex items-center justify-center rounded-full font-bold text-white"
                    style="width:34px;height:34px;background:var(--color-gold)">＋</button>
          </div>
        }
      </div>
    </div>
  `,
})
export class GlasswareStepper {
  @Input() order: Order | null = null;
  @Output() change = new EventEmitter<{ kind: string; count: number }>();

  kinds = GLASS_KINDS;
  count(code: string): number {
    return this.order?.glassware?.find(g => g.kind === code)?.count ?? 0;
  }
}