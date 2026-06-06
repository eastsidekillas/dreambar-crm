import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Employee, EmployeeActivity, Shift, Order } from '../../../core/models';

const ROLE_META: Record<string, { label: string; icon: string; cls: string }> = {
  admin:     { label: 'Администратор', icon: '👤', cls: 'badge-gold'  },
  waiter:    { label: 'Официант',      icon: '🧑‍🍳', cls: 'badge-green' },
  bartender: { label: 'Бармен',        icon: '🍸', cls: 'badge-amber' },
  kitchen:   { label: 'Кухня',         icon: '🍳', cls: 'badge-blue'  },
  wardrobe:  { label: 'Гардероб',      icon: '🧥', cls: 'badge-gray'  },
};

const ROLES = Object.entries(ROLE_META).map(([value, m]) => ({ value, label: m.label }));

interface EditState {
  display_name: string;
  role: string;
  password: string;
  allowed_roles: string[];
}

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <div class="flex items-center justify-between flex-wrap gap-3">
        <h1 class="text-xl font-bold">👥 Сотрудники</h1>
        <div class="flex items-center gap-2">
          <!-- Tab switcher -->
          <div class="flex rounded-lg overflow-hidden" style="border:1px solid var(--color-border)">
            <button (click)="tab.set('list')"
              class="px-4 py-1.5 text-sm font-medium transition-colors"
              [style]="tab() === 'list' ? 'background:var(--color-gold);color:#000' : 'background:transparent'">
              Список
            </button>
            <button (click)="tab.set('activity')"
              class="px-4 py-1.5 text-sm font-medium transition-colors"
              [style]="tab() === 'activity' ? 'background:var(--color-gold);color:#000' : 'background:transparent'">
              Активность
            </button>
          </div>
          <button (click)="toggleAdd()" class="btn btn-primary">
            {{ showAdd() ? '✕ Отмена' : '+ Сотрудник' }}
          </button>
        </div>
      </div>

      <!-- Add employee form -->
      @if (showAdd()) {
        <div class="card" style="border-color:var(--color-gold)">
          <h3 class="font-semibold mb-4">Новый сотрудник</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <label class="section-title block mb-1">Отображаемое имя</label>
              <input [(ngModel)]="newEmp.display_name" class="field" placeholder="Например: Официант Анна"/>
            </div>
            <div>
              <label class="section-title block mb-1">Логин</label>
              <input [(ngModel)]="newEmp.username" class="field" placeholder="anna"/>
            </div>
            <div>
              <label class="section-title block mb-1">Пароль</label>
              <input [(ngModel)]="newEmp.password" class="field" type="password" placeholder="минимум 6 символов"/>
            </div>
            <div>
              <label class="section-title block mb-1">Должность</label>
              <select [(ngModel)]="newEmp.role" class="field">
                @for (r of roles; track r.value) {
                  <option [value]="r.value">{{ r.label }}</option>
                }
              </select>
            </div>
          </div>
          @if (addError()) {
            <p class="text-sm mb-3" style="color:var(--color-red)">{{ addError() }}</p>
          }
          <button (click)="saveEmployee()" class="btn btn-primary" [disabled]="saving()">
            {{ saving() ? 'Создание...' : 'Создать' }}
          </button>
        </div>
      }

      <!-- ── LIST TAB ───────────────────────────────────────────── -->
      @if (tab() === 'list') {
        <div class="card">
          <div class="space-y-2">
            @for (emp of employees(); track emp.id) {
              <div class="rounded-lg p-3" style="border:1px solid var(--color-border)">
                <!-- Employee row -->
                <div class="flex items-center gap-3">
                  <div class="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                       style="background:var(--color-surface2)">
                    {{ initials(emp.display_name) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                      <span class="font-medium">{{ emp.display_name }}</span>
                      <span class="text-xs" style="color:var(--color-muted)">&#64;{{ emp.username }}</span>
                      <span class="badge" [class]="roleCls(emp.role)">{{ roleIcon(emp.role) }} {{ roleLabel(emp.role) }}</span>
                      @if (!emp.is_active) {
                        <span class="badge badge-gray">неактивен</span>
                      }
                    </div>
                  </div>
                  <div class="flex items-center gap-2 flex-shrink-0">
                    <button (click)="toggleEdit(emp)" class="btn btn-ghost btn-sm">
                      {{ editingId() === emp.id ? 'Отмена' : 'Изменить' }}
                    </button>
                    <button (click)="toggleActive(emp)"
                      class="btn btn-sm"
                      [style]="emp.is_active ? 'background:transparent;border-color:var(--color-red);color:var(--color-red)' : 'background:transparent;border-color:var(--color-green);color:var(--color-green)'">
                      {{ emp.is_active ? 'Деактивировать' : 'Активировать' }}
                    </button>
                  </div>
                </div>

                <!-- Inline edit form -->
                @if (editingId() === emp.id) {
                  <div class="mt-3 pt-3 grid grid-cols-1 md:grid-cols-3 gap-3" style="border-top:1px solid var(--color-border)">
                    <div>
                      <label class="section-title block mb-1">Отображаемое имя</label>
                      <input [(ngModel)]="editState.display_name" class="field"/>
                    </div>
                    <div>
                      <label class="section-title block mb-1">Должность</label>
                      <select [(ngModel)]="editState.role" class="field">
                        @for (r of roles; track r.value) {
                          <option [value]="r.value">{{ r.label }}</option>
                        }
                      </select>
                    </div>
                    <div>
                      <label class="section-title block mb-1">Новый пароль (необязательно)</label>
                      <input [(ngModel)]="editState.password" class="field" type="password" placeholder="оставьте пустым"/>
                    </div>
                    @if (editError()) {
                      <p class="col-span-full text-sm" style="color:var(--color-red)">{{ editError() }}</p>
                    }
                    <div>
                      <label class="section-title block mb-1">Доступные роли (мультироль)</label>
                      <div class="flex flex-wrap gap-2 mt-1">
                        @for (r of roles; track r.value) {
                          <label class="flex items-center gap-1.5 text-sm cursor-pointer">
                            <input type="checkbox"
                              [checked]="editState.allowed_roles.includes(r.value)"
                              (change)="toggleAllowedRole(r.value, $any($event.target).checked)"/>
                            {{ r.label }}
                          </label>
                        }
                      </div>
                      <p class="text-xs mt-1" style="color:var(--color-muted)">
                        Выберите 2+ ролей — сотрудник будет выбирать при входе
                      </p>
                    </div>
                  <div class="col-span-full">
                      <button (click)="saveEdit(emp)" class="btn btn-primary btn-sm" [disabled]="saving()">
                        {{ saving() ? 'Сохранение...' : 'Сохранить' }}
                      </button>
                    </div>
                  </div>
                }
              </div>
            }
            @if (!employees().length) {
              <p class="py-8 text-center" style="color:var(--color-muted)">Нет сотрудников</p>
            }
          </div>
        </div>
      }

      <!-- ── ACTIVITY TAB ───────────────────────────────────────── -->
      @if (tab() === 'activity') {
        <div class="flex items-center gap-2">
          <select [(ngModel)]="selectedShift" (change)="loadActivity()" class="field" style="width:auto;height:38px">
            <option [ngValue]="null">Все смены</option>
            @for (s of shifts(); track s.id) {
              <option [ngValue]="s.id">{{ formatDate(s.date) }}{{ s.is_open ? ' (открыта)' : '' }}</option>
            }
          </select>
        </div>

        <div class="card">
          <h3 class="font-semibold mb-3">Кто сколько заработал {{ selectedShift ? 'за смену' : 'за всё время' }}</h3>

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
                                <span class="flex-1 truncate" style="color:var(--color-muted)">{{ itemsSummary(o) }}</span>
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
      }
    </div>
  `
})
export class EmployeesComponent implements OnInit {
  tab         = signal<'list' | 'activity'>('list');
  employees   = signal<Employee[]>([]);
  activity    = signal<EmployeeActivity[]>([]);
  shifts      = signal<Shift[]>([]);
  empOrders   = signal<Order[]>([]);
  openedUser  = signal<number | null>(null);
  selectedShift: number | null = null;

  showAdd  = signal(false);
  saving   = signal(false);
  addError = signal('');
  newEmp   = this.emptyNew();

  editingId  = signal<number | null>(null);
  editState: EditState = { display_name: '', role: 'waiter', password: '', allowed_roles: [] };
  editError  = signal('');

  roles = ROLES;

  constructor(private api: ApiService) {}

  ngOnInit() {
    this.api.getShifts().subscribe(s => this.shifts.set(s));
    this.loadEmployees();
    this.loadActivity();
  }

  loadEmployees() {
    this.api.getEmployees().subscribe(e => this.employees.set(e));
  }

  loadActivity() {
    this.openedUser.set(null);
    this.api.getEmployeeActivity(this.selectedShift ?? undefined).subscribe(a => this.activity.set(a));
  }

  toggleAdd() {
    this.showAdd.set(!this.showAdd());
    this.addError.set('');
    this.newEmp = this.emptyNew();
  }

  saveEmployee() {
    this.addError.set('');
    if (!this.newEmp.username.trim() || !this.newEmp.display_name.trim()) {
      this.addError.set('Укажите имя и логин'); return;
    }
    this.saving.set(true);
    this.api.createEmployee(this.newEmp).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAdd.set(false);
        this.newEmp = this.emptyNew();
        this.loadEmployees();
      },
      error: (err) => {
        this.saving.set(false);
        const detail = err?.error?.detail || err?.error?.username?.[0] || 'Ошибка при создании';
        this.addError.set(detail);
      }
    });
  }

  toggleEdit(emp: Employee) {
    if (this.editingId() === emp.id) {
      this.editingId.set(null);
      return;
    }
    this.editingId.set(emp.id);
    this.editError.set('');
    this.editState = {
      display_name: emp.display_name,
      role: emp.role,
      password: '',
      allowed_roles: [...(emp.allowed_roles ?? [])],
    };
  }

  toggleAllowedRole(role: string, checked: boolean) {
    if (checked) {
      if (!this.editState.allowed_roles.includes(role)) {
        this.editState.allowed_roles = [...this.editState.allowed_roles, role];
      }
    } else {
      this.editState.allowed_roles = this.editState.allowed_roles.filter(r => r !== role);
    }
  }

  saveEdit(emp: Employee) {
    this.editError.set('');
    this.saving.set(true);
    const payload: any = {
      display_name: this.editState.display_name,
      role: this.editState.role,
      allowed_roles: this.editState.allowed_roles,
    };
    if (this.editState.password) payload['password'] = this.editState.password;

    this.api.updateEmployee(emp.id, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editingId.set(null);
        this.loadEmployees();
      },
      error: () => {
        this.saving.set(false);
        this.editError.set('Ошибка при сохранении');
      }
    });
  }

  toggleActive(emp: Employee) {
    this.api.updateEmployee(emp.id, { is_active: !emp.is_active }).subscribe({
      next: () => this.loadEmployees(),
    });
  }

  toggleOrders(e: EmployeeActivity) {
    if (this.openedUser() === e.user_id) { this.openedUser.set(null); return; }
    this.openedUser.set(e.user_id);
    this.api.getEmployeeOrders(e.user_id, this.selectedShift ?? undefined).subscribe(o => this.empOrders.set(o));
  }

  itemsSummary(o: Order): string {
    return o.items.map(i => `${i.menu_item_name}×${i.quantity}`).join(', ');
  }

  initials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  }

  roleCls(r: string)   { return ROLE_META[r]?.cls ?? 'badge-gray'; }
  roleIcon(r: string)  { return ROLE_META[r]?.icon ?? '👤'; }
  roleLabel(r: string) { return ROLE_META[r]?.label ?? r; }

  formatDate(d: string) {
    return new Date(d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  }

  private emptyNew() {
    return { username: '', password: '', display_name: '', role: 'waiter', allowed_roles: [] as string[] };
  }
}
