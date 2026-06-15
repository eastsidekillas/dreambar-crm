import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuApi } from '../../../entities/menu';
import { CartService } from '../../../features/cart/cart.service';
import { MenuByCategory, MenuItem } from '../../../core/models';
import { catMeta } from '../../../shared/lib/menu-meta';
import { MenuItemCard } from './menu-item-card';
import {
  LucideDynamicIcon, LucideUtensilsCrossed,
  LucideSearch, LucideSearchSlash, LucideX, LucideClock, LucideUsers,
} from '@lucide/angular';

// Верхний уровень меню — секции (станции). Порядок фиксированный.
const SECTION_META: { type: string; label: string }[] = [
  { type: 'bar',     label: 'Бар' },
  { type: 'kitchen', label: 'Кухня' },
  { type: 'hookah',  label: 'Кальян' },
];

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule, MenuItemCard, LucideDynamicIcon, LucideSearch, LucideSearchSlash, LucideX, LucideClock, LucideUsers, LucideUtensilsCrossed],
  template: `
    <div>
      @if (cart.target(); as t) {
        <div class="flex items-center justify-between px-3 py-2 mb-3 rounded-xl"
             style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
          <span class="text-xs font-medium flex items-center gap-1" style="color:var(--color-gold-hover)">
            <svg lucideUtensilsCrossed [size]="12"></svg> Стол «{{ t.table_number || 'Стол' }}»@if (t.guests) { · <svg lucideUsers [size]="12"></svg> {{ t.guests }} }
          </span>
          <button (click)="cart.setTarget(null)" class="text-xs font-semibold"
                  style="color:var(--color-gold-hover)">Закрыть меню</button>
        </div>
      }

      <!-- ── Guest selector ─────────────────────────────── -->
      <div class="mb-3">
        <p class="section-title mb-1.5">Гость</p>
        <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4" style="scrollbar-width:none">
          <button (click)="activeGuest.set(0)"
                  class="flex-shrink-0 px-4 rounded-xl text-sm font-semibold flex items-center gap-1"
                  style="min-height:44px"
                  [style.background]="activeGuest() === 0 ? 'var(--color-gold)' : 'var(--color-bg)'"
                  [style.color]="activeGuest() === 0 ? 'white' : 'var(--color-muted)'"
                  [style.border]="'1.5px solid var(--color-border)'"><svg lucideUsers [size]="14"></svg> Общий</button>
          @for (g of guestList(); track g) {
            <button (click)="activeGuest.set(g)"
                    class="flex-shrink-0 rounded-xl text-sm font-bold"
                    style="min-width:44px;min-height:44px"
                    [style.background]="activeGuest() === g ? 'var(--color-gold)' : 'var(--color-bg)'"
                    [style.color]="activeGuest() === g ? 'white' : 'var(--color-muted)'"
                    [style.border]="'1.5px solid var(--color-border)'">{{ g }}</button>
          }
          <button (click)="addGuest()"
                  class="flex-shrink-0 rounded-xl text-base font-bold"
                  style="min-width:44px;min-height:44px;background:var(--color-bg);color:var(--color-muted);border:1.5px dashed var(--color-border-mid)">
            ＋
          </button>
        </div>
      </div>

      <!-- ── Search bar ─────────────────────────────────── -->
      <div class="relative mb-3">
        <span class="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center"
              style="color:var(--color-muted)"><svg lucideSearch [size]="16"></svg></span>
        <input [value]="searchQuery()"
               (input)="onSearch($event)"
               placeholder="Поиск по меню..."
               class="field"
               style="padding-left:2.25rem;padding-right:2.25rem;min-height:48px;font-size:1rem" />
        @if (searchQuery()) {
          <button (click)="searchQuery.set('')"
                  class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-lg"
                  style="color:var(--color-muted);min-width:36px;min-height:36px;background:var(--color-surface2)">
            <svg lucideX [size]="14"></svg>
          </button>
        }
      </div>

      <!-- ── SEARCH RESULTS ─────────────────────────────── -->
      @if (isSearching()) {
        @if (searchResults().length) {
          @for (group of searchResults(); track group.cat.id) {
            <div class="mb-5">
              <div class="section-title mb-2 flex items-center gap-1">
                <svg [lucideIcon]="meta(group.cat.station_type).icon" [size]="14"></svg> {{ group.cat.name }}
              </div>
              <div class="grid grid-cols-2 gap-2.5">
                @for (item of group.items; track item.id) {
                  <menu-item-card [item]="item" [guest]="activeGuest()" />
                }
              </div>
            </div>
          }
        } @else {
          <div class="text-center py-12">
            <svg lucideSearchSlash [size]="40" class="mx-auto mb-2" style="color:var(--color-muted)"></svg>
            <p style="color:var(--color-muted)">Ничего не найдено по «{{ searchQuery() }}»</p>
            <button (click)="searchQuery.set('')" class="btn btn-ghost btn-sm mt-3">Сбросить</button>
          </div>
        }
      }

      <!-- ── BROWSE BY CATEGORY ─────────────────────────── -->
      @if (!isSearching()) {

        <!-- Section tabs (станции) — верхний уровень группировки -->
        @if (sections().length > 1) {
          <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-2" style="scrollbar-width:none">
            @for (s of sections(); track s.type) {
              <button (click)="selectSection(s.type)"
                      class="flex-shrink-0 flex items-center gap-1.5 rounded-xl font-bold"
                      style="min-height:44px;padding:0 16px;font-size:0.9rem"
                      [style.background]="selectedSection() === s.type ? meta(s.type).color : 'var(--color-bg)'"
                      [style.color]="selectedSection() === s.type ? 'white' : 'var(--color-muted)'"
                      [style.border]="'1.5px solid ' + (selectedSection() === s.type ? meta(s.type).color : 'var(--color-border)')">
                <svg [lucideIcon]="meta(s.type).icon" [size]="16"></svg> {{ s.label }}
              </button>
            }
          </div>
        }

        <!-- Category tabs — touch-sized -->
        <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4" style="scrollbar-width:none">
          @for (cat of visibleCategories(); track cat.id) {
            <button (click)="selectCat(cat.id)"
                    class="cat-chip flex-shrink-0 flex items-center gap-1"
                    style="min-height:44px;padding:0 16px;font-size:0.875rem"
                    [class]="catChipClass(cat)">
              <svg [lucideIcon]="meta(cat.station_type).icon" [size]="14"></svg> {{ cat.name }}
            </button>
          }
        </div>

        @if (current()) {
          <div class="section-title mb-3">{{ current()!.name }}</div>

          <div class="grid grid-cols-2 gap-2.5">
            @for (item of current()!.items; track item.id) {
              <menu-item-card [item]="item" [guest]="activeGuest()" [showDescription]="true" />
            }
          </div>
        }

        @if (!categories().length) {
          <div class="text-center py-16">
            <svg lucideClock [size]="40" class="mx-auto mb-3" style="color:var(--color-muted)"></svg>
            <p style="color:var(--color-muted)">Загрузка меню...</p>
          </div>
        }
      }
    </div>
  `
})
export class OrderPage implements OnInit {
  cart = inject(CartService);

  menuByCategory = signal<MenuByCategory[]>([]);
  selectedSection = signal<string | null>(null);   // station_type выбранной секции
  selectedCatId  = signal<number | null>(null);
  searchQuery    = signal('');

  activeGuest    = signal(0);
  private extraGuests = signal(0);

  categories  = computed(() => this.menuByCategory());
  /** Секции, реально присутствующие в меню, в фиксированном порядке. */
  sections    = computed(() => {
    const present = new Set<string>(this.menuByCategory().map(c => c.station_type));
    const known   = SECTION_META.filter(s => present.has(s.type));
    const extra   = [...present]
      .filter(t => !SECTION_META.some(s => s.type === t))
      .map(t => ({ type: t, label: t }));
    return [...known, ...extra];
  });
  /** Категории только выбранной секции. */
  visibleCategories = computed(() => {
    const sec = this.selectedSection();
    return sec ? this.menuByCategory().filter(c => c.station_type === sec) : this.menuByCategory();
  });
  current     = computed(() => this.menuByCategory().find(c => c.id === this.selectedCatId()) ?? null);
  isSearching = computed(() => !!this.searchQuery().trim());

  searchResults = computed(() => {
    const q = this.searchQuery().toLowerCase().trim();
    if (!q) return [];
    return this.menuByCategory()
      .map(cat => ({
        cat,
        items: cat.items.filter(i =>
          i.name.toLowerCase().includes(q) ||
          (i.description ?? '').toLowerCase().includes(q) ||
          (i.volume ?? '').toLowerCase().includes(q)
        ),
      }))
      .filter(g => g.items.length > 0);
  });

  guestList = computed<number[]>(() => {
    const fromTable = this.cart.target()?.guests ?? 0;
    const fromCart  = this.cart.items().reduce((m, c) => Math.max(m, c.guestNo), 0);
    const n = Math.max(fromTable, fromCart, this.extraGuests(), 1);
    return Array.from({ length: n }, (_, i) => i + 1);
  });

  constructor(private menuApi: MenuApi) {}

  ngOnInit() {
    this.menuApi.getMenuByCategory().subscribe(data => {
      this.menuByCategory.set(data);
      if (data.length) {
        this.selectedSection.set(data[0].station_type);   // первая секция
        this.selectedCatId.set(data[0].id);               // первая категория в ней
      }
    });
    this.activeGuest.set(this.cart.target()?.guests ? 1 : 0);
  }

  selectSection(type: string) {
    this.selectedSection.set(type);
    const first = this.menuByCategory().find(c => c.station_type === type);
    if (first) this.selectedCatId.set(first.id);
  }

  onSearch(event: Event) {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  selectCat(id: number) { this.selectedCatId.set(id); }
  add(item: MenuItem)   { this.cart.add(item, this.activeGuest()); }

  addGuest() {
    const next = this.guestList().length + 1;
    this.extraGuests.set(next);
    this.activeGuest.set(next);
  }

  meta(type: string) { return catMeta(type); }

  catChipClass(cat: MenuByCategory): string {
    const active = this.selectedCatId() === cat.id;
    if (!active) return 'cat-chip-inactive';
    return `cat-chip-${cat.station_type} cat-chip-active-${cat.station_type}`;
  }
}
