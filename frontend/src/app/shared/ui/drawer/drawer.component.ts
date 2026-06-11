import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';

/**
 * Выезжающая справа панель для форм создания/редактирования.
 *
 * @if (открыто) {
 *   <bd-drawer title="Новый товар" (closed)="...">форма</bd-drawer>
 * }
 */
@Component({
  selector: 'bd-drawer',
  standalone: true,
  template: `
<div class="fixed inset-0 z-50">
  <div class="absolute inset-0" style="background:rgba(0,0,0,.35)" (click)="closed.emit()"></div>
  <aside class="absolute right-0 top-0 bottom-0 w-full flex flex-col drawer-panel"
         style="max-width:420px;background:#fff;box-shadow:-8px 0 24px rgba(0,0,0,.12)">
    <header class="flex items-center justify-between gap-2 px-4 py-3"
            style="border-bottom:1px solid var(--color-border)">
      <h3 class="font-semibold text-sm truncate">{{ title }}</h3>
      <button (click)="closed.emit()" class="btn btn-ghost btn-sm" aria-label="Закрыть">✕</button>
    </header>
    <div class="flex-1 overflow-y-auto p-4">
      <ng-content />
    </div>
  </aside>
</div>
  `,
  styles: [`
    .drawer-panel { animation: bd-drawer-in .2s ease-out; }
    @keyframes bd-drawer-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
  `],
})
export class BdDrawerComponent {
  @Input() title = '';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.closed.emit(); }
}