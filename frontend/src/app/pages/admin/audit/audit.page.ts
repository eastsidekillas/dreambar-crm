import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsApi } from '../../../entities/analytics';
import { EmployeeApi } from '../../../entities/employee';
import { ShiftApi } from '../../../entities/shift';
import { DeletedOrderItem, Shift, Employee } from '../../../core/models';
import { LucideTrash2 } from '@lucide/angular';

@Component({
  selector: 'app-audit',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideTrash2],
  template: `
    <div class="space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideTrash2 [size]="20"></svg> Удалённые позиции</h1>
        <span class="text-sm" style="color:var(--color-muted)">
          {{ items().length }} записей
          @if (totalAmount() > 0) {
            · {{ totalAmount() | number:'1.0-0' }} ₽
          }
        </span>
      </div>

      <!-- Фильтры -->
      <div class="card">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label class="section-title block mb-1">Смена</label>
            <select [(ngModel)]="filterShift" (ngModelChange)="load()" class="field">
              <option [ngValue]="null">Все смены</option>
              @for (s of shifts(); track s.id) {
                <option [ngValue]="s.id">{{ s.date }}</option>
              }
            </select>
          </div>
          <div>
            <label class="section-title block mb-1">Сотрудник</label>
            <select [(ngModel)]="filterUser" (ngModelChange)="load()" class="field">
              <option [ngValue]="null">Все</option>
              @for (e of employees(); track e.id) {
                <option [ngValue]="e.id">{{ e.display_name }}</option>
              }
            </select>
          </div>
          <div>
            <label class="section-title block mb-1">С</label>
            <input type="date" [(ngModel)]="filterFrom" (ngModelChange)="load()" class="field"/>
          </div>
          <div>
            <label class="section-title block mb-1">По</label>
            <input type="date" [(ngModel)]="filterTo" (ngModelChange)="load()" class="field"/>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="text-center py-10" style="color:var(--color-muted)">Загрузка...</div>
      } @else if (items().length === 0) {
        <div class="card text-center py-10" style="color:var(--color-muted)">Нет записей</div>
      } @else {

        <!-- Таблица -->
        <div class="card p-0 overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr style="border-bottom:1px solid var(--color-border)">
                <th class="px-4 py-3 text-left font-semibold" style="color:var(--color-muted)">Время</th>
                <th class="px-4 py-3 text-left font-semibold" style="color:var(--color-muted)">Сотрудник</th>
                <th class="px-4 py-3 text-left font-semibold" style="color:var(--color-muted)">Стол</th>
                <th class="px-4 py-3 text-left font-semibold" style="color:var(--color-muted)">Позиция</th>
                <th class="px-4 py-3 text-right font-semibold" style="color:var(--color-muted)">Кол-во</th>
                <th class="px-4 py-3 text-right font-semibold" style="color:var(--color-muted)">Цена</th>
                <th class="px-4 py-3 text-right font-semibold" style="color:var(--color-muted)">Сумма</th>
                <th class="px-4 py-3 text-left font-semibold" style="color:var(--color-muted)">Статус</th>
              </tr>
            </thead>
            <tbody>
              @for (item of items(); track item.id) {
                <tr style="border-bottom:1px solid var(--color-border)" class="hover:bg-gray-50 transition-colors">
                  <td class="px-4 py-2.5 whitespace-nowrap" style="color:var(--color-muted)">
                    {{ item.deleted_at | date:'dd.MM HH:mm' }}
                  </td>
                  <td class="px-4 py-2.5 font-medium">{{ item.deleted_by_name ?? '—' }}</td>
                  <td class="px-4 py-2.5">{{ item.table_number || '—' }}</td>
                  <td class="px-4 py-2.5">
                    {{ item.menu_item_name }}
                    @if (item.menu_item_volume) {
                      <span style="color:var(--color-muted)"> {{ item.menu_item_volume }}</span>
                    }
                  </td>
                  <td class="px-4 py-2.5 text-right">{{ item.quantity }}</td>
                  <td class="px-4 py-2.5 text-right">{{ item.unit_price | number:'1.0-0' }} ₽</td>
                  <td class="px-4 py-2.5 text-right font-semibold">{{ item.subtotal | number:'1.0-0' }} ₽</td>
                  <td class="px-4 py-2.5">
                    <span class="text-xs px-2 py-0.5 rounded-full"
                          [style]="statusStyle(item.kitchen_status)">
                      {{ statusLabel(item.kitchen_status) }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

      }
    </div>
  `,
})
export class AuditPage implements OnInit {
  items   = signal<DeletedOrderItem[]>([]);
  shifts  = signal<Shift[]>([]);
  employees = signal<Employee[]>([]);
  loading = signal(false);

  filterShift: number | null = null;
  filterUser:  number | null = null;
  filterFrom = '';
  filterTo   = '';

  totalAmount = computed(() => this.items().reduce((s, i) => s + Number(i.subtotal), 0));

  constructor(private analyticsApi: AnalyticsApi, private employeeApi: EmployeeApi, private shiftApi: ShiftApi) {}

  ngOnInit() {
    this.shiftApi.getShifts().subscribe(s => this.shifts.set(s));
    this.employeeApi.getEmployees().subscribe(e => this.employees.set(e));
    this.load();
  }

  load() {
    this.loading.set(true);
    this.analyticsApi.getDeletedItems({
      shift:      this.filterShift ?? undefined,
      deleted_by: this.filterUser  ?? undefined,
      date_from:  this.filterFrom  || undefined,
      date_to:    this.filterTo    || undefined,
    }).subscribe({
      next:  items => { this.items.set(items); this.loading.set(false); },
      error: ()    => this.loading.set(false),
    });
  }

  statusLabel(s: string) {
    return s === 'new' ? 'Новый' : s === 'cooking' ? 'Готовится' : s === 'ready' ? 'Готово' : s;
  }

  statusStyle(s: string) {
    if (s === 'new')     return 'background:#f3f4f6;color:#374151';
    if (s === 'cooking') return 'background:#fef3c7;color:#92400e';
    if (s === 'ready')   return 'background:#d1fae5;color:#065f46';
    return 'background:#f3f4f6;color:#374151';
  }
}