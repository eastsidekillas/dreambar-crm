import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { MenuItem, MenuCategory, MenuByCategory } from '../../../core/models';

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-4">

      <!-- Header -->
      <div class="flex items-center justify-between gap-2 flex-wrap">
        <h1 class="text-xl font-bold">🍽 Меню</h1>
        <div class="flex items-center gap-2">
          <button (click)="exportCsv()" class="btn btn-outline btn-sm">
            📥 Экспорт CSV
          </button>
          <button (click)="toggleAdd()" class="btn btn-primary">
            {{ showAdd() ? '✕ Отмена' : '+ Добавить позицию' }}
          </button>
        </div>
      </div>

      <!-- Add form -->
      @if (showAdd()) {
        <div class="card" style="border-color:var(--color-gold)">
          <h3 class="font-semibold mb-4">Новая позиция меню</h3>
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="col-span-2">
              <label class="section-title block mb-1">Название</label>
              <input [(ngModel)]="newItem.name" class="field" placeholder="Например: Водка TUNDRA"/>
            </div>
            <div>
              <label class="section-title block mb-1">Категория</label>
              <select [(ngModel)]="newItem.category" class="field">
                @for (c of categories(); track c.id) {
                  <option [value]="c.id">{{ c.name }}</option>
                }
              </select>
            </div>
            <div>
              <label class="section-title block mb-1">Цена ₽</label>
              <input [(ngModel)]="newItem.price" type="number" min="0" class="field" placeholder="0"/>
            </div>
            <div>
              <label class="section-title block mb-1">Объём / вес</label>
              <input [(ngModel)]="newItem.volume" class="field" placeholder="50 мл, 100 г..."/>
            </div>
            <div>
              <label class="section-title block mb-1">Состав / описание</label>
              <input [(ngModel)]="newItem.description" class="field" placeholder="Ингредиенты..."/>
            </div>
          </div>
          <button (click)="saveItem()" class="btn btn-primary">Сохранить</button>
        </div>
      }

      <!-- Categories -->
      @for (cat of menuByCategory(); track cat.id) {
        <div class="card card-sm">
          <div class="flex items-center justify-between mb-2 px-1">
            <div class="flex items-center gap-2">
              <span class="text-base">{{ catIcon(cat.type) }}</span>
              <span class="font-semibold text-sm">{{ cat.name }}</span>
              <span class="badge badge-gray">{{ cat.items.length }}</span>
            </div>
          </div>

          @for (item of cat.items; track item.id) {

            <!-- Edit mode -->
            @if (editId() === item.id) {
              <div class="py-3 px-1 space-y-2" style="border-top:1px solid var(--color-border)">
                <div class="grid grid-cols-2 gap-2">
                  <div class="col-span-2">
                    <label class="section-title block mb-0.5 text-xs">Название</label>
                    <input [(ngModel)]="edit.name" class="field" style="height:34px"/>
                  </div>
                  <div>
                    <label class="section-title block mb-0.5 text-xs">Категория</label>
                    <select [(ngModel)]="edit.category" class="field" style="height:34px">
                      @for (c of categories(); track c.id) {
                        <option [value]="c.id">{{ c.name }}</option>
                      }
                    </select>
                  </div>
                  <div>
                    <label class="section-title block mb-0.5 text-xs">Цена ₽</label>
                    <input [(ngModel)]="edit.price" type="number" min="0" class="field" style="height:34px"/>
                  </div>
                  <div>
                    <label class="section-title block mb-0.5 text-xs">Объём / вес</label>
                    <input [(ngModel)]="edit.volume" class="field" style="height:34px" placeholder="50 мл..."/>
                  </div>
                  <div>
                    <label class="section-title block mb-0.5 text-xs">Состав / описание</label>
                    <input [(ngModel)]="edit.description" class="field" style="height:34px" placeholder="..."/>
                  </div>
                </div>
                <div class="flex items-center gap-2 pt-1">
                  <button (click)="saveEdit(item)" class="btn btn-primary btn-sm">✓ Сохранить</button>
                  <button (click)="editId.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
                  <label class="flex items-center gap-1.5 text-sm ml-auto cursor-pointer"
                         style="color:var(--color-muted)">
                    <input type="checkbox" [(ngModel)]="edit.is_active" class="w-4 h-4"/>
                    Активна
                  </label>
                </div>
              </div>

            <!-- View mode -->
            } @else {
              <div class="flex items-center gap-2 py-2 px-1 group"
                   style="border-top:1px solid var(--color-border)"
                   [style.opacity]="item.is_active ? '1' : '0.45'">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm font-medium">{{ item.name }}</span>
                    @if (item.volume) {
                      <span class="text-xs" style="color:var(--color-muted)">{{ item.volume }}</span>
                    }
                    @if (!item.is_active) {
                      <span class="badge badge-gray text-xs">скрыта</span>
                    }
                  </div>
                  @if (item.description) {
                    <p class="text-xs" style="color:var(--color-light);font-style:italic">{{ item.description }}</p>
                  }
                </div>
                <span class="font-bold text-sm shrink-0" style="color:var(--color-gold-hover)">
                  {{ item.price | number:'1.0-0' }} ₽
                </span>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button (click)="startEdit(item)" class="btn btn-ghost btn-sm">✏</button>
                  <button (click)="toggleActive(item)" class="btn btn-sm"
                          [style]="item.is_active
                            ? 'background:var(--color-red-bg);color:var(--color-red)'
                            : 'background:var(--color-green-bg,#14532d);color:#4ade80'">
                    {{ item.is_active ? '🙈 Скрыть' : '👁 Показать' }}
                  </button>
                </div>
              </div>
            }
          }
        </div>
      }

    </div>
  `
})
export class MenuManagementComponent implements OnInit {
  menuByCategory = signal<MenuByCategory[]>([]);
  categories     = signal<MenuCategory[]>([]);
  showAdd        = signal(false);
  editId         = signal<number | null>(null);

  edit: { name: string; price: number; volume: string; description: string; category: number; is_active: boolean } = {
    name: '', price: 0, volume: '', description: '', category: 0, is_active: true
  };

  newItem: Partial<MenuItem> = { name: '', volume: '', description: '', price: 0 };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.load();
    this.api.getMenuCategories().subscribe(c => {
      this.categories.set(c);
      if (c.length) this.newItem.category = c[0].id;
    });
  }

  load() { this.api.getMenuByCategory().subscribe(d => this.menuByCategory.set(d)); }

  toggleAdd() {
    this.showAdd.update(v => !v);
    if (this.showAdd()) this.editId.set(null);
  }

  saveItem() {
    if (!this.newItem.name || !this.newItem.category) return;
    this.api.createMenuItem(this.newItem).subscribe(() => {
      this.showAdd.set(false);
      this.newItem = { name: '', volume: '', description: '', price: 0, category: this.categories()[0]?.id };
      this.load();
    });
  }

  startEdit(item: MenuItem) {
    this.showAdd.set(false);
    this.editId.set(item.id);
    this.edit = {
      name:        item.name,
      price:       item.price,
      volume:      item.volume || '',
      description: item.description || '',
      category:    item.category,
      is_active:   item.is_active,
    };
  }

  saveEdit(item: MenuItem) {
    this.api.updateMenuItem(item.id, {
      name:        this.edit.name,
      price:       this.edit.price,
      volume:      this.edit.volume,
      description: this.edit.description,
      category:    this.edit.category,
      is_active:   this.edit.is_active,
    }).subscribe(() => { this.editId.set(null); this.load(); });
  }

  toggleActive(item: MenuItem) {
    const msg = item.is_active
      ? `Скрыть "${item.name}" из меню?`
      : `Показать "${item.name}" в меню?`;
    if (!confirm(msg)) return;
    this.api.updateMenuItem(item.id, { is_active: !item.is_active }).subscribe(() => this.load());
  }

  exportCsv() {
    const rows: string[][] = [['Категория', 'Тип', 'Название', 'Объём/вес', 'Описание', 'Цена', 'Активна']];
    for (const cat of this.menuByCategory()) {
      for (const item of cat.items) {
        rows.push([
          cat.name,
          cat.type,
          item.name,
          item.volume || '',
          item.description || '',
          String(item.price),
          item.is_active ? 'Да' : 'Нет',
        ]);
      }
    }
    const csv = '﻿' + rows.map(r => r.map(v => `"${v.replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'menu_' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
  }

  catIcon(t: string) { return t === 'bar' ? '🍹' : t === 'kitchen' ? '🍽' : '💨'; }
}