import { NgTemplateOutlet } from '@angular/common';
import { Component, ContentChild, Input, TemplateRef } from '@angular/core';

export interface BdTableColumn {
  label: string;
  align?: 'left' | 'right';
  /** Колонка скрыта на узких экранах и появляется начиная с брейкпоинта */
  visibleFrom?: 'sm' | 'md' | 'lg';
}

const VISIBLE_FROM: Record<string, string> = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
};

/**
 * Переиспользуемая таблица: карточка + шапка из конфига колонок.
 * Строки задаются ng-template (контекст: $implicit — строка, index/first/last).
 * Ячейки строк должны повторять align/visibleFrom своих колонок.
 * <tfoot> можно спроецировать после ng-template.
 *
 * <bd-table [columns]="cols" [rows]="rows()">
 *   <ng-template let-row>
 *     <tr>...</tr>
 *   </ng-template>
 * </bd-table>
 */
@Component({
  selector: 'bd-table',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
<div class="card p-0 overflow-hidden">
  <table class="w-full text-sm">
    <thead>
      <tr style="background:var(--color-bg);border-bottom:1px solid var(--color-border)">
        @for (col of columns; track $index) {
          <th [class]="thClass(col, $first)">{{ col.label }}</th>
        }
      </tr>
    </thead>
    <tbody>
      @for (row of rows; track trackOf($index, row)) {
        <ng-container [ngTemplateOutlet]="rowTpl"
                      [ngTemplateOutletContext]="{ $implicit: row, index: $index, first: $first, last: $last }" />
      }
    </tbody>
    <ng-content />
  </table>
</div>
  `,
})
export class BdTableComponent<T = unknown> {
  @Input({ required: true }) columns: BdTableColumn[] = [];
  @Input({ required: true }) rows: T[] = [];
  /** Поле строки для track в @for (по умолчанию id) */
  @Input() trackField = 'id';

  @ContentChild(TemplateRef) rowTpl!: TemplateRef<unknown>;

  thClass(col: BdTableColumn, first: boolean): string {
    const cls = [
      'py-2.5 font-semibold section-title',
      first ? 'px-4' : 'px-3',
      col.align === 'right' ? 'text-right' : 'text-left',
    ];
    if (col.visibleFrom) cls.push(VISIBLE_FROM[col.visibleFrom]);
    return cls.join(' ');
  }

  trackOf(index: number, row: T): unknown {
    return (row as Record<string, unknown> | null)?.[this.trackField] ?? index;
  }
}