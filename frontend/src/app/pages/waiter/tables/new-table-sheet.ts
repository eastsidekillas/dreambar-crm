import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideUtensilsCrossed, LucideX, LucideCalendar, LucideUsers } from '@lucide/angular';
import { Order, Zone, Reservation } from '../../../core/models';
import { OrderApi } from '../../../entities/order';
import { ToastService } from '../../../shared/ui/toast/toast.service';

/** Шторка «Открыть стол»: выбор стола(ов), гости, заметка → создание заказа. */
@Component({
  selector: 'new-table-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideUtensilsCrossed, LucideX, LucideCalendar, LucideUsers],
  template: `
    <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closed.emit()"></div>
    <div class="fixed bottom-0 left-0 right-0 z-[60] flex flex-col rounded-t-2xl"
         style="background:white;max-height:88dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
      <div class="flex justify-center pt-3 pb-1 flex-shrink-0 cursor-pointer" (click)="closed.emit()">
        <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
      </div>
      <div class="flex items-center justify-between px-4 py-3 flex-shrink-0"
           style="border-bottom:1px solid var(--color-border)">
        <h2 class="font-bold text-base flex items-center gap-2"><svg lucideUtensilsCrossed [size]="16"></svg> Открыть стол</h2>
        <button (click)="closed.emit()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
      </div>
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">

        <!-- Table selection -->
        <div>
          <div class="flex items-center justify-between mb-2">
            <label class="section-title">Стол / зона</label>
            @if (selected.length > 1) {
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style="background:var(--color-gold);color:white">{{ selected.join('+') }}</span>
            }
          </div>

          @if (hasTables) {
            <div class="space-y-3">
              @for (z of zones; track z.id) {
                @if (z.tables.length) {
                  <div>
                    <p class="text-xs font-medium mb-1.5" style="color:var(--color-muted)">{{ z.name }}</p>
                    <div class="grid gap-1.5" style="grid-template-columns:repeat(auto-fill,minmax(72px,1fr))">
                      @for (t of z.tables; track t.id) {
                        <button (click)="onSelect(t.number)"
                                [disabled]="isOccupied(t.number)"
                                class="rounded-xl py-2 px-1 text-center transition-all"
                                [style]="isOccupied(t.number)
                                  ? 'background:var(--color-surface2);opacity:0.4;cursor:not-allowed'
                                  : isSel(t.number)
                                    ? 'background:var(--color-gold);color:white;border:2px solid var(--color-gold)'
                                    : 'background:var(--color-surface2);border:2px solid transparent'">
                          <p class="font-bold text-sm leading-none">{{ t.number }}</p>
                          <p class="text-xs mt-0.5">
                            {{ isOccupied(t.number) ? 'занят' : isSel(t.number) ? '✓ выбран' : t.seats + ' мест' }}
                          </p>
                        </button>
                      }
                    </div>
                  </div>
                }
              }
            </div>

            @if (selected.length > 1) {
              <p class="text-xs mt-2 text-center font-medium" style="color:var(--color-gold-hover)">
                Объединённый стол: {{ selected.join('+') }}
              </p>
            }
          } @else {
            <input [(ngModel)]="fallback" placeholder="Стол 5, VIP-1, Бар"
                   class="field" style="height:44px" />
          }
        </div>

        <!-- Reservation badge (single table) -->
        @if (selected.length === 1 && tableResv(selected[0])) {
          @let resv = tableResv(selected[0])!;
          <div class="rounded-xl px-3 py-2.5" style="background:#eff6ff;border:1px solid #bfdbfe">
            <p class="text-xs font-semibold mb-0.5 flex items-center gap-1" style="color:#1d4ed8"><svg lucideCalendar [size]="12"></svg> Бронь на этом столе</p>
            <p class="text-sm font-medium">{{ resv.name }} · {{ resv.time_start }}</p>
            <p class="text-xs flex items-center gap-0.5" style="color:#3b82f6"><svg lucideUsers [size]="12"></svg> {{ resv.guests_count }}
              @if (+resv.deposit_amount > 0) { · Депозит {{ +resv.deposit_amount | number:'1.0-0' }} ₽ }
            </p>
            @if (resv.wishes) {
              <p class="text-xs mt-0.5" style="color:var(--color-muted)">{{ resv.wishes }}</p>
            }
          </div>
        }

        <div>
          <label class="section-title block mb-1.5">Гостей</label>
          <input [(ngModel)]="guests" type="number" min="0" class="field" style="height:44px" />
        </div>
        <div>
          <label class="section-title block mb-1.5">Комментарий</label>
          <textarea [(ngModel)]="notes" placeholder="Аллергия, пожелания…"
                    class="field" rows="2" style="resize:none"></textarea>
        </div>
        <button (click)="create()"
                [disabled]="creating() || (!selected.length && !fallback.trim())"
                class="btn btn-primary btn-full" style="height:48px">
          {{ creating() ? '...' : 'Открыть стол → меню' }}
        </button>
      </div>
    </div>
  `,
})
export class NewTableSheet {
  private orderApi = inject(OrderApi);
  private toast = inject(ToastService);

  @Input() zones: Zone[] = [];
  /** Номера занятых столов (нельзя открыть повторно). */
  @Input() occupied = new Set<string>();
  @Input() reservations: Reservation[] = [];
  @Input() shiftId: number | null = null;
  @Input() set prefill(tables: string[]) { this.selected = [...(tables ?? [])]; }

  @Output() created = new EventEmitter<Order>();
  @Output() closed  = new EventEmitter<void>();

  selected: string[] = [];
  fallback = '';
  guests: number | null = null;
  notes = '';
  creating = signal(false);

  get hasTables(): boolean { return this.zones.some(z => z.tables.length > 0); }
  isOccupied(num: string): boolean { return this.occupied.has(num); }
  isSel(num: string): boolean { return this.selected.includes(num); }
  tableResv(num: string): Reservation | undefined { return this.reservations.find(r => r.table_number === num); }

  onSelect(num: string) {
    if (this.isOccupied(num)) return;
    this.selected = this.isSel(num) ? this.selected.filter(t => t !== num) : [...this.selected, num];
  }

  create() {
    const tableNumber = this.selected.length ? this.selected.join('+') : this.fallback.trim();
    if (this.creating() || !tableNumber) return;
    if (!this.shiftId) { this.toast.error('Нет открытой смены'); return; }
    this.creating.set(true);
    this.orderApi.createOrder({
      shift: this.shiftId, table_number: tableNumber,
      guests: this.guests || 0, notes: this.notes.trim(), items: [],
    }).subscribe({
      next: order => { this.creating.set(false); this.created.emit(order); },
      error: () => { this.creating.set(false); this.toast.error('Не удалось открыть стол'); },
    });
  }
}