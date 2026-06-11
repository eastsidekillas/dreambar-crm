import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  Menu, MenuByCategory, MenuItem, MenuCategory, MenuSection,
  ModifierGroup, Modifier, MenuItemModifierGroup,
} from '../../core/models';
import { API_BASE as BASE, Paginated, unpage } from '../../shared/api';

@Injectable({ providedIn: 'root' })
export class MenuApi {
  private http = inject(HttpClient);

  // ── Menus ────────────────────────────────────────────────────────
  getMenus(): Observable<Menu[]> {
    return unpage(this.http.get<Menu[] | Paginated<Menu>>(`${BASE}/menu/?page_size=50`));
  }
  createMenu(data: { name: string }): Observable<Menu> {
    return this.http.post<Menu>(`${BASE}/menu/`, data);
  }
  updateMenu(id: number, data: Partial<Menu>): Observable<Menu> {
    return this.http.patch<Menu>(`${BASE}/menu/${id}/`, data);
  }
  activateMenu(id: number): Observable<Menu> {
    return this.http.post<Menu>(`${BASE}/menu/${id}/activate/`, {});
  }
  duplicateMenu(id: number, name?: string): Observable<Menu> {
    return this.http.post<Menu>(`${BASE}/menu/${id}/duplicate/`, name ? { name } : {});
  }
  deleteMenu(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/${id}/`);
  }

  // ── Menu items ───────────────────────────────────────────────────
  getMenuByCategory(menuId?: number): Observable<MenuByCategory[]> {
    const url = menuId
      ? `${BASE}/menu/items/by_category/?menu=${menuId}`
      : `${BASE}/menu/items/by_category/`;
    return this.http.get<MenuByCategory[]>(url);
  }
  getMenuItems(): Observable<MenuItem[]> {
    return unpage(this.http.get<MenuItem[] | Paginated<MenuItem>>(`${BASE}/menu/items/?page_size=500`));
  }
  getMenuCategories(): Observable<MenuCategory[]> {
    return unpage(this.http.get<MenuCategory[] | Paginated<MenuCategory>>(`${BASE}/menu/categories/?page_size=200`));
  }
  getMenuSections(): Observable<MenuSection[]> {
    return unpage(this.http.get<MenuSection[] | Paginated<MenuSection>>(`${BASE}/menu/sections/?page_size=200`));
  }
  createMenuItem(data: Partial<MenuItem>): Observable<MenuItem> {
    return this.http.post<MenuItem>(`${BASE}/menu/items/`, data);
  }
  updateMenuItem(id: number, data: Partial<MenuItem>): Observable<MenuItem> {
    return this.http.patch<MenuItem>(`${BASE}/menu/items/${id}/`, data);
  }
  deleteMenuItem(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/items/${id}/`);
  }
  toggleOutOfStock(itemId: number): Observable<{ id: number; is_out_of_stock: boolean }> {
    return this.http.post<{ id: number; is_out_of_stock: boolean }>(`${BASE}/menu/items/${itemId}/toggle_stock/`, {});
  }
  /** Задать порядок позиций: sort_order проставляется по индексу в списке. */
  reorderMenuItems(itemIds: number[]): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${BASE}/menu/items/reorder/`, { item_ids: itemIds });
  }
  /** Полная структура меню для скачивания файлом */
  exportMenu(id: number): Observable<object> {
    return this.http.get<object>(`${BASE}/menu/${id}/export/`);
  }
  /** Создаёт новое (неактивное) меню из файла экспорта */
  importMenu(data: object): Observable<Menu & { items_imported: number }> {
    return this.http.post<Menu & { items_imported: number }>(`${BASE}/menu/import/`, data);
  }
  createMenuSection(data: Partial<MenuSection>): Observable<MenuSection> {
    return this.http.post<MenuSection>(`${BASE}/menu/sections/`, data);
  }
  updateMenuSection(id: number, data: Partial<MenuSection>): Observable<MenuSection> {
    return this.http.patch<MenuSection>(`${BASE}/menu/sections/${id}/`, data);
  }
  deleteMenuSection(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/sections/${id}/`);
  }
  createMenuCategory(data: Partial<MenuCategory>): Observable<MenuCategory> {
    return this.http.post<MenuCategory>(`${BASE}/menu/categories/`, data);
  }
  /** Задать порядок категорий: sort_order проставляется по индексу в списке. */
  reorderMenuCategories(categoryIds: number[]): Observable<{ updated: number }> {
    return this.http.post<{ updated: number }>(`${BASE}/menu/categories/reorder/`, { category_ids: categoryIds });
  }
  updateMenuCategory(id: number, data: Partial<MenuCategory>): Observable<MenuCategory> {
    return this.http.patch<MenuCategory>(`${BASE}/menu/categories/${id}/`, data);
  }
  deleteMenuCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/categories/${id}/`);
  }

  // ── Modifiers ────────────────────────────────────────────────────
  getModifierGroups(): Observable<ModifierGroup[]> {
    return unpage(this.http.get<ModifierGroup[] | Paginated<ModifierGroup>>(`${BASE}/menu/modifier-groups/?page_size=200`));
  }
  createModifierGroup(data: Partial<ModifierGroup>): Observable<ModifierGroup> {
    return this.http.post<ModifierGroup>(`${BASE}/menu/modifier-groups/`, data);
  }
  updateModifierGroup(id: number, data: Partial<ModifierGroup>): Observable<ModifierGroup> {
    return this.http.patch<ModifierGroup>(`${BASE}/menu/modifier-groups/${id}/`, data);
  }
  deleteModifierGroup(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/modifier-groups/${id}/`);
  }
  createModifier(data: Partial<Modifier>): Observable<Modifier> {
    return this.http.post<Modifier>(`${BASE}/menu/modifiers/`, data);
  }
  updateModifier(id: number, data: Partial<Modifier>): Observable<Modifier> {
    return this.http.patch<Modifier>(`${BASE}/menu/modifiers/${id}/`, data);
  }
  deleteModifier(id: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/modifiers/${id}/`);
  }
  getItemModifierGroups(menuItemId: number): Observable<MenuItemModifierGroup[]> {
    return this.http.get<MenuItemModifierGroup[]>(`${BASE}/menu/items/${menuItemId}/modifier_groups/`);
  }
  assignModifierGroup(menuItemId: number, modifierGroupId: number): Observable<MenuItemModifierGroup> {
    return this.http.post<MenuItemModifierGroup>(`${BASE}/menu/item-modifiers/`, {
      menu_item: menuItemId, modifier_group: modifierGroupId,
    });
  }
  removeModifierGroup(linkId: number): Observable<void> {
    return this.http.delete<void>(`${BASE}/menu/item-modifiers/${linkId}/`);
  }
}