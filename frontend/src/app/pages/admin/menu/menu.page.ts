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
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">🍽 Меню</h1>
        <button (click)="showAdd.set(!showAdd())" class="btn btn-primary">
          {{ showAdd() ? '✕ Отмена' : '+ Добавить позицию' }}
        </button>
      </div>

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
              <input [(ngModel)]="newItem.price" type="number" class="field" placeholder="0"/>
            </div>
            <div>
              <label class="section-title block mb-1">Объём / вес</label>
              <input [(ngModel)]="newItem.volume" class="field" placeholder="50 мл, 100 г..."/>
            </div>
            <div>
              <label class="section-title block mb-1">Состав (для коктейлей)</label>
              <input [(ngModel)]="newItem.description" class="field" placeholder="Ингредиенты..."/>
            </div>
          </div>
          <button (click)="saveItem()" class="btn btn-primary">Сохранить</button>
        </div>
      }

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
            @if (editId() === item.id) {
              <div class="flex items-center gap-2 py-2 px-1" style="border-top:1px solid var(--color-border)">
                <input [(ngModel)]="editName" class="field flex-1" style="height:36px"/>
                <input [(ngModel)]="editPrice" type="number" class="field" style="width:80px;height:36px"/>
                <button (click)="saveEdit(item)" class="btn btn-primary btn-sm">✓</button>
                <button (click)="editId.set(null)" class="btn btn-ghost btn-sm">✕</button>
              </div>
            } @else {
              <div class="flex items-center gap-2 py-2 px-1 group"
                   style="border-top:1px solid var(--color-border)">
                <div class="flex-1 min-w-0">
                  <span class="text-sm font-medium">{{ item.name }}</span>
                  @if (item.volume) {
                    <span class="text-xs ml-1.5" style="color:var(--color-muted)">{{ item.volume }}</span>
                  }
                  @if (item.description) {
                    <p class="text-xs" style="color:var(--color-light);font-style:italic">{{ item.description }}</p>
                  }
                </div>
                <span class="font-bold text-sm" style="color:var(--color-gold-hover)">{{ item.price | number:'1.0-0' }} ₽</span>
                <div class="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button (click)="startEdit(item)" class="btn btn-ghost btn-sm">✏</button>
                  <button (click)="deleteItem(item)" class="btn btn-sm" style="background:var(--color-red-bg);color:var(--color-red)">✕</button>
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
  categories = signal<MenuCategory[]>([]);
  showAdd = signal(false);
  editId = signal<number | null>(null);
  editName = ''; editPrice = 0;
  newItem: Partial<MenuItem> = { name: '', volume: '', description: '', price: 0 };

  constructor(private api: ApiService) {}
  ngOnInit() {
    this.load();
    this.api.getMenuCategories().subscribe(c => { this.categories.set(c); if (c.length) this.newItem.category = c[0].id; });
  }
  load() { this.api.getMenuByCategory().subscribe(d => this.menuByCategory.set(d)); }
  saveItem() {
    if (!this.newItem.name || !this.newItem.category) return;
    this.api.createMenuItem(this.newItem).subscribe(() => { this.showAdd.set(false); this.newItem = { name: '', volume: '', description: '', price: 0, category: this.categories()[0]?.id }; this.load(); });
  }
  startEdit(item: MenuItem) { this.editId.set(item.id); this.editName = item.name; this.editPrice = item.price; }
  saveEdit(item: MenuItem) { this.api.updateMenuItem(item.id, { name: this.editName, price: this.editPrice }).subscribe(() => { this.editId.set(null); this.load(); }); }
  deleteItem(item: MenuItem) { if (!confirm('Скрыть "' + item.name + '" из меню?')) return; this.api.updateMenuItem(item.id, { is_active: false }).subscribe(() => this.load()); }
  catIcon(t: string) { return t === 'bar' ? '🍹' : t === 'kitchen' ? '🍽' : '💨'; }
}
