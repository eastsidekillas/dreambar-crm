import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucidePencil, LucideReceipt, LucideArrowLeftRight, LucideTrash2 } from '@lucide/angular';
import { BdBottomSheetComponent } from '../../../shared/ui';

/** Состояние гостя для набора действий: пусто / активен (позиции не готовы) / готов (всё готово). */
export type GuestState = 'empty' | 'active' | 'ready';

/** Меню гостя («…»). Набор пунктов зависит от [state]:
 *  - empty  → Переименовать, Удалить (убрать пустой слот)
 *  - active → Переименовать, Распечатать счёт, Перенести в новый заказ, Удалить
 *  - ready  → Переименовать, Перенести в новый заказ (блюда готовы — менять состав нельзя,
 *             но гостя можно увести на новый стол).
 *  «Перенести» доступен при любых неоплаченных позициях (active/ready); для empty скрыт —
 *  переносить нечего, backend вернёт 400. */
@Component({
  selector: 'guest-menu-sheet',
  standalone: true,
  imports: [CommonModule, LucidePencil, LucideReceipt, LucideArrowLeftRight, LucideTrash2, BdBottomSheetComponent],
  template: `
    <bd-bottom-sheet [title]="label" (closed)="closed.emit()">
      @if (renameMode()) {
        <div class="px-4 pt-1 pb-5 space-y-3">
          <input [value]="renameValue()" (input)="renameValue.set($any($event.target).value)"
                 placeholder="Имя гостя" class="field" style="height:46px"
                 (keyup.enter)="emitRename()" />
          <div class="flex gap-2">
            <button (click)="renameMode.set(false)" class="btn btn-ghost" style="flex:1;height:46px">Отмена</button>
            <button (click)="emitRename()" class="btn btn-primary" style="flex:1;height:46px">Сохранить</button>
          </div>
        </div>
      } @else {
        <div class="pb-2">
          <button (click)="startRename()"
                  class="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
                  style="border-top:1px solid var(--color-border)">
            <svg lucidePencil [size]="17" style="color:var(--color-muted)"></svg> Переименовать
          </button>
          @if (state === 'active') {
            <button (click)="precheck.emit()"
                    class="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
                    style="border-top:1px solid var(--color-border)">
              <svg lucideReceipt [size]="17" style="color:var(--color-muted)"></svg> Распечатать счёт
            </button>
          }
          @if (state !== 'empty') {
            <button (click)="split.emit()"
                    class="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
                    style="border-top:1px solid var(--color-border)">
              <svg lucideArrowLeftRight [size]="17" style="color:var(--color-muted)"></svg> Перенести в новый заказ
            </button>
          }
          @if (state !== 'ready') {
            <button (click)="delete.emit()"
                    class="w-full flex items-center gap-3 px-4 py-3.5 text-left text-sm font-medium"
                    style="border-top:1px solid var(--color-border);color:var(--color-red)">
              <svg lucideTrash2 [size]="17"></svg> Удалить{{ state === 'empty' ? ' гостя' : '' }}
            </button>
          }
        </div>
      }
    </bd-bottom-sheet>
  `,
})
export class GuestMenuSheet {
  @Input() label = '';
  /** Текущее имя гостя — подставляется в поле при входе в режим переименования. */
  @Input() currentName = '';
  /** Состояние гостя — определяет набор пунктов меню. */
  @Input() state: GuestState = 'empty';

  @Output() rename   = new EventEmitter<string>();   // новое имя
  @Output() precheck = new EventEmitter<void>();      // распечатать счёт
  @Output() split    = new EventEmitter<void>();      // перенести в новый заказ
  @Output() delete   = new EventEmitter<void>();      // удалить (пустого — слот, активного — позиции)
  @Output() closed   = new EventEmitter<void>();

  renameMode  = signal(false);
  renameValue = signal('');

  startRename() { this.renameValue.set(this.currentName); this.renameMode.set(true); }
  emitRename()  { this.rename.emit(this.renameValue().trim()); }
}