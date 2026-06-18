import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BdBottomSheetComponent } from '../../../shared/ui';

/** Шторка «Депозит стола»: сумма + способ (нал/перевод). Презентационная —
 *  запрос ведёт OrderPage. 0 = снять депозит. */
@Component({
  selector: 'deposit-sheet',
  standalone: true,
  imports: [CommonModule, BdBottomSheetComponent],
  template: `
    <bd-bottom-sheet title="Депозит стола" (closed)="closed.emit()">
      <div class="px-4 pt-1 pb-4">
        <p class="text-xs mb-3" style="color:var(--color-muted)">
          Сумма, внесённая гостем как депозит. При оплате спишется со счёта, остаток вернётся.
        </p>

        <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">СУММА, ₽</p>
        <input [value]="amount()" (input)="onAmount($event)" type="number" inputmode="numeric"
               placeholder="0" class="field mb-4" style="height:48px;font-size:1.25rem;font-weight:700" />

        <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">СПОСОБ</p>
        <div class="flex gap-2">
          @for (m of methods; track m.value) {
            <button (click)="method.set(m.value)"
                    class="rounded-xl text-sm font-semibold" style="flex:1;height:44px;border:1.5px solid"
                    [style.background]="method() === m.value ? 'var(--color-gold)' : 'var(--color-bg)'"
                    [style.color]="method() === m.value ? 'white' : 'var(--color-text)'"
                    [style.border-color]="method() === m.value ? 'var(--color-gold)' : 'var(--color-border)'">
              {{ m.label }}
            </button>
          }
        </div>
      </div>

      <div sheet-footer class="px-4 pt-2 pb-4 flex gap-2" style="border-top:1px solid var(--color-border)">
        @if (initialAmount > 0) {
          <button (click)="save.emit({ amount: 0, method: '' })" [disabled]="saving"
                  class="rounded-xl flex-shrink-0 text-sm font-semibold"
                  style="padding:0 16px;height:48px;color:var(--color-red);background:var(--color-red-bg)">Снять</button>
        }
        <button (click)="save.emit({ amount: amount() || 0, method: method() })"
                [disabled]="saving || (amount() > 0 && !method())"
                class="btn btn-primary" style="flex:1;height:48px">
          {{ saving ? '...' : 'Сохранить' }}
        </button>
      </div>
    </bd-bottom-sheet>
  `,
})
export class DepositSheet {
  @Input() set deposit(v: { amount: number; method: string }) {
    this.initialAmount = v.amount;
    this.amount.set(v.amount || 0);
    this.method.set(v.method || 'cash');
  }
  @Input() saving = false;

  @Output() save   = new EventEmitter<{ amount: number; method: string }>();
  @Output() closed = new EventEmitter<void>();

  initialAmount = 0;
  amount = signal(0);
  method = signal('cash');
  methods = [{ value: 'cash', label: 'Наличные' }, { value: 'transfer', label: 'Перевод' }];

  onAmount(e: Event) { this.amount.set(Math.max(0, +(e.target as HTMLInputElement).value || 0)); }
}