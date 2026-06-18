import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MenuApi } from '../../../entities/menu';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Menu, MenuItem, MenuCategory, MenuSection } from '../../../core/models';
import { ItemModifiersEditor } from './item-modifiers-editor';
import {
  LucideDynamicIcon,
  LucideGlassWater, LucideUtensilsCrossed, LucideWind, LucideClipboardList,
  LucideSearch, LucideX, LucidePencil, LucideTrash2, LucideEye,
  LucideCheck, LucideChevronUp, LucideChevronDown,
} from '@lucide/angular';

const STATIONS: { value: string; label: string; icon: LucideIconInput }[] = [
  { value: 'bar',     label: 'Бар',    icon: LucideGlassWater },
  { value: 'kitchen', label: 'Кухня',  icon: LucideUtensilsCrossed },
  { value: 'hookah',  label: 'Кальян', icon: LucideWind },
];

const stationIcon  = (t: string): LucideIconInput => STATIONS.find(s => s.value === t)?.icon ?? LucideClipboardList;
const stationLabel = (t: string) => STATIONS.find(s => s.value === t)?.label ?? t;

interface SectionNode extends MenuSection { categories: CategoryNode[]; }
interface CategoryNode extends MenuCategory { items: MenuItem[]; }

@Component({
  selector: 'app-menu',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideDynamicIcon, ItemModifiersEditor,
    LucideUtensilsCrossed,
    LucideSearch, LucideX, LucidePencil, LucideTrash2, LucideEye, LucideCheck,
    LucideChevronUp, LucideChevronDown],
  template: `
<div class="space-y-3">

  <!-- ── Menu tabs ──────────────────────────────────────────────────── -->
  <div class="flex items-center gap-2 flex-wrap">
    @for (menu of menus(); track menu.id) {
      <button (click)="selectMenu(menu.id)"
              class="btn btn-sm flex items-center gap-1.5"
              [style]="selectedMenuId() === menu.id
                ? 'background:var(--color-gold-light);color:var(--color-gold-hover);border:1.5px solid var(--color-gold)'
                : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
        {{ menu.name }}
        @if (menu.is_active) {
          <span title="Активное — используется в заказах"
                style="width:6px;height:6px;border-radius:50%;background:#22c55e;display:inline-block;flex-shrink:0"></span>
        }
        <span style="opacity:0.6;font-size:10px">{{ menu.items_count }}</span>
      </button>
    }
    <button (click)="creatingMenu.set(!creatingMenu())"
            class="btn btn-sm btn-ghost"
            style="font-size:12px">
      + Меню
    </button>
    <button (click)="importFile.click()" class="btn btn-sm btn-ghost" style="font-size:12px"
            title="Загрузить меню из файла экспорта — создаст новое меню">
      Импорт
    </button>
    <input #importFile type="file" accept=".json,application/json" class="hidden"
           (change)="importMenuFile($event)"/>
  </div>

  <!-- ── Create menu form ───────────────────────────────────────────── -->
  @if (creatingMenu()) {
    <div class="card" style="border-color:var(--color-gold);padding:12px">
      <p class="font-semibold text-sm mb-2">Новое меню</p>
      <div class="flex gap-2 items-center">
        <input [(ngModel)]="newMenuName"
               class="field" style="height:32px;flex:1;max-width:280px"
               placeholder="Название меню..." />
        <button (click)="createMenu()" class="btn btn-primary btn-sm">Создать</button>
        <button (click)="creatingMenu.set(false)" class="btn btn-ghost btn-sm">Отмена</button>
      </div>
    </div>
  }

  <!-- ── Selected menu actions ──────────────────────────────────────── -->
  @if (selectedMenu()) {
    <div class="flex items-center gap-3 flex-wrap" style="padding:6px 0;border-bottom:1px solid var(--color-border)">
      @if (selectedMenu()!.is_active) {
        <span class="text-xs font-medium" style="color:#16a34a">● Активное меню — используется официантами</span>
      } @else {
        <button (click)="activateSelectedMenu()"
                class="btn btn-sm"
                style="background:#dcfce7;color:#16a34a;border:1px solid #bbf7d0;font-size:11px">
          Активировать для официантов
        </button>
      }
      <button (click)="startRename()" class="btn btn-ghost btn-sm" style="font-size:11px">Переименовать</button>
      <button (click)="duplicateSelectedMenu()" class="btn btn-ghost btn-sm" style="font-size:11px">Дублировать</button>
      <button (click)="exportSelectedMenu()" class="btn btn-ghost btn-sm" style="font-size:11px"
              title="Скачать меню файлом — для переноса или резервной копии">Экспорт</button>
      @if (!selectedMenu()!.is_active && selectedMenu()!.sections_count === 0) {
        <button (click)="deleteSelectedMenu()"
                class="btn btn-sm ml-auto"
                style="background:#fee2e2;color:#dc2626;font-size:11px">
          Удалить меню
        </button>
      }
    </div>
  }

  <!-- ── Rename form ────────────────────────────────────────────────── -->
  @if (renamingMenu()) {
    <div class="flex items-center gap-2">
      <input [(ngModel)]="renameValue" class="field" style="height:30px;flex:1;max-width:280px"/>
      <button (click)="saveRename()" class="btn btn-primary btn-sm">Сохранить</button>
      <button (click)="renamingMenu.set(false)" class="btn btn-ghost btn-sm">Отмена</button>
    </div>
  }

  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="flex items-start justify-between gap-3 flex-wrap">
    <div>
      <h1 class="text-xl font-bold">Меню</h1>
      <p class="text-xs mt-0.5" style="color:var(--color-muted)">
        {{ menuSections().length }} разд. · {{ menuCategories().length }} кат. · {{ menuItems().length }} позиций
        @if (hiddenCount() > 0) {
          · <span style="color:var(--color-muted)">{{ hiddenCount() }} скрыто</span>
        }
      </p>
    </div>
    <div class="flex items-center gap-2 flex-wrap">
      <!-- Search -->
      <div class="relative">
        <svg lucideSearch [size]="14" class="absolute left-2.5 top-1/2 -translate-y-1/2" style="color:var(--color-muted)"></svg>
        <input [(ngModel)]="searchRaw"
               (ngModelChange)="onSearch($event)"
               class="field pl-7 pr-3"
               style="height:34px;width:200px"
               placeholder="Поиск позиции..."/>
        @if (searchRaw) {
          <button (click)="clearSearch()"
                  class="absolute right-2 top-1/2 -translate-y-1/2 text-xs"
                  style="color:var(--color-muted);background:none;border:none;cursor:pointer"><svg lucideX [size]="12"></svg></button>
        }
      </div>
      <!-- Show hidden toggle -->
      <button (click)="showHidden.set(!showHidden())"
              class="btn btn-sm"
              [style]="showHidden()
                ? 'background:var(--color-gold-light);color:var(--color-gold-hover);border:1px solid var(--color-gold-mid)'
                : 'background:var(--color-bg);color:var(--color-muted);border:1px solid var(--color-border)'">
        <svg lucideEye [size]="14" class="mr-1 inline-block"></svg>{{ showHidden() ? 'Все' : 'Скрытые' }}
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
              <option [value]="s.value">{{ s.label }}</option>
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

  <!-- ── Empty state ─────────────────────────────────────────────────── -->
  @if (!selectedMenuId()) {
    <div class="card text-center py-12" style="color:var(--color-muted)">
      <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
      <p>Создайте первое меню с помощью кнопки «+ Меню».</p>
    </div>
  }

  @if (selectedMenuId() && tree().length === 0 && !loading()) {
    <div class="card text-center py-12" style="color:var(--color-muted)">
      <svg lucideUtensilsCrossed [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
      <p>Разделы меню не созданы. Начните с кнопки «+ Раздел».</p>
    </div>
  }

  @if (searchRaw && filteredTotal() === 0) {
    <div class="card text-center py-8" style="color:var(--color-muted)">
      По запросу «{{ searchRaw }}» ничего не найдено
    </div>
  }

  <!-- ── Tree ─────────────────────────────────────────────────────── -->
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
                    <option [value]="s.value">{{ s.label }}</option>
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
              <button (click)="saveSectionEdit(sec)" class="btn btn-primary btn-sm flex items-center gap-1"><svg lucideCheck [size]="12"></svg> Сохранить</button>
              <button (click)="editSectionId.set(null)" class="btn btn-ghost btn-sm">Отмена</button>
              <button (click)="deleteSection(sec)"
                      class="btn btn-sm ml-auto flex items-center gap-1"
                      style="background:#fee2e2;color:#dc2626;font-size:11px">
                <svg lucideTrash2 [size]="12"></svg> Удалить раздел
              </button>
            </div>
          </div>

        } @else {
          <div class="flex items-center gap-2 px-4 py-3 cursor-pointer select-none"
               style="background:#fafaf9"
               (click)="toggleSection(sec.id)">
            @if (sec.icon) {
              <span class="text-lg">{{ sec.icon }}</span>
            } @else {
              <svg  [lucideIcon]="stationLucideIcon(sec.station_type)" [size]="18"></svg>
            }
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
                      class="btn btn-ghost btn-sm"><svg lucidePencil [size]="12"></svg></button>
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
                    <button (click)="saveCategoryEdit(cat)" class="btn btn-primary btn-sm"><svg lucideCheck [size]="12"></svg></button>
                    <button (click)="editCategoryId.set(null)" class="btn btn-ghost btn-sm"><svg lucideX [size]="12"></svg></button>
                    <button (click)="deleteCategory(cat)"
                            class="btn btn-sm"
                            style="background:#fee2e2;color:#dc2626;font-size:11px"><svg lucideTrash2 [size]="12"></svg></button>
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
                      @if (!searchRaw) {
                        <button (click)="moveCategory(cat, sec, -1)"
                                [disabled]="$first"
                                [style.opacity]="$first ? '0.3' : '1'"
                                class="btn btn-ghost btn-sm" title="Выше"><svg lucideChevronUp [size]="12"></svg></button>
                        <button (click)="moveCategory(cat, sec, 1)"
                                [disabled]="$last"
                                [style.opacity]="$last ? '0.3' : '1'"
                                class="btn btn-ghost btn-sm" title="Ниже"><svg lucideChevronDown [size]="12"></svg></button>
                      }
                      <button (click)="startAddItem(cat.id)"
                              class="btn btn-ghost btn-sm" style="font-size:11px">+ Позицию</button>
                      <button (click)="startEditCategory(cat)"
                              class="btn btn-ghost btn-sm"><svg lucidePencil [size]="12"></svg></button>
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
                              @for (c of menuCategories(); track c.id) {
                                <option [value]="c.id">{{ c.name }}</option>
                              }
                            </select>
                          </div>
                        </div>
                        <div class="mb-2 pt-2" style="border-top:1px solid var(--color-border)">
                          <item-modifiers-editor [itemId]="item.id" />
                        </div>
                        <div class="flex items-center gap-3 flex-wrap">
                          <button (click)="saveItemEdit(item)" class="btn btn-primary btn-sm flex items-center gap-1"><svg lucideCheck [size]="12"></svg> Сохранить</button>
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
                                  class="btn btn-sm ml-auto flex items-center gap-1"
                                  style="background:#fee2e2;color:#dc2626;font-size:11px"><svg lucideTrash2 [size]="12"></svg> Удалить</button>
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
                          @if (!searchRaw) {
                            <button (click)="moveItem(item, cat, -1)"
                                    [disabled]="$first"
                                    [style.opacity]="$first ? '0.3' : '1'"
                                    class="btn btn-ghost btn-sm" title="Выше"><svg lucideChevronUp [size]="12"></svg></button>
                            <button (click)="moveItem(item, cat, 1)"
                                    [disabled]="$last"
                                    [style.opacity]="$last ? '0.3' : '1'"
                                    class="btn btn-ghost btn-sm" title="Ниже"><svg lucideChevronDown [size]="12"></svg></button>
                          }
                          <button (click)="startEditItem(item)"
                                  class="btn btn-ghost btn-sm"><svg lucidePencil [size]="12"></svg></button>
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
  // ── Raw data (all menus) ──────────────────────────────────────────
  menus      = signal<Menu[]>([]);
  sections   = signal<MenuSection[]>([]);
  categories = signal<MenuCategory[]>([]);
  items      = signal<MenuItem[]>([]);
  loading    = signal(true);

  // ── Menu selection ────────────────────────────────────────────────
  selectedMenuId = signal<number | null>(null);
  selectedMenu   = computed(() => this.menus().find(m => m.id === this.selectedMenuId()) ?? null);

  // ── Filtered data for current menu ───────────────────────────────
  menuSections = computed(() =>
    this.sections().filter(s => s.menu === this.selectedMenuId())
  );
  menuCategories = computed(() => {
    const sids = new Set(this.menuSections().map(s => s.id));
    return this.categories().filter(c => sids.has(c.section));
  });
  menuItems = computed(() => {
    const cids = new Set(this.menuCategories().map(c => c.id));
    return this.items().filter(i => cids.has(i.category));
  });

  showHidden = signal(false);
  searchRaw  = '';
  search     = signal('');

  stations = STATIONS;
  stationIcon  = stationIcon;
  stationLabel = stationLabel;

  stationLucideIcon(type: string): LucideIconInput {
    return stationIcon(type);
  }

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
    const term    = this.search().toLowerCase();
    const showAll = this.showHidden();

    return this.menuSections()
      .filter(s => showAll || s.is_active)
      .map(sec => {
        const cats = this.menuCategories()
          .filter(c => c.section === sec.id && (showAll || c.is_active))
          .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
          .map(cat => {
            let its = this.menuItems()
              .filter(i => i.category === cat.id && (showAll || i.is_active))
              .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name));
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

  hiddenCount = computed(() => this.menuItems().filter(i => !i.is_active).length);

  filteredTotal = computed(() =>
    this.tree().reduce((s, sec) => s + sec.categories.reduce((cs, c) => cs + c.items.length, 0), 0)
  );

  sectionItemCount(sec: SectionNode): number {
    return sec.categories.reduce((s, cat) => s + cat.items.length, 0);
  }

  // ── Menu management form state ────────────────────────────────────
  creatingMenu  = signal(false);
  renamingMenu  = signal(false);
  newMenuName   = '';
  renameValue   = '';

  // ── Section/category/item form state ─────────────────────────────
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

  constructor(private menuApi: MenuApi, private toast: ToastService) {}

  ngOnInit() { this.loadAll(); }

  loadAll(selectId?: number) {
    this.loading.set(true);
    this.menuApi.getMenus().subscribe(menus => {
      this.menus.set(menus);
      const preferred = selectId != null ? menus.find(m => m.id === selectId) : undefined;
      const active = preferred ?? menus.find(m => m.is_active) ?? menus[0];
      if (active) this.selectedMenuId.set(active.id);
    });
    this.menuApi.getMenuSections().subscribe(s => {
      this.sections.set(s);
      if (s.length) {
        const firstId = s[0].id;
        const ex = new Set(this.expandedSections());
        ex.add(firstId);
        this.expandedSections.set(ex);
      }
    });
    this.menuApi.getMenuCategories().subscribe(c => this.categories.set(c));
    this.menuApi.getMenuItems().subscribe(i => { this.items.set(i); this.loading.set(false); });
  }

  // ── Search ────────────────────────────────────────────────────────
  onSearch(val: string) { this.search.set(val.trim()); }
  clearSearch() { this.searchRaw = ''; this.search.set(''); }

  // ── Menu management ───────────────────────────────────────────────
  selectMenu(id: number) {
    this.selectedMenuId.set(id);
    this.editSectionId.set(null);
    this.editCategoryId.set(null);
    this.editItemId.set(null);
    this.addingSection.set(false);
    this.expandedSections.set(new Set());
    const firstSec = this.menuSections()[0];
    if (firstSec) this.expandedSections.set(new Set([firstSec.id]));
  }

  createMenu() {
    if (!this.newMenuName.trim()) return;
    this.menuApi.createMenu({ name: this.newMenuName.trim() }).subscribe(m => {
      this.menus.update(list => [...list, m]);
      this.selectedMenuId.set(m.id);
      this.newMenuName = '';
      this.creatingMenu.set(false);
      this.toast.success(`Меню «${m.name}» создано`);
    });
  }

  activateSelectedMenu() {
    const id = this.selectedMenuId();
    if (!id) return;
    this.menuApi.activateMenu(id).subscribe(updated => {
      this.menus.update(list => list.map(m => ({ ...m, is_active: m.id === updated.id })));
      this.toast.success(`Меню «${updated.name}» теперь активное`);
    });
  }

  duplicateSelectedMenu() {
    const id = this.selectedMenuId();
    if (!id) return;
    const src = this.selectedMenu();
    const name = src ? `Копия: ${src.name}` : 'Новое меню';
    this.menuApi.duplicateMenu(id, name).subscribe(m => {
      this.menus.update(list => [...list, m]);
      this.toast.success(`Меню скопировано как «${m.name}»`);
      this.loadAll();
    });
  }

  startRename() {
    this.renameValue = this.selectedMenu()?.name ?? '';
    this.renamingMenu.set(true);
  }

  saveRename() {
    const id = this.selectedMenuId();
    if (!id || !this.renameValue.trim()) return;
    this.menuApi.updateMenu(id, { name: this.renameValue.trim() }).subscribe(updated => {
      this.menus.update(list => list.map(m => m.id === id ? updated : m));
      this.renamingMenu.set(false);
      this.toast.success('Название обновлено');
    });
  }

  exportSelectedMenu() {
    const menu = this.selectedMenu();
    if (!menu) return;
    this.menuApi.exportMenu(menu.id).subscribe(data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `menu-${menu.name.replace(/[^\wа-яА-ЯёЁ-]+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      this.toast.success(`Меню «${menu.name}» скачано`);
    });
  }

  importMenuFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    file.text().then(text => {
      let data: object;
      try {
        data = JSON.parse(text);
      } catch {
        this.toast.error('Файл не читается — это не файл экспорта меню');
        return;
      }
      this.menuApi.importMenu(data).subscribe({
        next: m => {
          this.toast.success(`Меню «${m.name}» импортировано: ${m.items_imported} позиций`);
          this.loadAll(m.id);
        },
        error: err => this.toast.apiError(err, 'Не удалось импортировать меню'),
      });
    });
  }

  deleteSelectedMenu() {
    const menu = this.selectedMenu();
    if (!menu) return;
    if (!confirm(`Удалить меню «${menu.name}»? Это действие необратимо.`)) return;
    this.menuApi.deleteMenu(menu.id).subscribe({
      next: () => {
        this.menus.update(list => list.filter(m => m.id !== menu.id));
        const next = this.menus()[0];
        this.selectedMenuId.set(next?.id ?? null);
        this.toast.success(`Меню «${menu.name}» удалено`);
      },
      error: (err) => this.toast.apiError(err, 'Не удалось удалить меню'),
    });
  }

  // ── Section CRUD ──────────────────────────────────────────────────
  toggleAddSection() {
    this.addingSection.set(!this.addingSection());
    this.newSection = { name: '', station_type: 'bar', icon: '' };
  }

  saveSection() {
    if (!this.newSection.name || !this.selectedMenuId()) return;
    this.menuApi.createMenuSection({ ...this.newSection, menu: this.selectedMenuId()! }).subscribe(s => {
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
    this.menuApi.updateMenuSection(sec.id, this.editSectionForm).subscribe(updated => {
      this.sections.update(list => list.map(s => s.id === sec.id ? updated : s));
      this.editSectionId.set(null);
    });
  }

  deleteSection(sec: MenuSection) {
    const catCount = this.categories().filter(c => c.section === sec.id).length;
    if (!confirm(`Удалить раздел «${sec.name}»?${catCount ? ` В нём ${catCount} категорий — они тоже будут удалены.` : ''}`)) return;
    this.menuApi.deleteMenuSection(sec.id).subscribe({
      next: () => {
        const deletedCatIds = this.categories().filter(c => c.section === sec.id).map(c => c.id);
        this.sections.update(list => list.filter(s => s.id !== sec.id));
        this.categories.update(list => list.filter(c => c.section !== sec.id));
        this.items.update(list => list.filter(i => !deletedCatIds.includes(i.category)));
        this.editSectionId.set(null);
      },
      error: (err) => this.toast.apiError(err, 'Ошибка при удалении раздела'),
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
    this.menuApi.createMenuCategory({ ...this.newCategory, section: sectionId }).subscribe(c => {
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
    this.menuApi.updateMenuCategory(cat.id, this.editCategoryForm).subscribe(updated => {
      this.categories.update(list => list.map(c => c.id === cat.id ? updated : c));
      this.editCategoryId.set(null);
    });
  }

  moveCategory(cat: MenuCategory, sec: SectionNode, delta: -1 | 1) {
    const visible = sec.categories;
    const vi = visible.findIndex(c => c.id === cat.id);
    const neighbor = visible[vi + delta];
    if (!neighbor) return;

    // Полный список категорий раздела (включая скрытые), чтобы не потерять их порядок
    const ids = this.categories()
      .filter(c => c.section === sec.id)
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
      .map(c => c.id)
      .filter(id => id !== cat.id);
    const ni = ids.indexOf(neighbor.id);
    ids.splice(delta === 1 ? ni + 1 : ni, 0, cat.id);

    const orderMap = new Map(ids.map((id, idx) => [id, (idx + 1) * 10]));
    const prev = this.categories();
    this.categories.update(list => list.map(c =>
      orderMap.has(c.id) ? { ...c, sort_order: orderMap.get(c.id)! } : c
    ));
    this.menuApi.reorderMenuCategories(ids).subscribe({
      error: () => {
        this.categories.set(prev);
        this.toast.error('Не удалось изменить порядок');
      },
    });
  }

  deleteCategory(cat: MenuCategory) {
    const count = this.items().filter(i => i.category === cat.id).length;
    if (!confirm(`Удалить категорию «${cat.name}»?${count ? ` В ней ${count} позиций.` : ''}`)) return;
    this.menuApi.deleteMenuCategory(cat.id).subscribe({
      next: () => {
        this.categories.update(list => list.filter(c => c.id !== cat.id));
        this.items.update(list => list.filter(i => i.category !== cat.id));
        this.editCategoryId.set(null);
      },
      error: (err) => this.toast.apiError(err, 'Ошибка при удалении категории'),
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
    this.menuApi.createMenuItem({ ...this.newItem, category: categoryId }).subscribe(item => {
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
    this.menuApi.updateMenuItem(item.id, this.editItemForm).subscribe(updated => {
      this.items.update(list => list.map(i => i.id === item.id ? updated : i));
      this.editItemId.set(null);
    });
  }

  moveItem(item: MenuItem, cat: CategoryNode, delta: -1 | 1) {
    const visible = cat.items;
    const vi = visible.findIndex(i => i.id === item.id);
    const neighbor = visible[vi + delta];
    if (!neighbor) return;

    // Полный список категории (включая скрытые), чтобы не потерять их порядок
    const ids = this.items()
      .filter(i => i.category === cat.id)
      .sort((a, b) => (a.sort_order - b.sort_order) || a.name.localeCompare(b.name))
      .map(i => i.id)
      .filter(id => id !== item.id);
    const ni = ids.indexOf(neighbor.id);
    ids.splice(delta === 1 ? ni + 1 : ni, 0, item.id);

    const orderMap = new Map(ids.map((id, idx) => [id, (idx + 1) * 10]));
    const prev = this.items();
    this.items.update(list => list.map(i =>
      orderMap.has(i.id) ? { ...i, sort_order: orderMap.get(i.id)! } : i
    ));
    this.menuApi.reorderMenuItems(ids).subscribe({
      error: () => {
        this.items.set(prev);
        this.toast.error('Не удалось изменить порядок');
      },
    });
  }

  quickToggle(item: MenuItem) {
    this.menuApi.updateMenuItem(item.id, { is_active: !item.is_active }).subscribe(updated => {
      this.items.update(list => list.map(i => i.id === item.id ? updated : i));
    });
  }

  deleteItem(item: MenuItem) {
    if (!confirm(`Удалить «${item.name}»?`)) return;
    this.menuApi.deleteMenuItem(item.id).subscribe({
      next: () => {
        this.items.update(list => list.filter(i => i.id !== item.id));
        this.editItemId.set(null);
      },
      error: (err) => this.toast.apiError(err, 'Нельзя удалить: позиция используется в заказах. Деактивируйте её.'),
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
