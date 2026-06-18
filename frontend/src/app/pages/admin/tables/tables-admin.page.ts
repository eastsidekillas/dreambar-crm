import { Component, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableApi } from '../../../entities/table';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Zone, VenueTable } from '../../../core/models';
import { LucideMap, LucidePencil, LucideTrash2, LucideUsers, LucideX } from '@lucide/angular';

const ZONE_COLORS = [
  { hex: '#6b7280', label: 'Серый' },
  { hex: '#b8922a', label: 'Золотой' },
  { hex: '#2563eb', label: 'Синий' },
  { hex: '#16a34a', label: 'Зелёный' },
  { hex: '#dc2626', label: 'Красный' },
  { hex: '#9333ea', label: 'Фиолетовый' },
];

@Component({
  selector: 'app-tables-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideMap, LucidePencil, LucideTrash2, LucideUsers, LucideX],
  template: `
<div class="space-y-4">

  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-xl font-bold flex items-center gap-2"><svg lucideMap [size]="20"></svg> Столы и зоны</h1>
      <p class="text-xs mt-0.5" style="color:var(--color-muted)">Настройка зон и столов заведения</p>
    </div>
    <button (click)="openZoneForm()" class="btn btn-primary btn-sm">+ Зона</button>
  </div>

  @for (zone of zones(); track zone.id) {
    <div class="card">
      <!-- Zone header -->
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full flex-shrink-0"
                [style.background]="zone.color"></span>
          <span class="font-bold">{{ zone.name }}</span>
          <span class="text-xs" style="color:var(--color-muted)">
            {{ zone.tables.length }} {{ declTable(zone.tables.length) }}
          </span>
        </div>
        <div class="flex gap-2">
          <button (click)="openTableForm(zone)" class="btn btn-ghost btn-sm" style="font-size:12px">+ Стол</button>
          <button (click)="openZoneForm(zone)" class="btn btn-ghost btn-sm"><svg lucidePencil [size]="14"></svg></button>
          <button (click)="confirmDeleteZone(zone)" class="btn btn-ghost btn-sm"
                  style="color:#dc2626"><svg lucideTrash2 [size]="14"></svg></button>
        </div>
      </div>

      <!-- Tables grid -->
      @if (zone.tables.length) {
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          @for (t of zone.tables; track t.id) {
            <div class="relative rounded-xl p-2.5 text-center"
                 [style]="t.is_active
                   ? 'border:1px solid ' + zone.color + ';background:' + zone.color + '18'
                   : 'border:1px solid var(--color-border);background:var(--color-surface2);opacity:0.5'">
              <p class="font-bold text-sm">{{ t.number }}</p>
              <p class="text-xs flex items-center justify-center gap-1" style="color:var(--color-muted)"><svg lucideUsers [size]="12"></svg> {{ t.seats }}</p>
              @if (t.note) {
                <p class="text-xs truncate mt-0.5" style="color:var(--color-muted)" [title]="t.note">{{ t.note }}</p>
              }
              <div class="flex justify-center gap-1 mt-1.5">
                <button (click)="openTableForm(zone, t)" class="flex items-center justify-center px-1.5 py-0.5 rounded"
                        style="background:var(--color-bg);border:1px solid var(--color-border)"><svg lucidePencil [size]="12"></svg></button>
                <button (click)="confirmDeleteTable(t)" class="flex items-center justify-center px-1.5 py-0.5 rounded"
                        style="background:var(--color-bg);border:1px solid var(--color-border);color:#dc2626"><svg lucideX [size]="12"></svg></button>
              </div>
            </div>
          }
        </div>
      } @else {
        <p class="text-sm text-center py-4" style="color:var(--color-muted)">Нет столов</p>
      }
    </div>
  }

  @if (!zones().length && !loading()) {
    <div class="card text-center py-10">
      <svg lucideMap [size]="48" class="mb-2 mx-auto" style="color:var(--color-muted)"></svg>
      <p class="font-medium mb-1">Зоны ещё не добавлены</p>
      <p class="text-sm mb-4" style="color:var(--color-muted)">Создайте зоны и добавьте столы</p>
      <button (click)="openZoneForm()" class="btn btn-primary btn-sm">+ Создать первую зону</button>
    </div>
  }

</div>

<!-- Zone form modal -->
@if (zoneForm()) {
  <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeZoneForm()"></div>
  <div class="fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl"
       style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
    <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeZoneForm()">
      <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
    </div>
    <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
      <h2 class="font-bold text-base">{{ editingZone()?.id ? 'Редактировать зону' : 'Новая зона' }}</h2>
      <button (click)="closeZoneForm()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
    </div>
    <div class="px-4 py-4 space-y-3">
      <div>
        <label class="section-title block mb-1.5">Название *</label>
        <input [(ngModel)]="zfName" placeholder="Бар, Зал, VIP, Улица…" class="field" style="height:44px" />
      </div>
      <div>
        <label class="section-title block mb-1.5">Цвет</label>
        <div class="flex gap-2 flex-wrap">
          @for (c of zoneColors; track c.hex) {
            <button (click)="zfColor = c.hex"
                    class="w-8 h-8 rounded-full border-2 transition-all"
                    [style.background]="c.hex"
                    [style.border-color]="zfColor === c.hex ? '#000' : 'transparent'">
            </button>
          }
        </div>
      </div>
      <div>
        <label class="section-title block mb-1.5">Порядок отображения</label>
        <input [(ngModel)]="zfSort" type="number" min="0" class="field" style="height:44px;width:100px" />
      </div>
      <div>
        <label class="section-title block mb-1.5">VIP-зона</label>
        <button (click)="zfRequiresDeposit = !zfRequiresDeposit" type="button"
                class="btn btn-sm" style="height:40px;border:1.5px solid var(--color-border)"
                [style.background]="zfRequiresDeposit ? 'var(--color-gold-light)' : 'white'"
                [style.color]="zfRequiresDeposit ? 'var(--color-gold-hover)' : 'var(--color-muted)'">
          {{ zfRequiresDeposit ? 'Берётся депозит' : 'Без депозита' }}
        </button>
        <p class="text-xs mt-1" style="color:var(--color-muted)">В VIP-зоне у броней появляется депозит.</p>
      </div>
      @if (zfRequiresDeposit) {
        <div>
          <label class="section-title block mb-1.5">Мин. депозит, ₽ <span style="color:var(--color-muted)">(0 — без минимума)</span></label>
          <input [(ngModel)]="zfMinDeposit" type="number" min="0" class="field" style="height:44px;width:140px" />
        </div>
      }
      <button (click)="saveZone()" [disabled]="zoneSaving() || !zfName.trim()"
              class="btn btn-primary btn-full" style="height:48px">
        {{ zoneSaving() ? '...' : (editingZone()?.id ? 'Сохранить' : 'Создать зону') }}
      </button>
    </div>
  </div>
}

<!-- Table form modal -->
@if (tableForm()) {
  <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.45)" (click)="closeTableForm()"></div>
  <div class="fixed bottom-0 left-0 right-0 z-[60] rounded-t-2xl"
       style="background:white;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">
    <div class="flex justify-center pt-3 pb-1 cursor-pointer" (click)="closeTableForm()">
      <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
    </div>
    <div class="flex items-center justify-between px-4 py-3" style="border-bottom:1px solid var(--color-border)">
      <h2 class="font-bold text-base">{{ editingTable()?.id ? 'Редактировать стол' : 'Новый стол' }}</h2>
      <button (click)="closeTableForm()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
    </div>
    <div class="px-4 py-4 space-y-3">
      <div>
        <label class="section-title block mb-1.5">Номер / название *</label>
        <input [(ngModel)]="tfNumber" placeholder="1, 2, VIP-1, Бар-1…" class="field" style="height:44px" />
      </div>
      <div class="flex gap-3">
        <div class="flex-1">
          <label class="section-title block mb-1.5">Мест</label>
          <input [(ngModel)]="tfSeats" type="number" min="1" max="30" class="field" style="height:44px" />
        </div>
        <div class="flex items-end pb-0.5">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" [(ngModel)]="tfActive" class="w-4 h-4 rounded" />
            <span class="text-sm font-medium">Активен</span>
          </label>
        </div>
      </div>
      <div>
        <label class="section-title block mb-1.5">Примечание</label>
        <input [(ngModel)]="tfNote" placeholder="Необязательно" class="field" style="height:44px" />
      </div>
      <button (click)="saveTable()" [disabled]="tableSaving() || !tfNumber.trim()"
              class="btn btn-primary btn-full" style="height:48px">
        {{ tableSaving() ? '...' : (editingTable()?.id ? 'Сохранить' : 'Добавить стол') }}
      </button>
    </div>
  </div>
}

<!-- Delete confirmation -->
@if (deleteTarget()) {
  <div class="fixed inset-0 z-[70]" style="background:rgba(0,0,0,0.55)"></div>
  <div class="fixed inset-x-4 top-1/3 z-[80] rounded-2xl p-5"
       style="background:white;box-shadow:0 8px 40px rgba(0,0,0,0.3)">
    <p class="font-bold text-base mb-1">Удалить?</p>
    <p class="text-sm mb-4" style="color:var(--color-muted)">{{ deleteTarget()!.label }}</p>
    <div class="flex gap-3">
      <button (click)="deleteTarget.set(null)" class="btn btn-outline flex-1">Отмена</button>
      <button (click)="executeDelete()" [disabled]="deleteSaving()"
              class="btn flex-1" style="background:#dc2626;color:white">
        {{ deleteSaving() ? '...' : 'Удалить' }}
      </button>
    </div>
  </div>
}
  `,
})
export class TablesAdminPage implements OnInit {
  zones   = signal<Zone[]>([]);
  loading = signal(false);

  zoneColors = ZONE_COLORS;

  // Zone form
  zoneForm    = signal(false);
  editingZone = signal<Zone | null>(null);
  zfName  = '';
  zfColor = '#6b7280';
  zfSort  = 0;
  zfRequiresDeposit = false;
  zfMinDeposit = 0;
  zoneSaving = signal(false);

  // Table form
  tableForm     = signal(false);
  editingTable  = signal<VenueTable | null>(null);
  tableZone     = signal<Zone | null>(null);
  tfNumber = '';
  tfSeats  = 4;
  tfActive = true;
  tfNote   = '';
  tableSaving = signal(false);

  // Delete
  deleteTarget  = signal<{ label: string; fn: () => void } | null>(null);
  deleteSaving  = signal(false);

  constructor(private tableApi: TableApi, private toast: ToastService) {}

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.tableApi.getZones().subscribe({
      next: z => { this.zones.set(z); this.loading.set(false); },
      error: () => this.loading.set(false),
    });
  }

  // ── Zone form ────────────────────────────────────────────────────
  openZoneForm(z?: Zone) {
    this.editingZone.set(z ?? null);
    this.zfName  = z?.name  ?? '';
    this.zfColor = z?.color ?? '#b8922a';
    this.zfSort  = z?.sort  ?? this.zones().length;
    this.zfRequiresDeposit = z?.requires_deposit ?? false;
    this.zfMinDeposit = z ? +z.min_deposit : 0;
    this.zoneForm.set(true);
  }
  closeZoneForm() { this.zoneForm.set(false); }

  saveZone() {
    if (this.zoneSaving() || !this.zfName.trim()) return;
    this.zoneSaving.set(true);
    const data = {
      name: this.zfName.trim(), color: this.zfColor, sort: this.zfSort,
      requires_deposit: this.zfRequiresDeposit,
      min_deposit: this.zfRequiresDeposit ? this.zfMinDeposit : 0,
    };
    const z = this.editingZone();
    const req = z?.id
      ? this.tableApi.updateZone(z.id, data)
      : this.tableApi.createZone(data);
    req.subscribe({
      next: () => { this.zoneSaving.set(false); this.closeZoneForm(); this.load(); },
      error: err => { this.zoneSaving.set(false); this.toast.apiError(err, 'Ошибка сохранения зоны'); },
    });
  }

  confirmDeleteZone(z: Zone) {
    this.deleteTarget.set({
      label: `Зона «${z.name}» и все её столы (${z.tables.length} шт.)`,
      fn: () => this.tableApi.deleteZone(z.id).subscribe({
        next: () => { this.deleteSaving.set(false); this.deleteTarget.set(null); this.load(); },
        error: err => { this.deleteSaving.set(false); this.toast.apiError(err, 'Ошибка удаления'); },
      }),
    });
  }

  // ── Table form ───────────────────────────────────────────────────
  openTableForm(zone: Zone, t?: VenueTable) {
    this.tableZone.set(zone);
    this.editingTable.set(t ?? null);
    this.tfNumber = t?.number ?? '';
    this.tfSeats  = t?.seats  ?? 4;
    this.tfActive = t?.is_active ?? true;
    this.tfNote   = t?.note   ?? '';
    this.tableForm.set(true);
  }
  closeTableForm() { this.tableForm.set(false); }

  saveTable() {
    if (this.tableSaving() || !this.tfNumber.trim()) return;
    this.tableSaving.set(true);
    const zone = this.tableZone()!;
    const data = {
      zone: zone.id,
      number: this.tfNumber.trim(),
      seats: this.tfSeats,
      is_active: this.tfActive,
      note: this.tfNote.trim(),
    };
    const t = this.editingTable();
    const req = t?.id
      ? this.tableApi.updateTable(t.id, data)
      : this.tableApi.createTable(data);
    req.subscribe({
      next: () => { this.tableSaving.set(false); this.closeTableForm(); this.load(); },
      error: err => { this.tableSaving.set(false); this.toast.apiError(err, 'Ошибка сохранения стола'); },
    });
  }

  confirmDeleteTable(t: VenueTable) {
    this.deleteTarget.set({
      label: `Стол «${t.number}» (зона ${t.zone_name})`,
      fn: () => this.tableApi.deleteTable(t.id).subscribe({
        next: () => { this.deleteSaving.set(false); this.deleteTarget.set(null); this.load(); },
        error: err => { this.deleteSaving.set(false); this.toast.apiError(err, 'Ошибка удаления'); },
      }),
    });
  }

  executeDelete() {
    const t = this.deleteTarget();
    if (!t || this.deleteSaving()) return;
    this.deleteSaving.set(true);
    t.fn();
  }

  declTable(n: number) {
    if (n % 10 === 1 && n % 100 !== 11) return 'стол';
    if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'стола';
    return 'столов';
  }
}
