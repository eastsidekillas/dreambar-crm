import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MenuApi } from '../../../entities/menu';
import { MenuByCategory, MenuItem } from '../../../core/models';
import { LucideBan, LucideCheck } from '@lucide/angular';

interface StopGroup { category: string; items: MenuItem[]; }

/** Стоп-лист (read-only): что сейчас недоступно. Меняют доступность на кухне/в админке. */
@Component({
  selector: 'app-stop-list-page',
  standalone: true,
  imports: [CommonModule, LucideBan, LucideCheck],
  host: { class: 'block' },
  template: `
    <div class="flex items-center gap-2 mb-3">
      <svg lucideBan [size]="20" style="color:var(--color-red)"></svg>
      <h1 class="text-xl font-bold">Стоп-лист</h1>
      @if (total()) {
        <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
              style="background:var(--color-red-bg);color:var(--color-red)">{{ total() }}</span>
      }
    </div>

    @if (loading()) {
      <p class="text-center py-16" style="color:var(--color-muted)">Загрузка…</p>
    } @else if (!groups().length) {
      <div class="text-center py-20">
        <svg lucideCheck [size]="40" class="mx-auto mb-2" style="color:var(--color-green)"></svg>
        <p class="font-semibold">Сейчас всё доступно</p>
        <p class="text-sm mt-1" style="color:var(--color-muted)">Стоп-лист пуст</p>
      </div>
    } @else {
      <div class="space-y-3">
        @for (g of groups(); track g.category) {
          <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px">
            <div class="px-3 py-2 text-xs font-semibold" style="color:var(--color-muted);border-bottom:1px solid var(--color-border)">
              {{ g.category }}
            </div>
            @for (it of g.items; track it.id) {
              <div class="flex items-center gap-2 px-3 py-2.5" style="border-bottom:1px solid var(--color-border)">
                <span class="rounded-full flex-shrink-0" style="width:7px;height:7px;background:var(--color-red)"></span>
                <span class="flex-1 text-sm">{{ it.name }}</span>
                <span class="text-xs" style="color:var(--color-muted)">{{ it.price | number:'1.0-0' }} ₽</span>
              </div>
            }
          </div>
        }
      </div>
    }
  `,
})
export class StopListPage implements OnInit {
  private menuApi = inject(MenuApi);

  loading = signal(true);
  private menu = signal<MenuByCategory[]>([]);

  groups = computed<StopGroup[]>(() =>
    this.menu()
      .map(c => ({ category: c.name, items: c.items.filter(i => i.is_out_of_stock) }))
      .filter(g => g.items.length));
  total = computed(() => this.groups().reduce((s, g) => s + g.items.length, 0));

  ngOnInit() {
    this.menuApi.getMenuByCategory().subscribe({
      next: m => { this.menu.set(m); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }
}