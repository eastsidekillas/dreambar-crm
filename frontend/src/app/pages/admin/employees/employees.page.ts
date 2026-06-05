import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Employee, EmployeeActivity, Shift, Order } from '../../../core/models';

const ROLE_META: Record<string, { label: string; icon: string; cls: string }> = {
  admin:     { label: 'Администратор', icon: '👤', cls: 'badge-gold'  },
  waiter:    { label: 'Официант',      icon: '🧑‍🍳', cls: 'badge-green' },
  bartender: { label: 'Бармен',        icon: '🍸', cls: 'badge-amber' },
  wardrobe:  { label: 'Гардероб',      icon: '🧥', cls: 'badge-gray'  },
};

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-xl font-bold">👥 Сотрудники и активность</h1>
        <div class="flex items-center gap-2">
          <select [(ngModel)]="selectedShift" (change)="loadActivity()" class="field" style="width:auto;height:38px">
            <option [ngValue]="null">Все смены</option>
            @for (s of shifts(); track s.id) {
              <option [ngValue]="s.id">{{ formatDate(s.date) }}{{ s.is_open ? ' (открыта)' : '' }}</option>
            }
          </select>
          <button (click)="showAdd.set(!showAdd())" class="btn btn-primary">
            {{ showAdd() ? '✕ Отмена' : '+ Сотрудник' }}
          </button>
        </div>
      </div>

      <!-- Add employee -->
      @if (showAdd()) {
        <div class="card" style="border-color:var(--color-gold)">
          <h3 class="font-semibold mb-4">Новый сотрудник</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label class="section-title block mb-1">Имя (отображаемое)</label>
              <input [(ngModel)]="newEmp.display_name" class="field" placeholder="Например: Официант Анна"/>
            </div>
            <div>
              <label class="section-title block mb-1">Логин</label>
              <input [(ngModel)]="newEmp.username" class="field" placeholder="anna"/>
            </div>
            <div>
              <label class="section-title block mb-1">Пароль</label>
              <input [(ngModel)]="newEmp.password" class="field" placeholder="по умолчанию dreambar2026"/>
            </div>
            <div>
              <label class="section-title block mb-1">Должность</label>
              <select [(ngModel)]="newEmp.role" class="field">
                <option value="waiter">Официант</option>
                <option value="bartender">Бармен</option>
                <option value="wardrobe">Гардероб</option>
                <option value="admin">Администратор</option>
              </select>
            </div>
          </div>
          @if (addError()) { <p class="text-sm mb-3" style="color:var(--color-red)">{{ addError() }}</p> }
          <button (click)="saveEmployee()" class="btn btn-primary">Сохранить</button>
        </div>
      }

      <!-- Activity table -->
      <div class="card">
        <h3 class="font-semibold mb-3">Кто сколько заработал {{ selectedShift ? 'за смену' : 'за всё время' }}</h3>

        <!-- Desktop table -->
        <div class="hidden md:block overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr style="border-bottom:2px solid var(--color-border)">
                <th class="text-left py-2 section-title">Сотрудник</th>
                <th class="text-left py-2 section-title">Должность</th>
                <th class="text-right py-2 section-title">Заказов</th>
                <th class="text-right py-2 section-title">Бар</th>
                <th class="text-right py-2 section-title">Кухня</th>
                <th class="text-right py-2 section-title">Кальян</th>
                <th class="text-right py-2 section-title">Билеты</th>
                <th class="text-right py-2 section-title">Итого</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (e of activity(); track e.user_id) {
                <tr style="border-bottom:1px solid var(--color-border)">
                  <td class="py-2.5 font-medium">{{ e.display_name }}</td>
                  <td class="py-2.5"><span class="badge" [class]="roleCls(e.role)">{{ roleIcon(e.role) }} {{ e.role_label }}</span></td>
                  <td class="py-2.5 text-right">{{ e.orders_count }}</td>
                  <td class="py-2.5 text-right">{{ e.bar_revenue | number:'1.0-0' }} ₽</td>
                  <td class="py-2.5 text-right">{{ e.kitchen_revenue | number:'1.0-0' }} ₽</td>
                  <td class="py-2.5 text-right">{{ e.hookah_revenue | number:'1.0-0' }} ₽</td>
                  <td class="py-2.5 text-right">{{ e.ticket_revenue | number:'1.0-0' }} ₽ <span style="color:var(--color-muted)">({{ e.tickets_count }})</span></td>
                  <td class="py-2.5 text-right font-bold" style="color:var(--color-gold-hover)">{{ e.total_revenue | number:'1.0-0' }} ₽</td>
                  <td class="py-2.5 text-right">
                    <button (click)="toggleOrders(e)" class="btn btn-ghost btn-sm">
                      {{ openedUser() === e.user_id ? 'Скрыть' : 'Заказы' }}
                    </button>
                  </td>
                </tr>
                @if (openedUser() === e.user_id) {
                  <tr>
                    <td colspan="9" class="py-2" style="background:var(--color-surface2)">
                      <div class="px-3 py-2">
                        @if (empOrders().length) {
                          @for (o of empOrders(); track o.id) {
                            <div class="flex items-center gap-2 text-sm py-1" style="border-bottom:1px solid var(--color-border)">
                              <span class="font-medium">#{{ o.id }}</span>
                              <span style="color:var(--color-muted)">{{ o.table_number || '—' }}</span>
                              <span class="flex-1 truncate" style="color:var(--color-muted)">
                                {{ itemsSummary(o) }}
                              </span>
                              <span class="font-bold" style="color:var(--color-gold-hover)">{{ o.total | number:'1.0-0' }} ₽</span>
                            </div>
                          }
                        } @else {
                          <p class="text-sm" style="color:var(--color-muted)">Нет заказов</p>
                        }
                      </div>
                    </td>
                  </tr>
                }
              }
              @if (!activity().length) {
                <tr><td colspan="9" class="py-8 text-center" style="color:var(--color-muted)">Нет активности</td></tr>
              }
            </tbody>
          </table>
        </div>

        <!-- Mobile cards -->
        <div class="md:hidden space-y-3">
          @for (e of activity(); track e.user_id) {
            <div class="p-3 rounded-lg" style="background:var(--color-surface2);border:1px solid var(--color-border)">
              <div class="flex items-center justify-between mb-2">
                <span class="font-semibold">{{ e.display_name }}</span>
                <span class="badge" [class]="roleCls(e.role)">{{ roleIcon(e.role) }} {{ e.role_label }}</span>
              </div>
              <div class="grid grid-cols-3 gap-2 text-xs mb-2">
                <div><span style="color:var(--color-muted)">Бар:</span> {{ e.bar_revenue | number:'1.0-0' }} ₽</div>
                <div><span style="color:var(--color-muted)">Кухня:</span> {{ e.kitchen_revenue | number:'1.0-0' }} ₽</div>
                <div><span style="color:var(--color-muted)">Кальян:</span> {{ e.hookah_revenue | number:'1.0-0' }} ₽</div>
                <div><span style="color:var(--color-muted)">Билеты:</span> {{ e.ticket_revenue | number:'1.0-0' }} ₽</div>
                <div><span style="color:var(--color-muted)">Заказов:</span> {{ e.orders_count }}</div>
              </div>
              <div class="flex items-center justify-between pt-2" style="border-top:1px solid var(--color-border)">
                <span class="text-sm font-medium" style="color:var(--color-muted)">Итого</span>
                <span class="font-bold" style="color:var(--color-gold-hover)">{{ e.total_revenue | number:'1.0-0' }} ₽</span>
              </div>
            </div>
          }
          @if (!activity().length) {
            <p class="py-8 text-center" style="color:var(--color-muted)">Нет активности</p>
          }
        </div>
      </div>
    </div>
  `
})
export class EmployeesComponent implements OnInit {
  employees   = signal<Employee[]>([]);
  activity    = signal<EmployeeActivity[]>([]);
  shifts      = signal<Shift[]>([]);
  empOrders   = signal<Order[]>([]);
  openedUser  = signal<number | null>(null);
  selectedShift: number | null = null;

  showAdd  = signal(false);
  addError = signal('');
  newEmp: { username: string; password: string; display_name: string; role: string } =
    { username: '', password: '', display_name: '', role: 'waiter' };

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getShifts().subscribe(s => this.shifts.set(s));
    this.loadActivity();
  }

  loadActivity() {
    this.openedUser.set(null);
    this.api.getEmployeeActivity(this.selectedShift ?? undefined).subscribe(a => this.activity.set(a));
  }

  toggleOrders(e: EmployeeActivity) {
    if (this.openedUser() === e.user_id) { this.openedUser.set(null); return; }
    this.openedUser.set(e.user_id);
    this.api.getEmployeeOrders(e.user_id, this.selectedShift ?? undefined).subscribe(o => this.empOrders.set(o));
  }

  itemsSummary(o: Order): string {
    return o.items.map(i => `${i.menu_item_name}×${i.quantity}`).join(', ');
  }

  saveEmployee() {
    this.addError.set('');
    if (!this.newEmp.username || !this.newEmp.display_name) {
      this.addError.set('Укажите имя и логин'); return;
    }
    this.api.createEmployee(this.newEmp).subscribe({
      next: () => {
        this.showAdd.set(false);
        this.newEmp = { username: '', password: '', display_name: '', role: 'waiter' };
        this.loadActivity();
      },
      error: () => this.addError.set('Ошибка при создании сотрудника')
    });
  }

  roleCls(r: string)  { return ROLE_META[r]?.cls ?? 'badge-gray'; }
  roleIcon(r: string) { return ROLE_META[r]?.icon ?? '👤'; }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }
}
