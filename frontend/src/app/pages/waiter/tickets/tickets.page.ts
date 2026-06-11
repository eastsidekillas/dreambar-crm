import { Component, OnInit, signal } from '@angular/core';
import { formatTime as fmtTime } from '../../../shared/lib/formatters';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShiftApi } from '../../../entities/shift';
import { TicketApi } from '../../../entities/ticket';
import { EntryTicket } from '../../../core/models';
import { LucideTicket, LucidePackage } from '@lucide/angular';

@Component({
  selector: 'app-tickets-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideTicket, LucidePackage],
  template: `
    <div class="space-y-4 pb-4">

      <!-- Stats -->
      <div class="grid grid-cols-2 gap-3">
        <div class="card text-center">
          <p class="text-3xl font-bold" style="color:var(--color-text)">{{ tickets().length }}</p>
          <p class="text-xs mt-1 section-title">Продано билетов</p>
        </div>
        <div class="card text-center">
          <p class="text-3xl font-bold" style="color:var(--color-gold-hover)">{{ totalRevenue() | number:'1.0-0' }}</p>
          <p class="text-xs mt-1 section-title">Рублей собрано</p>
        </div>
      </div>

      <!-- Add single ticket -->
      <div class="card">
        <h3 class="font-semibold mb-3 flex items-center gap-2">
          <svg lucideTicket [size]="18"></svg> Добавить билет
        </h3>
        <div class="flex gap-2 mb-3">
          <input [(ngModel)]="newBracelet"
                 placeholder="Номер браслета"
                 class="field flex-1" style="height:44px"
                 (keydown.enter)="addTicket()"/>
          <div style="width:90px">
            <input [(ngModel)]="ticketPrice" type="number"
                   class="field" style="height:44px;text-align:center"
                   placeholder="Цена"/>
          </div>
        </div>
        <button (click)="addTicket()" [disabled]="!newBracelet || adding()"
                class="btn btn-primary btn-full">
          {{ adding() ? '... Добавление...' : '+ Добавить билет' }}
        </button>
      </div>

      <!-- Range -->
      <div class="card">
        <h3 class="font-semibold mb-3 flex items-center gap-2">
          <svg lucidePackage [size]="18"></svg> Диапазон браслетов
        </h3>
        <div class="grid grid-cols-3 gap-2 mb-3">
          <div>
            <label class="section-title block mb-1">ОТ №</label>
            <input [(ngModel)]="rangeStart" type="number" placeholder="190000"
                   class="field" style="height:44px"/>
          </div>
          <div>
            <label class="section-title block mb-1">ДО №</label>
            <input [(ngModel)]="rangeEnd" type="number" placeholder="190050"
                   class="field" style="height:44px"/>
          </div>
          <div>
            <label class="section-title block mb-1">ЦЕНА</label>
            <input [(ngModel)]="ticketPrice" type="number"
                   class="field" style="height:44px"/>
          </div>
        </div>
        <button (click)="addRange()" [disabled]="!rangeStart || !rangeEnd || adding()"
                class="btn btn-outline btn-full">
          {{ adding() ? '... Добавление...' : 'Добавить диапазон' }}
        </button>
      </div>

      <!-- Ticket list -->
      <div class="card">
        <div class="flex items-center justify-between mb-3">
          <h3 class="font-semibold">Список билетов</h3>
          <span class="badge badge-gold">{{ tickets().length }} шт</span>
        </div>

        @for (t of tickets(); track t.id) {
          <div class="flex items-center justify-between py-2.5"
               style="border-bottom:1px solid var(--color-border)">
            <div class="flex items-center gap-2">
              <svg lucideTicket [size]="14"></svg>
              <span class="font-mono text-sm font-medium">{{ t.bracelet_number }}</span>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-xs" style="color:var(--color-muted)">{{ formatTime(t.sold_at) }}</span>
              <span class="font-bold text-sm" style="color:var(--color-gold-hover)">{{ t.price | number:'1.0-0' }} ₽</span>
            </div>
          </div>
        }

        @if (!tickets().length) {
          <div class="text-center py-8">
            <svg lucideTicket [size]="40" class="mx-auto mb-2" style="color:var(--color-muted)"></svg>
            <p style="color:var(--color-muted)">Билетов пока нет</p>
          </div>
        }
      </div>

      @if (msg()) {
        <div class="fixed top-20 left-4 right-4 z-50 p-3 rounded-xl text-sm font-medium text-center"
             [class]="msgOk() ? 'badge-green' : 'badge-red'"
             style="box-shadow:0 4px 16px rgba(0,0,0,0.15)">
          {{ msg() }}
        </div>
      }
    </div>
  `
})
export class TicketsPage implements OnInit {
  tickets     = signal<EntryTicket[]>([]);
  newBracelet = '';
  ticketPrice = 200;
  rangeStart: number | null = null;
  rangeEnd:   number | null = null;
  adding = signal(false);
  msg    = signal('');
  msgOk  = signal(true);
  private shiftId: number | null = null;

  totalRevenue() { return this.tickets().reduce((s, t) => s + +t.price, 0); }

  formatTime(dt: string) { return fmtTime(dt); }

  constructor(private shiftApi: ShiftApi, private ticketApi: TicketApi) {}

  ngOnInit() {
    this.shiftApi.getCurrentShift().subscribe({ next: s => { this.shiftId = s.id; this.load(); } });
  }

  load() {
    if (!this.shiftId) return;
    this.ticketApi.getTickets(this.shiftId).subscribe(t => this.tickets.set(t));
  }

  addTicket() {
    if (!this.shiftId || !this.newBracelet) return;
    this.adding.set(true);
    this.ticketApi.createTicket({ shift: this.shiftId, bracelet_number: this.newBracelet, price: this.ticketPrice })
      .subscribe({
        next: t => { this.tickets.update(l => [t, ...l]); this.newBracelet = ''; this.adding.set(false); this.show('Билет добавлен', true); },
        error: () => { this.adding.set(false); this.show('Ошибка: такой браслет уже есть', false); }
      });
  }

  addRange() {
    if (!this.shiftId || !this.rangeStart || !this.rangeEnd) return;
    this.adding.set(true);
    this.ticketApi.bulkCreateTickets({ shift: this.shiftId, start: this.rangeStart, end: this.rangeEnd, price: this.ticketPrice })
      .subscribe({
        next: r => { this.load(); this.rangeStart = null; this.rangeEnd = null; this.adding.set(false); this.show(`Добавлено ${r.created} билетов`, true); },
        error: () => { this.adding.set(false); this.show('Ошибка при добавлении', false); }
      });
  }

  private show(m: string, ok = true) { this.msgOk.set(ok); this.msg.set(m); setTimeout(() => this.msg.set(''), 2500); }
}
