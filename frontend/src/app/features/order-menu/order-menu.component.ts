import { Component, Input, Output, EventEmitter, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucidePlus } from '@lucide/angular';
import { MenuApi } from '../../entities/menu';
import { MenuByCategory, MenuItem } from '../../core/models';

const SECTION_LABEL: Record<string, string> = { bar: 'Бар', kitchen: 'Кухня', hookah: 'Кальян' };
const SECTION_ORDER = ['bar', 'kitchen', 'hookah'];

/** Инлайн-меню: разделы (Бар/Кухня) → категории → позиции, либо результаты поиска.
 * Поиск приходит входом, выбор позиции отдаётся через (pick). */
@Component({
  selector: 'order-menu',
  standalone: true,
  imports: [CommonModule, LucidePlus],
  template: `
    @if (!q().trim() && sections().length > 1) {
      <div class="px-3 pb-2 flex justify-center gap-2">
        @for (s of sections(); track s.type) {
          <button (click)="selectSection(s.type)"
                  class="px-4 py-1.5 rounded-full text-sm font-bold"
                  [style.background]="activeSection() === s.type ? 'var(--color-gold)' : 'var(--color-surface2)'"
                  [style.color]="activeSection() === s.type ? 'white' : 'var(--color-muted)'"
                  [style.border]="'1.5px solid ' + (activeSection() === s.type ? 'var(--color-gold)' : 'var(--color-border)')">
            {{ s.label }}
          </button>
        }
      </div>
    }

    <div class="px-3 pb-3 overflow-y-auto" style="max-height:42dvh">
      @if (q().trim()) {
        <div class="grid grid-cols-2 gap-2">
          @for (it of shownItems(); track it.id) {
            <ng-container [ngTemplateOutlet]="itemBtn" [ngTemplateOutletContext]="{ it }" />
          }
          @if (!shownItems().length) {
            <span class="text-sm py-2" style="color:var(--color-muted)">Ничего не найдено</span>
          }
        </div>
      } @else if (activeCat() === null) {
        <div class="grid grid-cols-2 gap-2">
          @for (c of visibleCategories(); track c.id) {
            <button (click)="activeCat.set(c.id)"
                    class="flex items-center justify-center text-center px-3 py-3 rounded-xl text-sm font-semibold leading-tight"
                    style="min-height:52px;background:var(--color-surface2);border:1.5px solid var(--color-border);color:var(--color-text)">
              {{ c.name }}
            </button>
          }
        </div>
      } @else {
        <button (click)="activeCat.set(null)"
                class="flex items-center gap-0.5 text-sm font-semibold mb-2" style="color:var(--color-gold-hover)">
          <span style="font-size:1.1rem;line-height:1">‹</span> {{ currentCatName() }}
        </button>
        <div class="grid grid-cols-2 gap-2">
          @for (it of shownItems(); track it.id) {
            <ng-container [ngTemplateOutlet]="itemBtn" [ngTemplateOutletContext]="{ it }" />
          }
        </div>
      }
    </div>

    <ng-template #itemBtn let-it="it">
      <button (click)="pick.emit(it)" [disabled]="it.is_out_of_stock"
              class="flex flex-col justify-between text-left px-3 py-2.5 rounded-xl"
              style="min-height:62px;background:var(--color-surface2);border:1.5px solid var(--color-border)"
              [style.opacity]="it.is_out_of_stock ? '0.45' : '1'">
        <span class="text-sm font-medium leading-tight" style="color:var(--color-text)">{{ it.name }}</span>
        <span class="flex items-center justify-between mt-1.5">
          <span class="font-bold text-sm" style="color:var(--color-gold-hover)">{{ it.price | number:'1.0-0' }} ₽</span>
          <svg lucidePlus [size]="16" style="color:var(--color-gold)"></svg>
        </span>
      </button>
    </ng-template>
  `,
})
export class OrderMenuComponent implements OnInit {
  private menuApi = inject(MenuApi);

  /** Поисковый запрос (из шапки нижней панели). */
  @Input() set search(v: string) { this.q.set(v ?? ''); }
  @Output() pick = new EventEmitter<MenuItem>();

  q = signal('');
  menuByCategory = signal<MenuByCategory[]>([]);
  activeSection  = signal<string | null>(null);
  activeCat      = signal<number | null>(null);

  sections = computed(() => {
    const present = new Set<string>(this.menuByCategory().map(c => c.station_type));
    const known = SECTION_ORDER.filter(t => present.has(t)).map(t => ({ type: t, label: SECTION_LABEL[t] }));
    const extra = [...present].filter(t => !SECTION_ORDER.includes(t)).map(t => ({ type: t, label: t }));
    return [...known, ...extra];
  });
  visibleCategories = computed(() => {
    const s = this.activeSection();
    return s ? this.menuByCategory().filter(c => c.station_type === s) : this.menuByCategory();
  });
  currentCatName = computed(() => this.menuByCategory().find(c => c.id === this.activeCat())?.name ?? '');
  shownItems = computed<MenuItem[]>(() => {
    const query = this.q().toLowerCase().trim();
    if (query) return this.menuByCategory().flatMap(c => c.items).filter(i => i.name.toLowerCase().includes(query));
    const cat = this.activeCat();
    if (cat == null) return [];
    return this.menuByCategory().find(c => c.id === cat)?.items ?? [];
  });

  ngOnInit() {
    this.menuApi.getMenuByCategory().subscribe({
      next: m => {
        this.menuByCategory.set(m);
        if (!this.activeSection() && this.sections().length) this.activeSection.set(this.sections()[0].type);
      },
      error: () => {},
    });
  }

  selectSection(type: string) { this.activeSection.set(type); this.activeCat.set(null); }
}