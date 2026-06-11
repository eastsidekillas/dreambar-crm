import { Component, Directive, ElementRef, HostListener, Injectable, computed, effect, inject, signal } from '@angular/core';

/**
 * Встроенная сенсорная клавиатура для терминалов без физической клавиатуры
 * (Windows-моноблок, где системная экранная клавиатура не выезжает в браузере).
 *
 * Подключение на странице:
 *   1. Повесить атрибут bdKbd на input'ы.
 *   2. Добавить <bd-touch-keyboard /> в конец шаблона.
 * Для type="tel" и type="number" открывается цифровой слой.
 */
@Injectable({ providedIn: 'root' })
export class TouchKeyboardService {
  readonly active = signal<HTMLInputElement | null>(null);
  open(el: HTMLInputElement) { this.active.set(el); }
  close(el?: HTMLInputElement) {
    if (!el || this.active() === el) this.active.set(null);
  }
}

@Directive({ selector: 'input[bdKbd]', standalone: true })
export class TouchKeyboardDirective {
  private el  = inject<ElementRef<HTMLInputElement>>(ElementRef);
  private kbd = inject(TouchKeyboardService);

  @HostListener('focus') onFocus() { this.kbd.open(this.el.nativeElement); }
  @HostListener('blur')  onBlur()  { this.kbd.close(this.el.nativeElement); }
}

const RU_ROWS = [
  ['й', 'ц', 'у', 'к', 'е', 'н', 'г', 'ш', 'щ', 'з', 'х', 'ъ'],
  ['ф', 'ы', 'в', 'а', 'п', 'р', 'о', 'л', 'д', 'ж', 'э'],
  ['я', 'ч', 'с', 'м', 'и', 'т', 'ь', 'б', 'ю'],
];
const EN_ROWS = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
];
const NUM_ROWS = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '-', '(', ')', '.', ',', '/', '№'],
];

@Component({
  selector: 'bd-touch-keyboard',
  standalone: true,
  template: `
@if (kbd.active()) {
  <div class="fixed bottom-0 left-0 right-0 select-none"
       style="z-index:70;background:#0a0f1e;border-top:1px solid #334155;padding:8px 6px calc(8px + env(safe-area-inset-bottom))"
       (pointerdown)="$event.preventDefault()">

    @for (row of rows(); track $index) {
      <div class="flex justify-center mb-1.5">
        @for (key of row; track key) {
          <button (click)="press(key)" class="kbd-key flex-1" style="max-width:64px">
            {{ shift() ? key.toUpperCase() : key }}
          </button>
        }
      </div>
    }

    <div class="flex justify-center">
      @if (layer() !== 'num') {
        <button (click)="shift.set(!shift())" class="kbd-key" style="min-width:64px"
                [style.background]="shift() ? '#f59e0b' : '#1e293b'"
                [style.color]="shift() ? '#0f172a' : '#f1f5f9'">⇧</button>
        <button (click)="layer.set(layer() === 'ru' ? 'en' : 'ru')" class="kbd-key" style="min-width:64px">
          {{ layer() === 'ru' ? 'EN' : 'РУС' }}
        </button>
        <button (click)="layer.set('num')" class="kbd-key" style="min-width:64px">?123</button>
      } @else {
        <button (click)="layer.set('ru')" class="kbd-key" style="min-width:96px">АБВ</button>
      }
      <button (click)="press(' ')" class="kbd-key flex-1" style="max-width:340px">Пробел</button>
      <button (click)="backspace()" class="kbd-key" style="min-width:72px">⌫</button>
      <button (click)="done()" class="kbd-key" style="min-width:96px;background:#22c55e;color:#0f172a">Готово</button>
    </div>
  </div>
}
  `,
  styles: [`
    .kbd-key {
      margin: 0 2px;
      min-height: 48px;
      border-radius: 10px;
      border: none;
      background: #1e293b;
      color: #f1f5f9;
      font-size: 1.05rem;
      font-weight: 600;
      cursor: pointer;
    }
    .kbd-key:active { background: #334155; }
  `],
})
export class TouchKeyboardComponent {
  kbd   = inject(TouchKeyboardService);
  layer = signal<'ru' | 'en' | 'num'>('ru');
  shift = signal(false);

  rows = computed(() =>
    this.layer() === 'ru' ? RU_ROWS : this.layer() === 'en' ? EN_ROWS : NUM_ROWS
  );

  constructor() {
    // При фокусе на поле выбираем слой и заглавную букву для пустого поля
    effect(() => {
      const el = this.kbd.active();
      if (!el) return;
      const numeric = el.type === 'tel' || el.type === 'number' || el.inputMode === 'numeric';
      this.layer.set(numeric ? 'num' : 'ru');
      this.shift.set(!numeric && !el.value);
    });
  }

  press(key: string) {
    this.insert(this.shift() ? key.toUpperCase() : key);
    if (this.shift()) this.shift.set(false);
  }

  backspace() {
    const el = this.kbd.active();
    if (!el) return;
    if (el.type === 'number') {
      el.value = el.value.slice(0, -1);
    } else {
      const s = el.selectionStart ?? el.value.length;
      const e = el.selectionEnd ?? s;
      if (e > s) el.setRangeText('', s, e, 'end');
      else if (s > 0) el.setRangeText('', s - 1, e, 'end');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }

  done() {
    this.kbd.active()?.blur();
    this.kbd.close();
  }

  private insert(text: string) {
    const el = this.kbd.active();
    if (!el) return;
    if (el.type === 'number') {
      // selection API недоступен у type=number — просто дописываем
      el.value = el.value + text;
    } else {
      const s = el.selectionStart ?? el.value.length;
      const e = el.selectionEnd ?? s;
      el.setRangeText(text, s, e, 'end');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
}
