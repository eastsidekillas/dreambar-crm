import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { MenuItem, MenuCategory, MenuSection } from '../../../core/models';

const STATIONS: { value: string; label: string; icon: string }[] = [
  { value: 'bar',     label: 'Бар',    icon: '🍹' },
  { value: 'kitchen', label: 'Кухня',  icon: '🍽' },
  { value: 'hookah',  label: 'Кальян', icon: '💨' },
];

const stationIcon = (t: string) => STATIONS.find(s => s.value === t)?.icon ?? '📋';
const stationLabel = (t: string) => STATIONS.find(s => s.value === t)?.label ?? t;

interface SectionNode extends MenuSection {
  categories: CategoryNode[];
}
interface CategoryNode extends MenuCategory {
  items: MenuItem[];
}

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
<div class="space-y-3">

  <!-- ── Header ──────────────────────────────────────────────────── -->
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <div>
      <h1 class="text-xl font-bold">Меню</h1>
      <p class="text-xs mt-0.5" style="color:var(--color-muted)">
        {{ sections().length }} разд. · {{ categories().length }} кат. · {{ items().length }} позиций
        @if (hiddenCount() > 0) {
          · <span style="color:var(--color-muted)">{{ hiddenCount() }} скрыто</span>
        }
      </p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <!-- Search -->
      <div class="relative">
        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style="color:var(--color-muted)">🔍</span>
        <input [(ngModel)]="searchRaw"
               (ngModelChange)="onSearch($event)"
               class="field pl-7 pr-3"
               style="height:34px;width:200px"
               placeholder="Поиск позиции..."/>
        @if (searchRaw) {
          <button (click)="clearSearch()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                  style="color:var(--color-muted);background:none;border:none;cursor:pointer">✕</button>
        }
      </div>
      <!-- Show hidden toggle -->
      <button (click)="showHidden.set(!showHidden())"
              class="btn btn-sm"
              [style]="showHidden()
                ? 'background:var(--color-gold-light);color:var(--color-gold-hover);border:1px solid var(--color-gold-mid)'
                : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
        {{ showHidden() ? '👁 Все' : '👁 Скрытые' }}
      </button>
      <!-- Add section -->
      <button (click)="toggleAddSection()" class="btn btn-primary btn-sm">
        + Раздел
      </button>
    </div>
  </div>

  <!-- ── Add section form ─────────────────────────────────────────── -->
  @if (addingSection()) {
    <div class="card" style="border-color:var(--color-gold)">
      <p class="font-semibold text-sm mb-3">Новый раздел</p>
      <div class="grid grid-cols-2 gap-3 mb-3">
        <div class="col-span-2 sm:col-span-1">
          <label class="section-title block mb-1">Название *</label>
          <input [(ngModel)]="newSection.name" class="field" placeholder="Крепкий алкоголь"/>
        </div>
        <div>
          <label class="section-title block mb-1">Станция (принтер)</label>
          <select [(ngModel)]="newSection.station_type" class="field">
            @for (s of stations; track s.value) {
              <option [value]="s.value">{{ s.icon }} {{ s.label }}</option>
            }
          </select>
        </div>
        <div>
          <label class="section-title block mb-1">Иконка (эмодзи)</label>
          <input [(ngModel)]="newSection.icon" class="field" placeholder="🍷" maxlength="4"/>
        </div>
      </div>
      <div class="flex gap-2">
        <button (click)="saveSection()" class="btn btn-primary btn-sm">Сохранить</button>
        <button (click)="addingSection.set(false)" class="btn btn-ghost btn-sm">Отмена</button>
      </div>
    </div>
  }

  <!-- ── Tree ─────────────────────────────────────────────────────── -->
  @if (tree().length === 0 && !loading()) {
    <div class="card text-center py-12" style="color:var(--color-muted)">
      <span class="text-4xl block mb-3">🍽</span>
      <p>Разделы меню не созданы. Начните с кнопки «+ Раздел».</p>
    </div>
  }

  @if (searchRaw && filteredTotal() === 0) {
    <div class="card text-center py-8" style="color:var(--color-muted)">
      По запросу «{{ searchRaw }}» ничего не найдено
    </div>
  }

  @for (sec of tree(); track sec.id) {
    @if (!searchRaw || sec.categories.length > 0) {
      <div class="rounded-xl overflow-hidden"
           style="border:1px solid var(--color-border)">

        <!-- ── Section header ──────────────────────────────────── -->
        @if (editSectionId() === sec.id) {
          <div class="px-4 py-3" style="background:var(--color-gold-light);border-bottom:2px solid var(--color-gold)">
            <div class="grid grid-cols-2 gap-2 mb-2">
              <div class="col-span-2 sm:col-span-1">
                <label class="section-title block mb-1 text-xs">Название</label>
                <input [(ngModel)]="editSectionForm.name" class="field" style="height:30px"/>
              </div>
              <div>
                <label class="section-title block mb-1 text-xs">Станция</label>
                <select [(ngModel)]="editSectionForm.station_type" class="field" style="height:30px">
                  @for (s of stations; track s.value) {
                    <option [value]="s.value">{{ s.icon }} {{ s.label }}</option>
                  }
                </select>
              </div>
              <div>
                <label class="section-title block mb-1 text-xs">Иконка</label>
                <input [(ngModel)]="editSectionForm.icon" class="field" style="height:30px" maxlength="4"/>
              </div>
              <div class="flex items-end gap-2">
                <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" [(ngModel)]="editSectionForm.is_active" class="w-3.5 h-3.5"/>
                  Активен
                </label>
              </div>
            </div>
            <div class="flex gap-2 items-center">
              <button (click)="saveSectionEdit(sec)" class="btn btn-primary btn-sm">✓ Сохранить</button>
              <button (click)="editSectionId.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
              <button (click)="deleteSection(sec)"
                      class="btn btn-sm ml-auto"
                      style="background:#fee2e2;color:#dc2626;font-size:11px">
                🗑 Удалить раздел
              </button>
            </div>
          </div>

        } @else {
          <div class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
               style="background:#fafaf9"
               (click)="toggleSection(sec.id)">
            <span class="text-lg">{{ sec.icon || stationIcon(sec.station_type) }}</span>
            <span class="font-bold text-sm tracking-wide uppercase"
                  [style.color]="sec.is_active ? 'var(--color-text)' : 'var(--color-muted)'">
              {{ sec.name }}
            </span>
            <span class="text-xs px-2 py-0.5 rounded-full ml-1"
                  [style]="stationBadge(sec.station_type)">
              {{ stationLabel(sec.station_type) }}
            </span>
            @if (!sec.is_active) {
              <span class="badge badge-gray text-xs">скрыт</span>
            }
            <span class="text-xs ml-1" style="color:var(--color-muted)">
              {{ sectionItemCount(sec) }} позиций
            </span>
            <div class="ml-auto flex items-center gap-1" (click)="$event.stopPropagation()">
              <button (click)="startAddCategory(sec.id)"
                      class="btn btn-ghost btn-sm" style="font-size:11px">
                + Категорию
              </button>
              <button (click)="startEditSection(sec)"
                      class="btn btn-ghost btn-sm" style="font-size:11px">✏</button>
              <span class="text-sm ml-1 transition-transform"
                    [style.transform]="isSectionOpen(sec.id) ? 'rotate(90deg)' : ''"
                    style="color:var(--color-muted)">›</span>
            </div>
          </div>
        }

        <!-- ── Section body ────────────────────────────────────── -->
        @if (isSectionOpen(sec.id) || searchRaw) {

          <!-- Add category form -->
          @if (addingCategoryFor() === sec.id) {
            <div class="px-4 py-3" style="background:#fffbeb;border-top:1px solid var(--color-border)">
              <p class="font-semibold text-xs mb-2">Новая категория в «{{ sec.name }}»</p>
              <div class="flex gap-2 items-end flex-wrap">
                <div class="flex-1 min-w-[160px]">
                  <label class="section-title block mb-1 text-xs">Название *</label>
                  <input [(ngModel)]="newCategory.name" class="field" style="height:30px" placeholder="Водка"/>
                </div>
                <button (click)="saveCategory(sec.id)" class="btn btn-primary btn-sm">Сохранить</button>
                <button (click)="addingCategoryFor.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
              </div>
            </div>
          }

          <!-- Categories -->
          @for (cat of sec.categories; track cat.id) {
            @if (!searchRaw || cat.items.length > 0) {
              <div style="border-top:1px solid var(--color-border)">

                <!-- Category header -->
                @if (editCategoryId() === cat.id) {
                  <div class="px-4 py-2.5 flex items-center gap-2 flex-wrap"
                       style="background:var(--color-gold-light)">
                    <input [(ngModel)]="editCategoryForm.name" class="field"
                           style="height:28px;flex:1;min-width:120px"/>
                    <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input type="checkbox" [(ngModel)]="editCategoryForm.is_active" class="w-3.5 h-3.5"/>
                      Активна
                    </label>
                    <button (click)="saveCategoryEdit(cat)" class="btn btn-primary btn-sm">✓</button>
                    <button (click)="editCategoryId.set(null)" class="btn btn-ghost btn-sm">✕</button>
                    <button (click)="deleteCategory(cat)"
                            class="btn btn-sm"
                            style="background:#fee2e2;color:#dc2626;font-size:11px">🗑</button>
                  </div>

                } @else {
                  <div class="flex items-center gap-2 px-4 py-2.5 cursor-pointer select-none"
                       style="background:#f5f5f4"
                       (click)="toggleCategory(cat.id)">
                    <span class="text-sm font-semibold"
                          [style.color]="cat.is_active ? 'var(--color-text)' : 'var(--color-muted)'">
                      {{ cat.name }}
                    </span>
                    @if (!cat.is_active) {
                      <span class="badge badge-gray" style="font-size:9px">скрыта</span>
                    }
                    <span class="text-xs" style="color:var(--color-muted)">{{ cat.items.length }}</span>
                    <div class="ml-auto flex items-center gap-1" (click)="$event.stopPropagation()">
                      <button (click)="startAddItem(cat.id)"
                              class="btn btn-ghost btn-sm" style="font-size:11px">+ Позицию</button>
                      <button (click)="startEditCategory(cat)"
                              class="btn btn-ghost btn-sm" style="font-size:11px">✏</button>
                      <span class="text-xs ml-1 transition-transform"
                            [style.transform]="isCategoryOpen(cat.id) ? 'rotate(90deg)' : ''"
                            style="color:var(--color-muted)">›</span>
                    </div>
                  </div>
                }

                <!-- Items list -->
                @if (isCategoryOpen(cat.id) || searchRaw) {
                  @for (item of cat.items; track item.id) {

                    <!-- Item edit form -->
                    @if (editItemId() === item.id) {
                      <div class="px-4 py-3" style="background:var(--color-gold-light);border-top:1px solid var(--color-border)">
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                          <div class="col-span-2">
                            <label class="section-title block mb-0.5 text-xs">Название *</label>
                            <input [(ngModel)]="editItemForm.name" class="field" style="height:30px"/>
                          </div>
                          <div>
                            <label class="section-title block mb-0.5 text-xs">Объём / вес</label>
                            <input [(ngModel)]="editItemForm.volume" class="field" style="height:30px" placeholder="500 мл"/>
                          </div>
                          <div>
                            <label class="section-title block mb-0.5 text-xs">Цена ₽ *</label>
                            <input [(ngModel)]="editItemForm.price" type="number" min="0" class="field" style="height:30px"/>
                          </div>
                          <div>
                            <label class="section-title block mb-0.5 text-xs">Себестоимость ₽</label>
                            <input [(ngModel)]="editItemForm.cost_price" type="number" min="0" class="field" style="height:30px"/>
                          </div>
                          <div class="col-span-2 sm:col-span-3">
                            <label class="section-title block mb-0.5 text-xs">Состав / описание</label>
                            <input [(ngModel)]="editItemForm.description" class="field" style="height:30px" placeholder="Ингредиенты..."/>
                          </div>
                          <div>
                            <label class="section-title block mb-0.5 text-xs">Категория</label>
                            <select [(ngModel)]="editItemForm.category" class="field" style="height:30px">
                              @for (c of categories(); track c.id) {
                                <option [value]="c.id">{{ c.name }}</option>
                              }
                            </select>
                          </div>
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                          <button (click)="saveItemEdit(item)" class="btn btn-primary btn-sm">✓ Сохранить</button>
                          <button (click)="editItemId.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
                          <label class="flex items-center gap-1.5 text-xs cursor-pointer">
                            <input type="checkbox" [(ngModel)]="editItemForm.is_active" class="w-3.5 h-3.5"/>
                            Активна
                          </label>
                          <label class="flex items-center gap-1.5 text-xs cursor-pointer"
                                 style="color:#dc2626">
                            <input type="checkbox" [(ngModel)]="editItemForm.is_out_of_stock" class="w-3.5 h-3.5"/>
                            Нет в наличии
                          </label>
                          <button (click)="deleteItem(item)"
                                  class="btn btn-sm ml-auto"
                                  style="background:#fee2e2;color:#dc2626;font-size:11px">🗑 Удалить</button>
                        </div>
                      </div>

                    <!-- Item view row -->
                    } @else {
                      <div class="flex items-center gap-2 sm:gap-3 px-4 py-2 group"
                           style="border-top:1px solid #f0ebe0"
                           [style.opacity]="item.is_active ? '1' : '0.5'">
                        <!-- Status dot -->
                        <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                              [style.background]="itemDot(item)"></span>
                        <!-- Name + meta -->
                        <div class="flex-1 min-w-0">
                          <div class="flex items-baseline gap-1.5 flex-wrap">
                            <span class="text-sm font-medium leading-snug">{{ item.name }}</span>
                            @if (item.volume) {
                              <span class="text-xs" style="color:var(--color-muted)">{{ item.volume }}</span>
                            }
                            @if (item.is_out_of_stock) {
                              <span class="text-xs px-1.5 py-0.5 rounded"
                                    style="background:#fee2e2;color:#dc2626;font-size:9px">нет</span>
                            }
                            @if (!item.is_active) {
                              <span class="text-xs px-1.5 py-0.5 rounded"
                                    style="background:var(--color-bg);color:var(--color-muted);font-size:9px">скрыта</span>
                            }
                          </div>
                          @if (item.description) {
                            <p class="text-xs truncate" style="color:var(--color-muted)">{{ item.description }}</p>
                          }
                        </div>
                        <!-- Price -->
                        <div class="text-right shrink-0">
                          <span class="font-bold text-sm" style="color:var(--color-gold-hover)">
                            {{ item.price | number:'1.0-0' }} ₽
                          </span>
                          @if (item.cost_price > 0) {
                            <p class="text-xs" style="color:var(--color-muted)">
                              с/с {{ item.cost_price | number:'1.0-0' }} ₽
                            </p>
                          }
                        </div>
                        <!-- Actions (visible on hover) -->
                        <div class="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button (click)="startEditItem(item)"
                                  class="btn btn-ghost btn-sm" style="font-size:11px">✏</button>
                          <button (click)="quickToggle(item)"
                                  class="btn btn-sm"
                                  [style]="item.is_active
                                    ? 'background:#fee2e2;color:#dc2626;font-size:11px'
                                    : 'background:#dcfce7;color:#16a34a;font-size:11px'">
                            {{ item.is_active ? 'Скрыть' : 'Показать' }}
                          </button>
                        </div>
                      </div>
                    }
                  }

                  <!-- Add item form inline -->
                  @if (addingItemFor() === cat.id) {
                    <div class="px-4 py-3"
                         style="border-top:1px solid var(--color-border);background:#fffbeb">
                      <p class="font-semibold text-xs mb-2">Новая позиция в «{{ cat.name }}»</p>
                      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
                        <div class="col-span-2">
                          <label class="section-title block mb-0.5 text-xs">Название *</label>
                          <input [(ngModel)]="newItem.name" class="field" style="height:30px"
                                 placeholder="Водка TUNDRA" #newItemName/>
                        </div>
                        <div>
                          <label class="section-title block mb-0.5 text-xs">Объём / вес</label>
                          <input [(ngModel)]="newItem.volume" class="field" style="height:30px" placeholder="500 мл"/>
                        </div>
                        <div>
                          <label class="section-title block mb-0.5 text-xs">Цена ₽ *</label>
                          <input [(ngModel)]="newItem.price" type="number" min="0" class="field" style="height:30px"/>
                        </div>
                        <div>
                          <label class="section-title block mb-0.5 text-xs">Себестоимость ₽</label>
                          <input [(ngModel)]="newItem.cost_price" type="number" min="0" class="field" style="height:30px"/>
                        </div>
                        <div class="col-span-2 sm:col-span-3">
                          <label class="section-title block mb-0.5 text-xs">Состав / описание</label>
                          <input [(ngModel)]="newItem.description" class="field" style="height:30px" placeholder="Ингредиенты..."/>
                        </div>
                      </div>
                      <div class="flex gap-2">
                        <button (click)="saveItem(cat.id)" class="btn btn-primary btn-sm">Сохранить</button>
                        <button (click)="addingItemFor.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
                      </div>
                    </div>

                  } @else if (!searchRaw) {
                    <div class="px-4 py-2" style="border-top:1px solid #f0ebe0">
                      <button (click)="startAddItem(cat.id)"
                              class="text-xs font-medium"
                              style="color:var(--color-gold-hover);background:none;border:none;cursor:pointer;padding:0">
                        + Добавить позицию
                      </button>
                    </div>
                  }
                }

              </div>
            }
          }

          @if (!sec.categories.length && !searchRaw) {
            <div class="px-4 py-4 text-center text-sm" style="color:var(--color-muted);border-top:1px solid var(--color-border)">
              В этом разделе нет категорий
            </div>
          }
        }

      </div>
    }
  }

</div>
  `,
})
export class MenuManagementComponent implements OnInit {
  sections   = signal<MenuSection[]>([]);
  categories = signal<MenuCategory[]>([]);
  items      = signal<MenuItem[]>([]);
  loading    = signal(true);

  showHidden = signal(false);
  searchRaw  = '';
  search     = signal('');

  stations = STATIONS;
  stationIcon  = stationIcon;
  stationLabel = stationLabel;

  // ── Expand state ─────────────────────────────────────────────────
  expandedSections   = signal<Set<number>>(new Set());
  expandedCategories = signal<Set<number>>(new Set());

  isSectionOpen(id: number)  { return this.expandedSections().has(id); }
  isCategoryOpen(id: number) { return this.expandedCategories().has(id); }

  toggleSection(id: number) {
    const s = new Set(this.expandedSections());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedSections.set(s);
  }
  toggleCategory(id: number) {
    const s = new Set(this.expandedCategories());
    s.has(id) ? s.delete(id) : s.add(id);
    this.expandedCategories.set(s);
  }

  // ── Tree ──────────────────────────────────────────────────────────
  tree = computed<SectionNode[]>(() => {
    const term = this.search().toLowerCase();
    const showAll = this.showHidden();
    const allCats = this.categories();
    const allItems = this.items();

    return this.sections()
      .filter(s => showAll || s.is_active)
      .map(sec => {
        const cats = allCats
          .filter(c => c.section === sec.id && (showAll || c.is_active))
          .map(cat => {
            let its = allItems.filter(i => i.category === cat.id && (showAll || i.is_active));
            if (term) its = its.filter(i =>
              i.name.toLowerCase().includes(term) ||
              (i.description ?? '').toLowerCase().includes(term) ||
              (i.volume ?? '').toLowerCase().includes(term)
            );
            return { ...cat, items: its } as CategoryNode;
          })
          .filter(c => !term || c.items.length > 0);
        return { ...sec, categories: cats } as SectionNode;
      });
  });

  hiddenCount = computed(() =>
    this.items().filter(i => !i.is_active).length
  );

  filteredTotal = computed(() =>
    this.tree().reduce((s, sec) => s + sec.categories.reduce((cs, c) => cs + c.items.length, 0), 0)
  );

  sectionItemCount(sec: SectionNode): number {
    return sec.categories.reduce((s, cat) => s + cat.items.length, 0);
  }

  // ── Form state ────────────────────────────────────────────────────
  addingSection      = signal(false);
  editSectionId      = signal<number | null>(null);
  addingCategoryFor  = signal<number | null>(null);
  editCategoryId     = signal<number | null>(null);
  addingItemFor      = signal<number | null>(null);
  editItemId         = signal<number | null>(null);

  newSection:     Partial<MenuSection>  = { name: '', station_type: 'bar', icon: '' };
  editSectionForm: Partial<MenuSection> = {};
  newCategory:    Partial<MenuCategory> = { name: '' };
  editCategoryForm: Partial<MenuCategory> = {};
  newItem:   { name: string; price: number; volume: string; description: string; cost_price: number } =
             { name: '', price: 0, volume: '', description: '', cost_price: 0 };
  editItemForm: Partial<MenuItem> & { is_active: boolean; is_out_of_stock: boolean } =
               { name: '', price: 0, volume: '', description: '', cost_price: 0, category: 0, is_active: true, is_out_of_stock: false };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.loadAll();
  }

  loadAll() {
    this.loading.set(true);
    this.api.getMenuSections().subscribe(s => {
      this.sections.set(s);
      if (s.length) {
        const firstId = s[0].id;
        const ex = new Set(this.expandedSections());
        ex.add(firstId);
        this.expandedSections.set(ex);
      }
    });
    this.api.getMenuCategories().subscribe(c => this.categories.set(c));
    this.api.getMenuItems().subscribe(i => { this.items.set(i); this.loading.set(false); });
  }

  // ── Search ────────────────────────────────────────────────────────
  onSearch(val: string) {
    this.search.set(val.trim());
  }

  clearSearch() {
    this.searchRaw = '';
    this.search.set('');
  }

  // ── Section CRUD ──────────────────────────────────────────────────
  toggleAddSection() {
    this.addingSection.set(!this.addingSection());
    this.newSection = { name: '', station_type: 'bar', icon: '' };
  }

  saveSection() {
    if (!this.newSection.name) return;
    this.api.createMenuSection(this.newSection).subscribe(s => {
      this.sections.update(list => [...list, s]);
      const ex = new Set(this.expandedSections());
      ex.add(s.id);
      this.expandedSections.set(ex);
      this.addingSection.set(false);
      this.newSection = { name: '', station_type: 'bar', icon: '' };
    });
  }

  startEditSection(sec: MenuSection) {
    this.editSectionId.set(sec.id);
    this.editSectionForm = { name: sec.name, station_type: sec.station_type, icon: sec.icon, sort_order: sec.sort_order, is_active: sec.is_active };
  }

  saveSectionEdit(sec: MenuSection) {
    this.api.updateMenuSection(sec.id, this.editSectionForm).subscribe(updated => {
      this.sections.update(list => list.map(s => s.id === sec.id ? updated : s));
      this.editSectionId.set(null);
    });
  }

  deleteSection(sec: MenuSection) {
    const catCount = this.categories().filter(c => c.section === sec.id).length;
    if (!confirm(`Удалить раздел «${sec.name}»?${catCount ? ` В нём ${catCount} категорий — они тоже будут удалены.` : ''}`)) return;
    this.api.deleteMenuSection(sec.id).subscribe(() => {
      this.sections.update(list => list.filter(s => s.id !== sec.id));
      const deletedCatIds = this.categories().filter(c => c.section === sec.id).map(c => c.id);
      this.categories.update(list => list.filter(c => c.section !== sec.id));
      this.items.update(list => list.filter(i => !deletedCatIds.includes(i.category)));
      this.editSectionId.set(null);
    });
  }

  // ── Category CRUD ─────────────────────────────────────────────────
  startAddCategory(sectionId: number) {
    this.addingCategoryFor.set(sectionId);
    this.newCategory = { name: '' };
    const ex = new Set(this.expandedSections());
    ex.add(sectionId);
    this.expandedSections.set(ex);
  }

  saveCategory(sectionId: number) {
    if (!this.newCategory.name) return;
    this.api.createMenuCategory({ ...this.newCategory, section: sectionId }).subscribe(c => {
      this.categories.update(list => [...list, c]);
      const ex = new Set(this.expandedCategories());
      ex.add(c.id);
      this.expandedCategories.set(ex);
      this.addingCategoryFor.set(null);
      this.newCategory = { name: '' };
    });
  }

  startEditCategory(cat: MenuCategory) {
    this.editCategoryId.set(cat.id);
    this.editCategoryForm = { name: cat.name, is_active: cat.is_active, sort_order: cat.sort_order };
  }

  saveCategoryEdit(cat: MenuCategory) {
    this.api.updateMenuCategory(cat.id, this.editCategoryForm).subscribe(updated => {
      this.categories.update(list => list.map(c => c.id === cat.id ? updated : c));
      this.editCategoryId.set(null);
    });
  }

  deleteCategory(cat: MenuCategory) {
    const count = this.items().filter(i => i.category === cat.id).length;
    if (!confirm(`Удалить категорию «${cat.name}»?${count ? ` В ней ${count} позиций.` : ''}`)) return;
    this.api.deleteMenuCategory(cat.id).subscribe(() => {
      this.categories.update(list => list.filter(c => c.id !== cat.id));
      this.items.update(list => list.filter(i => i.category !== cat.id));
      this.editCategoryId.set(null);
    });
  }

  // ── Item CRUD ─────────────────────────────────────────────────────
  startAddItem(categoryId: number) {
    this.addingItemFor.set(categoryId);
    this.editItemId.set(null);
    this.newItem = { name: '', price: 0, volume: '', description: '', cost_price: 0 };
    const ex = new Set(this.expandedCategories());
    ex.add(categoryId);
    this.expandedCategories.set(ex);
  }

  saveItem(categoryId: number) {
    if (!this.newItem.name || !this.newItem.price) return;
    this.api.createMenuItem({ ...this.newItem, category: categoryId }).subscribe(item => {
      this.items.update(list => [...list, item]);
      this.addingItemFor.set(null);
      this.newItem = { name: '', price: 0, volume: '', description: '', cost_price: 0 };
    });
  }

  startEditItem(item: MenuItem) {
    this.editItemId.set(item.id);
    this.addingItemFor.set(null);
    this.editItemForm = {
      name: item.name, price: item.price, volume: item.volume || '',
      description: item.description || '', cost_price: item.cost_price || 0,
      category: item.category, is_active: item.is_active, is_out_of_stock: item.is_out_of_stock,
    };
  }

  saveItemEdit(item: MenuItem) {
    this.api.updateMenuItem(item.id, this.editItemForm).subscribe(updated => {
      this.items.update(list => list.map(i => i.id === item.id ? updated : i));
      this.editItemId.set(null);
    });
  }

  quickToggle(item: MenuItem) {
    this.api.updateMenuItem(item.id, { is_active: !item.is_active }).subscribe(updated => {
      this.items.update(list => list.map(i => i.id === item.id ? updated : i));
    });
  }

  deleteItem(item: MenuItem) {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    this.api.deleteMenuItem(item.id).subscribe(() => {
      this.items.update(list => list.filter(i => i.id !== item.id));
      this.editItemId.set(null);
    });
  }

  // ── Visual helpers ────────────────────────────────────────────────
  itemDot(item: MenuItem): string {
    if (!item.is_active) return '#d6d3d1';
    if (item.is_out_of_stock) return '#dc2626';
    return '#22c55e';
  }

  stationBadge(t: string): string {
    if (t === 'bar')     return 'background:#ede9fe;color:#7c3aed';
    if (t === 'kitchen') return 'background:#d1fae5;color:#059669';
    if (t === 'hookah')  return 'background:#fff7ed;color:#ea580c';
    return 'background:var(--color-bg);color:var(--color-muted)';
  }
}