import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../../core/services/api.service';
import { Shift } from '../../../core/models';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <h1 class="text-xl font-bold">📅 Смены</h1>
        <button (click)="createShift()" class="btn btn-primary">+ Открыть смену</button>
      </div>

      @for (shift of shifts(); track shift.id) {
        <div class="card">
          <div class="flex items-start justify-between mb-3">
            <div>
              <div class="flex items-center gap-2 mb-1">
                <h3 class="font-bold text-base">{{ formatDate(shift.date) }}</h3>
                @if (shift.is_open) {
                  <span class="badge badge-green">
                    <span class="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>Открыта
                  </span>
                } @else {
                  <span class="badge badge-gray">Закрыта</span>
                }
              </div>
              @if (shift.opened_by_name) {
                <p class="text-xs" style="color:var(--color-muted)">
                  Открыл: {{ shift.opened_by_name }}
                  @if (shift.closed_at) { &nbsp;· Закрыта: {{ formatTime(shift.closed_at) }} }
                </p>
              }
            </div>
            <div class="flex items-center gap-2">
              @if (shift.is_open) {
                <button (click)="closeShift(shift)" class="btn btn-ghost btn-sm">Закрыть смену</button>
              } @else {
                <button (click)="reopenShift(shift)" class="btn btn-ghost btn-sm">Открыть</button>
              }
              <button (click)="exportShift(shift)" class="btn btn-outline btn-sm">📥 Excel</button>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-3 pt-3" style="border-top:1px solid var(--color-border)">
            <div class="text-center">
              <p class="text-2xl font-bold">{{ shift.tickets_count }}</p>
              <p class="section-title mt-0.5">Билетов</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold">{{ shift.orders_count }}</p>
              <p class="section-title mt-0.5">Заказов</p>
            </div>
            <div class="text-center">
              <p class="text-2xl font-bold" style="color:var(--color-gold-hover)">
                {{ shift.total_revenue | number:'1.0-0' }} ₽
              </p>
              <p class="section-title mt-0.5">Выручка</p>
            </div>
          </div>
        </div>
      }

      @if (!shifts().length) {
        <div class="card text-center py-12">
          <span class="text-4xl block mb-3">📅</span>
          <p style="color:var(--color-muted)">Смен пока нет.</p>
        </div>
      }
    </div>
  `
})
export class ShiftsComponent implements OnInit {
  shifts = signal<Shift[]>([]);
  constructor(private api: ApiService) {}
  ngOnInit() { this.load(); }
  load() { this.api.getShifts().subscribe(s => this.shifts.set(s)); }
  createShift()   { this.api.createShift({}).subscribe(() => this.load()); }
  closeShift(s: Shift)  { this.api.closeShift(s.id).subscribe(() => this.load()); }
  reopenShift(s: Shift) { this.api.reopenShift(s.id).subscribe(() => this.load()); }
  exportShift(shift: Shift) {
    this.api.downloadExport(this.api.exportShift(shift.id)).subscribe(blob => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'bardream_shift_' + shift.date + '.xlsx'; a.click();
    });
  }
  formatDate(d: string) { return new Date(d).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }); }
  formatTime(dt: string) { return new Date(dt).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
}
