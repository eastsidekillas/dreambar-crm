import { Component, Input, Output, EventEmitter, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideChevronLeft, LucideListFilter, LucideCheck, LucideCalendar, LucideUsers } from '@lucide/angular';
import { Order, Zone, Reservation } from '../../../core/models';
import { OrderApi } from '../../../entities/order';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { BdBottomSheetComponent } from '../../../shared/ui';

/** Экран «Выберите стол»: тап по свободному столу → шторка с гостями → «Новый заказ». */
@Component({
  selector: 'new-table-sheet',
  standalone: true,
  imports: [CommonModule, FormsModule, BdBottomSheetComponent, LucideChevronLeft, LucideListFilter, LucideCheck, LucideCalendar, LucideUsers],
  template: `
    <div class="fixed inset-0 z-50 flex flex-col" style="background:var(--color-bg)">

      <!-- ── Шапка ──────────────────────────────────────────────── -->
      <div class="flex-shrink-0 flex items-center gap-2 px-3"
           style="min-height:54px;padding-top:env(safe-area-inset-top,0px);border-bottom:1px solid var(--color-border)">
        <button (click)="closed.emit()" class="flex items-center justify-center rounded-xl flex-shrink-0"
                style="width:38px;height:38px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-muted)">
          <svg lucideChevronLeft [size]="20"></svg>
        </button>
        <h2 class="flex-1 text-center font-bold text-base truncate">Выберите стол</h2>
        <button (click)="filterOpen.set(true)" title="Отделения"
                class="flex items-center justify-center rounded-xl flex-shrink-0"
                style="width:38px;height:38px;background:var(--color-surface);border:1px solid var(--color-border);color:var(--color-text)">
          <svg lucideListFilter [size]="18"></svg>
        </button>
      </div>

      <!-- ── Тело ───────────────────────────────────────────────── -->
      <div class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        @if (hasTables) {
          @for (z of visibleZones(); track z.id) {
            @if (z.tables.length) {
              <div>
                <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">{{ z.name }}</p>
                <div class="grid gap-2.5" style="grid-template-columns:repeat(auto-fill,minmax(96px,1fr))">
                  @for (t of z.tables; track t.id) {
                    <button (click)="openGuestSheet(t.number)"
                            [disabled]="isOccupied(t.number)"
                            class="rounded-xl px-2 py-2 flex flex-col items-center justify-center text-center transition-transform active:scale-[0.96]"
                            style="min-height:72px"
                            [style.background]="tableResv(t.number) ? '#eff6ff' : 'var(--color-surface2)'"
                            [style.color]="'var(--color-text)'"
                            [style.border]="tableResv(t.number) ? '1.5px solid #bfdbfe' : '1.5px solid var(--color-border)'"
                            [style.opacity]="isOccupied(t.number) ? '0.45' : '1'">
                      <span class="font-bold leading-tight"
                            style="font-size:13px;word-break:break-word;hyphens:auto">{{ t.number }}</span>
                      <span class="text-xs mt-1 leading-none"
                            [style.color]="tableResv(t.number) ? '#2563eb' : 'var(--color-muted)'">
                        {{ isOccupied(t.number) ? 'занят' : tableResv(t.number) ? 'бронь' : t.seats + ' мест' }}
                      </span>
                    </button>
                  }
                </div>
              </div>
            }
          }
        } @else {
          <div class="space-y-2">
            <input [(ngModel)]="fallback" placeholder="Стол 5, VIP-1, Бар" class="field" style="height:44px" />
            <button (click)="openGuestSheet(fallback.trim())" [disabled]="!fallback.trim()"
                    class="btn btn-primary btn-full" style="height:46px">Далее</button>
          </div>
        }
      </div>
    </div>

    <!-- ── Шторка: гости + «Новый заказ» ───────────────────────── -->
    @if (tapTable() !== null) {
      <bd-bottom-sheet [title]="'Стол ' + tapTable()" (closed)="tapTable.set(null)">
        <div class="px-4 pt-1 pb-4">
          @if (tableResv(tapTable()!); as resv) {
            <div class="rounded-xl px-3 py-2.5 mb-3" style="background:#eff6ff;border:1px solid #bfdbfe">
              <p class="text-xs font-semibold mb-0.5 flex items-center gap-1" style="color:#1d4ed8"><svg lucideCalendar [size]="12"></svg> Бронь</p>
              <p class="text-sm font-medium">{{ resv.name }} · {{ resv.time_start }}</p>
              <p class="text-xs flex items-center gap-0.5" style="color:#3b82f6"><svg lucideUsers [size]="12"></svg> {{ resv.guests_count }}
                @if (+resv.deposit_amount > 0) { · Депозит {{ +resv.deposit_amount | number:'1.0-0' }} ₽ }
              </p>
            </div>
          }

          <p class="text-xs font-semibold text-center mb-2" style="color:var(--color-muted)">КОЛИЧЕСТВО ГОСТЕЙ</p>
          <div class="flex items-center justify-center gap-5 mb-1">
            <button (click)="tapGuests.set(tapGuests() > 1 ? tapGuests() - 1 : 1)"
                    class="flex items-center justify-center rounded-full font-bold"
                    style="width:46px;height:46px;background:var(--color-bg);border:1.5px solid var(--color-border);color:var(--color-text);font-size:1.4rem">−</button>
            <span class="font-bold" style="font-size:2rem;min-width:48px;text-align:center">{{ tapGuests() }}</span>
            <button (click)="tapGuests.set(tapGuests() + 1)"
                    class="flex items-center justify-center rounded-full font-bold text-white"
                    style="width:46px;height:46px;background:var(--color-gold);font-size:1.4rem">＋</button>
          </div>
        </div>
        <div sheet-footer class="px-4 pt-2 pb-4" style="border-top:1px solid var(--color-border)">
          <button (click)="createNew()" [disabled]="creating()"
                  class="btn btn-primary btn-full" style="height:50px">
            {{ creating() ? '...' : 'Новый заказ' }}
          </button>
        </div>
      </bd-bottom-sheet>
    }

    <!-- ── Шторка фильтра отделений ─────────────────────────────── -->
    @if (filterOpen()) {
      <bd-bottom-sheet title="Показывать отделения" (closed)="filterOpen.set(false)">
        <div class="pb-1">
          @for (z of zones; track z.id) {
            <button (click)="toggleZone(z.id)"
                    class="w-full flex items-center justify-between px-4 py-3.5 text-left"
                    style="border-top:1px solid var(--color-border)">
              <span class="text-sm font-medium">{{ z.name }}</span>
              <span class="flex items-center justify-center rounded-md flex-shrink-0"
                    style="width:24px;height:24px"
                    [style.background]="isZoneVisible(z.id) ? 'var(--color-gold)' : 'transparent'"
                    [style.border]="isZoneVisible(z.id) ? 'none' : '1.5px solid var(--color-border-mid)'">
                @if (isZoneVisible(z.id)) { <svg lucideCheck [size]="15" style="color:white"></svg> }
              </span>
            </button>
          }
        </div>
        <div sheet-footer class="px-4 py-3" style="border-top:1px solid var(--color-border)">
          <button (click)="filterOpen.set(false)" class="btn btn-primary btn-full" style="height:46px">Готово</button>
        </div>
      </bd-bottom-sheet>
    }
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
  /** Префилл с плана зала (тап по брони) — сразу открываем шторку гостей. */
  @Input() set prefill(tables: string[]) {
    const t = (tables ?? [])[0];
    if (t) this.openGuestSheet(t);
  }

  @Output() created = new EventEmitter<Order>();
  @Output() closed  = new EventEmitter<void>();

  fallback = '';
  creating = signal(false);

  tapTable  = signal<string | null>(null);   // стол, для которого открыта шторка гостей
  tapGuests = signal(1);

  filterOpen    = signal(false);
  hiddenZoneIds = signal<Set<number>>(new Set());

  get hasTables(): boolean { return this.zones.some(z => z.tables.length > 0); }
  isOccupied(num: string): boolean { return this.occupied.has(num); }
  tableResv(num: string): Reservation | undefined { return this.reservations.find(r => r.table_number === num); }

  // ── Фильтр отделений ────────────────────────────────────────────
  visibleZones(): Zone[] { const h = this.hiddenZoneIds(); return this.zones.filter(z => !h.has(z.id)); }
  isZoneVisible(id: number): boolean { return !this.hiddenZoneIds().has(id); }
  toggleZone(id: number) {
    this.hiddenZoneIds.update(set => {
      const next = new Set(set);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  openGuestSheet(num: string) {
    if (!num || this.isOccupied(num)) return;
    this.tapGuests.set(this.tableResv(num)?.guests_count || 1);
    this.tapTable.set(num);
  }

  createNew() {
    const num = this.tapTable();
    if (!num || this.creating()) return;
    if (!this.shiftId) { this.toast.error('Нет открытой смены'); return; }
    this.creating.set(true);
    this.orderApi.createOrder({
      shift: this.shiftId, table_number: num,
      guests: this.tapGuests(), notes: '', items: [],
      // Зарезервированный стол → привязываем бронь, чтобы депозит дошёл до чекаута/чека.
      reservation: this.tableResv(num)?.id ?? null,
    }).subscribe({
      next: order => { this.creating.set(false); this.created.emit(order); },
      error: err => {
        this.creating.set(false);
        this.toast.apiError(err, 'Не удалось открыть стол');
        if (err?.status === 409) this.closed.emit();   // стол уже заняли — закрыть, план обновится
      },
    });
  }
}