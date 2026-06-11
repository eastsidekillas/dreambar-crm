import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { CartService } from '../../../features/cart/cart.service';
import { MenuByCategory, MenuItem } from '../../../core/models';
import {
  LucideDynamicIcon,
  LucideGlassWater, LucideUtensilsCrossed, LucideWind,
  LucideSearch, LucideSearchSlash, LucideX, LucideClock, LucideUsers,
} from '@lucide/angular';

const CAT_TYPE_META: Record<string, { color: string; bg: string; icon: LucideIconInput }> = {
  bar:     { color: 'var(--color-bar)',     bg: 'var(--color-bar-bg)',     icon: LucideGlassWater },
  kitchen: { color: 'var(--color-kitchen)', bg: 'var(--color-kitchen-bg)', icon: LucideUtensilsCrossed },
  hookah:  { color: 'var(--color-hookah)',  bg: 'var(--color-hookah-bg)',  icon: LucideWind },
};

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideSearch, LucideSearchSlash, LucideX, LucideClock, LucideUsers, LucideUtensilsCrossed],
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
                  <div class="menu-card" [class.in-cart]="cart.qty(item.id, activeGuest()) > 0"
                       [class.out-of-stock]="item.is_out_of_stock"
                       (click)="!item.is_out_of_stock && add(item)">
                    @if (item.is_out_of_stock) {
                      <span class="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
                            style="background:#fee2e2;color:#dc2626">Нет</span>
                    } @else if (cart.qty(item.id, activeGuest()) > 0) {
                      <span class="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                            style="background:var(--color-gold)">
                        {{ cart.qty(item.id, activeGuest()) }}
                      </span>
                    }
                    <span class="inline-flex items-center gap-1 text-xs font-medium mb-1.5 px-1.5 py-0.5 rounded-full"
                          [style.color]="meta(group.cat.station_type).color"
                          [style.background]="meta(group.cat.station_type).bg">
                      <svg [lucideIcon]="meta(group.cat.station_type).icon" [size]="12"></svg>
                    </span>
                    <p class="font-semibold text-sm leading-tight mb-0.5" style="color:var(--color-text)">
                      {{ item.name }}
                    </p>
                    @if (item.volume) {
                      <p class="text-xs mb-1" style="color:var(--color-muted)">{{ item.volume }}</p>
                    }
                    <p class="text-base font-bold mt-auto pt-1" style="color:var(--color-gold-hover)">
                      {{ item.price | number:'1.0-0' }} ₽
                    </p>
                  </div>
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

        <!-- Category tabs — touch-sized -->
        <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4" style="scrollbar-width:none">
          @for (cat of categories(); track cat.id) {
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
              <div class="menu-card" [class.in-cart]="cart.qty(item.id, activeGuest()) > 0"
                   [class.out-of-stock]="item.is_out_of_stock"
                   (click)="!item.is_out_of_stock && add(item)">

                @if (item.is_out_of_stock) {
                  <span class="absolute top-2 right-2 text-xs font-bold px-1.5 py-0.5 rounded"
                        style="background:#fee2e2;color:#dc2626">Нет</span>
                } @else if (cart.qty(item.id, activeGuest()) > 0) {
                  <span class="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                        style="background:var(--color-gold)">
                    {{ cart.qty(item.id, activeGuest()) }}
                  </span>
                }

                <span class="inline-flex items-center gap-1 text-xs font-medium mb-1.5 px-1.5 py-0.5 rounded-full"
                      [style.color]="meta(current()!.station_type).color"
                      [style.background]="meta(current()!.station_type).bg">
                  <svg [lucideIcon]="meta(current()!.station_type).icon" [size]="12"></svg>
                </span>

                <p class="font-semibold text-sm leading-tight mb-0.5" style="color:var(--color-text)">
                  {{ item.name }}
                </p>

                @if (item.volume) {
                  <p class="text-xs mb-1" style="color:var(--color-muted)">{{ item.volume }}</p>
                }

                @if (item.description) {
                  <p class="text-xs leading-snug mb-1" style="color:var(--color-light);font-style:italic">
                    {{ item.description }}
                  </p>
                }

                <p class="text-base font-bold mt-auto pt-1" style="color:var(--color-gold-hover)">
                  {{ item.price | number:'1.0-0' }} ₽
                </p>
              </div>
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
  selectedCatId  = signal<number | null>(null);
  searchQuery    = signal('');

  activeGuest    = signal(0);
  private extraGuests = signal(0);

  categories  = computed(() => this.menuByCategory());
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

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getMenuByCategory().subscribe(data => {
      this.menuByCategory.set(data);
      if (data.length) this.selectedCatId.set(data[0].id);
    });
    this.activeGuest.set(this.cart.target()?.guests ? 1 : 0);
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

  meta(type: string): { color: string; bg: string; icon: LucideIconInput } {
    return CAT_TYPE_META[type] ?? { color: 'var(--color-muted)', bg: 'var(--color-bg)', icon: LucideGlassWater };
  }

  catChipClass(cat: MenuByCategory): string {
    const active = this.selectedCatId() === cat.id;
    if (!active) return 'cat-chip-inactive';
    return `cat-chip-${cat.station_type} cat-chip-active-${cat.station_type}`;
  }
}
