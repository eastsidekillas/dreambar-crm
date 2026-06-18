import { Component, Input, Output, EventEmitter, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideCheck } from '@lucide/angular';
import { MenuItem, MenuItemModifierGroup, Modifier } from '../../../core/models';
import { BdBottomSheetComponent } from '../../../shared/ui';

/** Шторка добавления позиции с модификаторами (группы настраиваются в админке).
 * Презентационная: подтверждение отдаёт (add), запрос ведёт OrderPage. */
@Component({
  selector: 'add-item-sheet',
  standalone: true,
  imports: [CommonModule, LucideCheck, BdBottomSheetComponent],
  template: `
    <bd-bottom-sheet [title]="item.name" maxHeight="88dvh" (closed)="closed.emit()">
      <div class="px-4 pt-1 pb-3">
        <p class="text-sm font-bold mb-3" style="color:var(--color-gold-hover)">{{ item.price | number:'1.0-0' }} ₽</p>

        @for (g of groups; track g.id) {
          <div class="mb-3">
            <div class="flex items-center gap-2 mb-1.5">
              <span class="text-xs font-semibold" style="color:var(--color-muted)">{{ g.modifier_group_name }}</span>
              @if (g.is_required) {
                <span class="text-xs font-semibold px-1.5 py-0.5 rounded-full" style="background:var(--color-red-bg);color:var(--color-red)">обязательно</span>
              }
              @if (g.max_selections > 1) {
                <span class="text-xs" style="color:var(--color-light)">до {{ g.max_selections }}</span>
              }
            </div>
            <div class="space-y-1.5">
              @for (m of active(g); track m.id) {
                <button (click)="toggle(g, m)"
                        class="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm"
                        [style.background]="isSel(m.id) ? 'var(--color-gold-light)' : 'var(--color-surface)'"
                        [style.border]="'1.5px solid ' + (isSel(m.id) ? 'var(--color-gold-mid)' : 'var(--color-border)')">
                  <span class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                        [style]="isSel(m.id) ? 'background:var(--color-gold);color:white' : 'border:1.5px solid var(--color-border-mid)'">
                    @if (isSel(m.id)) { <svg lucideCheck [size]="13"></svg> }
                  </span>
                  <span class="flex-1">{{ m.name }}</span>
                  @if (+m.price_delta) {
                    <span class="font-semibold" style="color:var(--color-gold-hover)">{{ +m.price_delta > 0 ? '+' : '' }}{{ m.price_delta | number:'1.0-0' }} ₽</span>
                  }
                </button>
              }
            </div>
          </div>
        }

        <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">КОЛИЧЕСТВО</p>
        <div class="flex items-center justify-center gap-5">
          <button (click)="qty.set(qty() > 1 ? qty() - 1 : 1)"
                  class="flex items-center justify-center rounded-full font-bold"
                  style="width:44px;height:44px;background:var(--color-bg);border:1.5px solid var(--color-border);font-size:1.3rem">−</button>
          <span class="font-bold" style="font-size:1.8rem;min-width:44px;text-align:center">{{ qty() }}</span>
          <button (click)="qty.set(qty() + 1)"
                  class="flex items-center justify-center rounded-full font-bold text-white"
                  style="width:44px;height:44px;background:var(--color-gold);font-size:1.3rem">＋</button>
        </div>
      </div>

      <div sheet-footer class="px-4 pt-2 pb-4" style="border-top:1px solid var(--color-border)">
        <button (click)="emitAdd()" [disabled]="!canAdd() || saving"
                class="btn btn-primary btn-full" style="height:48px"
                [style.opacity]="!canAdd() ? '0.5' : '1'">
          {{ saving ? '...' : 'Добавить · ' + (total() | number:'1.0-0') + ' ₽' }}
        </button>
      </div>
    </bd-bottom-sheet>
  `,
})
export class AddItemSheet {
  @Input({ required: true }) item!: MenuItem;
  @Input() groups: MenuItemModifierGroup[] = [];
  @Input() saving = false;

  @Output() add    = new EventEmitter<{ quantity: number; modifierIds: number[] }>();
  @Output() closed = new EventEmitter<void>();

  qty = signal(1);
  private selected = signal<Set<number>>(new Set());

  active(g: MenuItemModifierGroup): Modifier[] { return g.modifiers.filter(m => m.is_active); }
  isSel(id: number): boolean { return this.selected().has(id); }

  toggle(g: MenuItemModifierGroup, m: Modifier) {
    const sel = new Set(this.selected());
    if (sel.has(m.id)) { sel.delete(m.id); this.selected.set(sel); return; }
    const groupIds = this.active(g).map(x => x.id);
    const inGroup = groupIds.filter(id => sel.has(id));
    if (g.max_selections === 1) {
      inGroup.forEach(id => sel.delete(id));     // одиночный выбор — заменяем
    } else if (g.max_selections > 0 && inGroup.length >= g.max_selections) {
      return;                                     // достигнут лимит группы
    }
    sel.add(m.id);
    this.selected.set(sel);
  }

  /** Все обязательные группы должны иметь хотя бы один выбор. */
  canAdd = computed(() => {
    const sel = this.selected();
    return this.groups.every(g => !g.is_required || this.active(g).some(m => sel.has(m.id)));
  });

  total = computed(() => {
    const sel = this.selected();
    const deltas = this.groups.flatMap(g => this.active(g)).filter(m => sel.has(m.id))
      .reduce((s, m) => s + +m.price_delta, 0);
    return (+this.item.price + deltas) * this.qty();
  });

  emitAdd() {
    if (!this.canAdd() || this.saving) return;
    this.add.emit({ quantity: this.qty(), modifierIds: [...this.selected()] });
  }
}