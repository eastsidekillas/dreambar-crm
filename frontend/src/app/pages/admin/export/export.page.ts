import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Shift } from '../../../core/models';

@Component({
  selector: 'app-export',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5 max-w-xl">
      <h1 class="text-xl font-bold">📥 Экспорт в Excel</h1>

      <div class="card">
        <h3 class="font-semibold mb-1">Полный отчёт за период</h3>
        <p class="text-sm mb-4" style="color:var(--color-muted)">
          Листы Excel: <b>Сводная</b> (по дням) · <b>Сотрудники</b> (кто сколько заработал) ·
          <b>Входные билеты</b> (с кем продан каждый) · <b>Все заказы</b> (детально, с официантом) ·
          отдельный лист на каждую смену.
        </p>
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label class="section-title block mb-1">Дата от</label>
            <input type="date" [(ngModel)]="dateFrom" class="field" style="color-scheme:light"/>
          </div>
          <div>
            <label class="section-title block mb-1">Дата до</label>
            <input type="date" [(ngModel)]="dateTo" class="field" style="color-scheme:light"/>
          </div>
        </div>
        <button (click)="downloadReport()" [disabled]="downloading()" class="btn btn-primary btn-full btn-lg">
          {{ downloading() ? '⏳ Формирование файла...' : '📥 Скачать сводный отчёт' }}
        </button>
      </div>

      <div class="card">
        <h3 class="font-semibold mb-3">Отчёт по отдельной смене</h3>
        <div class="space-y-2 max-h-72 overflow-y-auto">
          @for (shift of shifts(); track shift.id) {
            <div class="flex items-center justify-between py-2" style="border-bottom:1px solid var(--color-border)">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium">{{ formatDate(shift.date) }}</span>
                @if (shift.is_open) { <span class="badge badge-green">Открыта</span> }
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-bold" style="color:var(--color-gold-hover)">
                  {{ shift.total_revenue | number:'1.0-0' }} ₽
                </span>
                <button (click)="downloadShift(shift)" class="btn btn-outline btn-sm">📥 Excel</button>
              </div>
            </div>
          }
          @if (!shifts().length) {
            <p class="text-sm text-center py-4" style="color:var(--color-muted)">Смен нет</p>
          }
        </div>
      </div>

      @if (msg()) {
        <div class="p-3 rounded-xl text-sm font-medium text-center"
             [class]="msg().startsWith('✅') ? 'badge-green' : 'badge-red'"
             style="padding:12px">{{ msg() }}</div>
      }
    </div>
  `
})
export class ExportComponent implements OnInit {
  shifts = signal<Shift[]>([]); dateFrom = ''; dateTo = ''; downloading = signal(false); msg = signal('');
  constructor(private api: ApiService) {}
  ngOnInit() { this.api.getShifts().subscribe(s => this.shifts.set(s)); }
  downloadReport() {
    this.downloading.set(true);
    this.api.downloadExport(this.api.exportReport(this.dateFrom || undefined, this.dateTo || undefined)).subscribe({
      next: blob => { this.downloading.set(false); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bardream_report_' + new Date().toISOString().slice(0,10) + '.xlsx'; a.click(); this.show('✅ Отчёт скачан'); },
      error: () => { this.downloading.set(false); this.show('❌ Ошибка при формировании'); }
    });
  }
  downloadShift(shift: Shift) {
    this.api.downloadExport(this.api.exportShift(shift.id)).subscribe({ next: blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'bardream_shift_' + shift.date + '.xlsx'; a.click(); this.show('✅ Файл скачан'); }, error: () => this.show('❌ Ошибка') });
  }
  formatDate(d: string) { return new Date(d).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'long' }); }
  private show(m: string) { this.msg.set(m); setTimeout(() => this.msg.set(''), 3000); }
}
