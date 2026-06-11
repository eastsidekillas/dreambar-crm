import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuApi } from '../../../entities/menu';
import { ModifierGroup, Modifier } from '../../../core/models';
import { LucideWrench, LucidePencil, LucideTrash2, LucideEye, LucideEyeOff } from '@lucide/angular';

@Component({
  selector: 'app-modifiers',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideWrench, LucidePencil, LucideTrash2, LucideEye, LucideEyeOff],
  template: `
<div class="space-y-4">

  <div class="flex items-center justify-between flex-wrap gap-3">
    <div>
      <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideWrench [size]="20"></svg> Модификаторы</h1>
      <p class="text-xs mt-0.5" style="color:var(--color-muted)">
        Группы опций для позиций меню: лёд, сиропы, соусы, специи
      </p>
    </div>
    <button (click)="startAddGroup()" class="btn btn-primary btn-sm">+ Новая группа</button>
  </div>

  <!-- Add/edit group form -->
  @if (groupForm()) {
    <div class="card" style="border-color:var(--color-gold)">
      <p class="font-semibold text-sm mb-3">
        {{ groupForm()!.id ? 'Редактировать группу' : 'Новая группа модификаторов' }}
      </p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <div>
          <label class="section-title text-xs mb-1 block">Название *</label>
          <input [(ngModel)]="groupForm()!.name" class="field w-full" placeholder="Например: Объём льда">
        </div>
        <div>
          <label class="section-title text-xs mb-1 block">Макс. выборов (0 = без лимита)</label>
          <input type="number" [(ngModel)]="groupForm()!.max_selections" min="0" class="field w-full">
        </div>
      </div>
      <div class="flex items-center gap-4 mb-4">
        <label class="flex items-center gap-2 cursor-pointer text-sm">
          <input type="checkbox" [(ngModel)]="groupForm()!.is_required">
          Обязательный выбор
        </label>
      </div>
      <div class="flex gap-2">
        <button (click)="saveGroup()" class="btn btn-primary btn-sm">Сохранить</button>
        <button (click)="groupForm.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
      </div>
    </div>
  }

  <!-- Groups list -->
  @if (!groups().length && !loading()) {
    <div class="card text-center py-12">
      <svg lucideWrench [size]="48" class="mb-2 mx-auto" style="color:var(--color-muted)"></svg>
      <p style="color:var(--color-muted)">Групп модификаторов пока нет.</p>
      <p class="text-xs mt-1" style="color:var(--color-muted)">
        Пример: «Объём льда» (мало / стандарт / много), «Сироп» (ванильный, карамельный, …)
      </p>
    </div>
  }

  <div class="space-y-3">
    @for (group of groups(); track group.id) {
      <div class="card overflow-hidden"
           [style.opacity]="group.is_active ? 1 : 0.6">

        <!-- Group header -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex-1">
            <div class="flex items-center gap-2">
              <p class="font-semibold text-sm">{{ group.name }}</p>
              @if (group.is_required) {
                <span class="text-xs px-1.5 py-0.5 rounded"
                      style="background:#fee2e2;color:#dc2626">Обязательный</span>
              }
              @if (group.max_selections === 1) {
                <span class="text-xs" style="color:var(--color-muted)">один вариант</span>
              } @else if (group.max_selections === 0) {
                <span class="text-xs" style="color:var(--color-muted)">множественный</span>
              } @else {
                <span class="text-xs" style="color:var(--color-muted)">до {{ group.max_selections }}</span>
              }
            </div>
            <p class="text-xs mt-0.5" style="color:var(--color-muted)">
              {{ group.modifiers.length }} вариантов
            </p>
          </div>

          <div class="flex items-center gap-1.5">
            <button (click)="startEditGroup(group)" class="btn btn-ghost btn-sm"><svg lucidePencil [size]="14"></svg></button>
            <button (click)="toggleGroup(group)" class="btn btn-ghost btn-sm"
                    [title]="group.is_active ? 'Скрыть' : 'Показать'">
              @if (group.is_active) {
                <svg lucideEye [size]="14"></svg>
              } @else {
                <svg lucideEyeOff [size]="14"></svg>
              }
            </button>
            <button (click)="expandGroup(group.id)" class="btn btn-ghost btn-sm">
              {{ expandedGroupId() === group.id ? '▲' : '▼' }}
            </button>
          </div>
        </div>

        <!-- Modifiers -->
        @if (expandedGroupId() === group.id) {
          <div class="mt-4 pt-4" style="border-top:1px solid var(--color-border)">

            <!-- Modifier list -->
            @if (group.modifiers.length) {
              <div class="space-y-1.5 mb-3">
                @for (mod of group.modifiers; track mod.id) {
                  <div class="flex items-center gap-2 px-3 py-2 rounded-lg"
                       style="background:var(--color-surface2)">
                    <span class="flex-1 text-sm">{{ mod.name }}</span>
                    @if (mod.price_delta > 0) {
                      <span class="text-xs font-medium" style="color:#16a34a">+{{ mod.price_delta }} ₽</span>
                    } @else {
                      <span class="text-xs" style="color:var(--color-muted)">бесплатно</span>
                    }
                    @if (!mod.is_active) {
                      <span class="text-xs" style="color:var(--color-muted)">(скрыт)</span>
                    }
                    <button (click)="startEditModifier(group, mod)" class="btn btn-ghost btn-sm"
                            style="padding:2px 6px"><svg lucidePencil [size]="12"></svg></button>
                    <button (click)="deleteModifier(group, mod)" class="btn btn-ghost btn-sm"
                            style="padding:2px 6px;color:#dc2626"><svg lucideTrash2 [size]="12"></svg></button>
                  </div>
                }
              </div>
            }

            <!-- Add/edit modifier inline form -->
            @if (modifierForm()?.groupId === group.id) {
              <div class="rounded-xl p-3 mb-3" style="border:1px solid var(--color-gold)">
                <p class="section-title text-xs mb-2">
                  {{ modifierForm()!.id ? 'Редактировать вариант' : 'Новый вариант' }}
                </p>
                <div class="grid grid-cols-2 gap-2 mb-2">
                  <input [(ngModel)]="modifierForm()!.name" class="field" placeholder="Название">
                  <div class="flex items-center gap-1">
                    <input type="number" [(ngModel)]="modifierForm()!.price_delta" min="0"
                           class="field flex-1" placeholder="Доп. цена" step="10">
                    <span class="text-sm" style="color:var(--color-muted)">₽</span>
                  </div>
                </div>
                <div class="flex gap-2">
                  <button (click)="saveModifier()" class="btn btn-primary btn-sm">Сохранить</button>
                  <button (click)="modifierForm.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
                </div>
              </div>
            } @else {
              <button (click)="startAddModifier(group)" class="btn btn-ghost btn-sm text-xs">
                + Добавить вариант
              </button>
            }

          </div>
        }

      </div>
    }
  </div>

</div>
  `,
})
export class ModifiersPage implements OnInit {
  groups          = signal<ModifierGroup[]>([]);
  loading         = signal(false);
  expandedGroupId = signal<number | null>(null);

  groupForm = signal<{
    id?: number; name: string; is_required: boolean; max_selections: number;
  } | null>(null);

  modifierForm = signal<{
    id?: number; groupId: number; name: string; price_delta: number; is_active: boolean;
  } | null>(null);

  constructor(private menuApi: MenuApi) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.menuApi.getModifierGroups().subscribe(g => { this.groups.set(g); this.loading.set(false); });
  }

  // ── Groups ────────────────────────────────────────────────────────
  startAddGroup() {
    this.groupForm.set({ name: '', is_required: false, max_selections: 1 });
  }

  startEditGroup(g: ModifierGroup) {
    this.groupForm.set({ id: g.id, name: g.name, is_required: g.is_required, max_selections: g.max_selections });
  }

  saveGroup() {
    const f = this.groupForm();
    if (!f || !f.name.trim()) return;
    const data = { name: f.name.trim(), is_required: f.is_required, max_selections: f.max_selections };
    const obs = f.id
      ? this.menuApi.updateModifierGroup(f.id, data)
      : this.menuApi.createModifierGroup(data);
    obs.subscribe(() => { this.groupForm.set(null); this.load(); });
  }

  toggleGroup(g: ModifierGroup) {
    this.menuApi.updateModifierGroup(g.id, { is_active: !g.is_active }).subscribe(() => this.load());
  }

  expandGroup(id: number) {
    this.expandedGroupId.set(this.expandedGroupId() === id ? null : id);
    this.modifierForm.set(null);
  }

  // ── Modifiers ─────────────────────────────────────────────────────
  startAddModifier(g: ModifierGroup) {
    this.modifierForm.set({ groupId: g.id, name: '', price_delta: 0, is_active: true });
  }

  startEditModifier(g: ModifierGroup, m: Modifier) {
    this.modifierForm.set({ id: m.id, groupId: g.id, name: m.name, price_delta: Number(m.price_delta), is_active: m.is_active });
  }

  saveModifier() {
    const f = this.modifierForm();
    if (!f || !f.name.trim()) return;
    const data = { group: f.groupId, name: f.name.trim(), price_delta: f.price_delta, is_active: f.is_active };
    const obs = f.id ? this.menuApi.updateModifier(f.id, data) : this.menuApi.createModifier(data);
    obs.subscribe(() => { this.modifierForm.set(null); this.load(); });
  }

  deleteModifier(g: ModifierGroup, m: Modifier) {
    if (!confirm(`Удалить «${m.name}»?`)) return;
    this.menuApi.deleteModifier(m.id).subscribe(() => this.load());
  }
}