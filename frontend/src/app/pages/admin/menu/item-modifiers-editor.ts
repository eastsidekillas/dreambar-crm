import { Component, Input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideX } from '@lucide/angular';
import { MenuApi } from '../../../entities/menu';
import { MenuItemModifierGroup, ModifierGroup } from '../../../core/models';

/** Привязка групп модификаторов к позиции меню (внутри редактора позиции).
 * Самодостаточный: грузит и правит привязки сам. */
@Component({
  selector: 'item-modifiers-editor',
  standalone: true,
  imports: [CommonModule, LucideX],
  template: `
    <div>
      <label class="block text-xs font-semibold mb-1" style="color:var(--color-muted)">Модификаторы</label>

      @if (attached().length) {
        <div class="flex flex-wrap gap-1.5 mb-1.5">
          @for (link of attached(); track link.id) {
            <span class="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style="background:var(--color-gold-light);color:var(--color-gold-hover);border:1px solid var(--color-gold-mid)">
              {{ link.modifier_group_name }}
              @if (link.is_required) { <span style="color:var(--color-red)">*</span> }
              <button (click)="remove(link)" [disabled]="busy()" title="Убрать"
                      class="flex items-center" style="color:var(--color-muted)">
                <svg lucideX [size]="12"></svg>
              </button>
            </span>
          }
        </div>
      } @else {
        <p class="text-xs mb-1.5" style="color:var(--color-light)">Группы не привязаны</p>
      }

      @if (available().length) {
        <select [value]="''" (change)="add($any($event.target).value); $any($event.target).value=''"
                [disabled]="busy()" class="field" style="height:30px;font-size:12px">
          <option value="">+ Добавить группу…</option>
          @for (g of available(); track g.id) {
            <option [value]="g.id">{{ g.name }}{{ g.is_required ? ' (обязат.)' : '' }}</option>
          }
        </select>
      } @else if (!attached().length) {
        <p class="text-xs" style="color:var(--color-light)">Сначала создайте группы в разделе «Модификаторы».</p>
      }
    </div>
  `,
})
export class ItemModifiersEditor {
  private api = inject(MenuApi);

  @Input({ required: true }) set itemId(v: number) { this._id = v; this.load(); }
  private _id = 0;

  attached  = signal<MenuItemModifierGroup[]>([]);
  allGroups = signal<ModifierGroup[]>([]);
  busy      = signal(false);

  /** Группы, ещё не привязанные к позиции (для выпадашки). */
  available = computed(() => {
    const used = new Set(this.attached().map(l => l.modifier_group));
    return this.allGroups().filter(g => g.is_active && !used.has(g.id));
  });

  private load() {
    this.api.getItemModifierGroups(this._id).subscribe({ next: l => this.attached.set(l), error: () => {} });
    if (!this.allGroups().length) {
      this.api.getModifierGroups().subscribe({ next: g => this.allGroups.set(g), error: () => {} });
    }
  }

  add(groupId: string) {
    const id = Number(groupId);
    if (!id || this.busy()) return;
    this.busy.set(true);
    this.api.assignModifierGroup(this._id, id).subscribe({
      next: () => { this.busy.set(false); this.load(); },
      error: () => this.busy.set(false),
    });
  }

  remove(link: MenuItemModifierGroup) {
    if (this.busy()) return;
    this.busy.set(true);
    this.api.removeModifierGroup(link.id).subscribe({
      next: () => { this.busy.set(false); this.attached.update(a => a.filter(x => x.id !== link.id)); },
      error: () => this.busy.set(false),
    });
  }
}