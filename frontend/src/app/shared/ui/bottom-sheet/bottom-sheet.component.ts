import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideX } from '@lucide/angular';

/**
 * Нижняя шторка: фон, скруглённый верх, хваталка, заголовок, анимация выезжания.
 * Рендерится родителем через `@if`. Контент проецируется внутрь;
 * необязательный футер — через `[sheet-footer]`.
 *
 * @if (open()) {
 *   <bd-bottom-sheet title="Отправить на печать" (closed)="open.set(false)">
 *     …контент…
 *     <div sheet-footer>…кнопки…</div>
 *   </bd-bottom-sheet>
 * }
 */
@Component({
  selector: 'bd-bottom-sheet',
  standalone: true,
  imports: [CommonModule, LucideX],
  template: `
    <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closed.emit()"></div>
    <div class="fixed bottom-0 inset-x-0 z-[60] flex flex-col bd-sheet-anim"
         [style.max-height]="maxHeight"
         style="background:white;border-radius:20px 20px 0 0;box-shadow:0 -8px 32px rgba(0,0,0,0.18);padding-bottom:env(safe-area-inset-bottom)">

      <div class="flex justify-center pt-2 pb-1 flex-shrink-0 cursor-pointer" (click)="closed.emit()">
        <div class="w-9 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
      </div>

      @if (title) {
        <div class="flex items-center justify-between px-4 pb-2 flex-shrink-0">
          <h2 class="font-bold text-lg truncate">{{ title }}</h2>
          <button (click)="closed.emit()" class="flex items-center justify-center rounded-full flex-shrink-0"
                  style="width:32px;height:32px;background:var(--color-bg);color:var(--color-muted)" aria-label="Закрыть">
            <svg lucideX [size]="16"></svg>
          </button>
        </div>
      }

      <div class="flex-1 min-h-0 overflow-y-auto"><ng-content /></div>
      <ng-content select="[sheet-footer]" />
    </div>
  `,
  styles: [`
    .bd-sheet-anim { animation: bd-sheet-up .28s cubic-bezier(.22,1,.36,1); }
    @keyframes bd-sheet-up { from { transform: translateY(100%); } to { transform: translateY(0); } }
  `],
})
export class BdBottomSheetComponent {
  /** Заголовок шторки (с крестиком). Без него — только хваталка. */
  @Input() title = '';
  /** Максимальная высота шторки. */
  @Input() maxHeight = '92dvh';
  @Output() closed = new EventEmitter<void>();

  @HostListener('document:keydown.escape')
  onEsc() { this.closed.emit(); }
}