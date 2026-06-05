import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { CartService } from '../../../features/cart/cart.service';
import { MenuByCategory, MenuItem } from '../../../core/models';

const CAT_TYPE_META: Record<string, { color: string; bg: string; icon: string }> = {
  bar:     { color: 'var(--color-bar)',     bg: 'var(--color-bar-bg)',     icon: '🍹' },
  kitchen: { color: 'var(--color-kitchen)', bg: 'var(--color-kitchen-bg)', icon: '🍽' },
  hookah:  { color: 'var(--color-hookah)',  bg: 'var(--color-hookah-bg)',  icon: '💨' },
};

@Component({
  selector: 'app-order-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div>
      @if (cart.target(); as t) {
        <div class="flex items-center justify-between px-3 py-2 mb-3 rounded-xl"
             style="background:var(--color-gold-light);border:1px solid var(--color-gold-mid)">
          <span class="text-xs font-medium" style="color:var(--color-gold-hover)">
            🍽 Стол «{{ t.table_number || 'Стол' }}»@if (t.guests) { · 👥 {{ t.guests }} }
          </span>
          <button (click)="cart.setTarget(null)" class="text-xs font-semibold" style="color:var(--color-gold-hover)">Закрыть меню</button>
        </div>
      }

      <!-- ── Active guest selector ───────────────────── -->
      <div class="mb-3">
        <p class="section-title mb-1.5">Записать на гостя</p>
        <div class="flex gap-1.5 overflow-x-auto pb-1 -mx-4 px-4" style="scrollbar-width:none">
          <button (click)="activeGuest.set(0)"
                  class="flex-shrink-0 px-3 h-9 rounded-full text-xs font-semibold"
                  [style.background]="activeGuest() === 0 ? 'var(--color-gold)' : 'var(--color-bg)'"
                  [style.color]="activeGuest() === 0 ? 'white' : 'var(--color-muted)'"
                  [style.border]="'1.5px solid var(--color-border)'">👥 Общий</button>
          @for (g of guestList(); track g) {
            <button (click)="activeGuest.set(g)"
                    class="flex-shrink-0 w-9 h-9 rounded-full text-xs font-bold"
                    [style.background]="activeGuest() === g ? 'var(--color-gold)' : 'var(--color-bg)'"
                    [style.color]="activeGuest() === g ? 'white' : 'var(--color-muted)'"
                    [style.border]="'1.5px solid var(--color-border)'">{{ g }}</button>
          }
          <button (click)="addGuest()"
                  class="flex-shrink-0 w-9 h-9 rounded-full text-base font-bold"
                  style="background:var(--color-bg);color:var(--color-muted);border:1.5px dashed var(--color-border-mid)">＋</button>
        </div>
      </div>

      <!-- ── Category tabs ───────────────────────────── -->
      <div class="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 mb-4" style="scrollbar-width:none">
        @for (cat of categories(); track cat.id) {
          <button (click)="selectCat(cat.id)"
                  class="cat-chip flex-shrink-0"
                  [class]="catChipClass(cat)">
            {{ meta(cat.type).icon }} {{ cat.name }}
          </button>
        }
      </div>

      <!-- ── Items grid ───────────────────────────────── -->
      @if (current()) {
        <div class="section-title mb-3">{{ current()!.name }}</div>

        <div class="grid grid-cols-2 gap-2.5">
          @for (item of current()!.items; track item.id) {
            <div class="menu-card" [class.in-cart]="cart.qty(item.id, activeGuest()) > 0"
                 (click)="add(item)">

              <!-- Qty badge (for active guest) -->
              @if (cart.qty(item.id, activeGuest()) > 0) {
                <span class="absolute top-2 right-2 flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold text-white"
                      style="background:var(--color-gold)">
                  {{ cart.qty(item.id, activeGuest()) }}
                </span>
              }

              <!-- Category dot -->
              <span class="inline-flex items-center gap-1 text-xs font-medium mb-1.5 px-1.5 py-0.5 rounded-full"
                    [style.color]="meta(current()!.type).color"
                    [style.background]="meta(current()!.type).bg">
                {{ meta(current()!.type).icon }}
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
          <span class="text-4xl block mb-3">⏳</span>
          <p style="color:var(--color-muted)">Загрузка меню...</p>
        </div>
      }
    </div>
  `
})
export class OrderPage implements OnInit {
  cart = inject(CartService);

  menuByCategory = signal<MenuByCategory[]>([]);
  selectedCatId  = signal<number | null>(null);

  /** На какого гостя записываются новые позиции. 0 — общая. */
  activeGuest = signal(0);
  /** Сколько кнопок-гостей показать (можно расширить кнопкой ＋). */
  private extraGuests = signal(0);

  categories = computed(() => this.menuByCategory());
  current    = computed(() => this.menuByCategory().find(c => c.id === this.selectedCatId()) ?? null);

  /** Список номеров гостей 1..N (из числа гостей за столом, корзины и ручных добавлений). */
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
    // По умолчанию пишем на первого гостя, если стол с гостями; иначе — общий.
    this.activeGuest.set(this.cart.target()?.guests ? 1 : 0);
  }

  selectCat(id: number) { this.selectedCatId.set(id); }
  add(item: MenuItem)   { this.cart.add(item, this.activeGuest()); }

  addGuest() {
    const next = this.guestList().length + 1;
    this.extraGuests.set(next);
    this.activeGuest.set(next);
  }

  meta(type: string) {
    return CAT_TYPE_META[type] ?? { color: 'var(--color-muted)', bg: 'var(--color-bg)', icon: '•' };
  }

  catChipClass(cat: MenuByCategory): string {
    const active = this.selectedCatId() === cat.id;
    if (!active) return 'cat-chip-inactive';
    return `cat-chip-${cat.type} cat-chip-active-${cat.type}`;
  }
}
