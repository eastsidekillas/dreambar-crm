import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../core/services/api.service';
import { Printer, PrinterConnection } from '../../../core/models';
import {
  LucidePrinter, LucideGlobe, LucideUsb, LucidePencil, LucideTrash2,
  LucideX, LucideCheck,
} from '@lucide/angular';

interface PrinterForm {
  name: string;
  connection: PrinterConnection;
  host: string;
  port: number;
  agent_key: string;
  width: number;
  is_default: boolean;
  is_active: boolean;
}

const BLANK_FORM = (): PrinterForm => ({
  name: '', connection: 'network', host: '', port: 9100,
  agent_key: '', width: 48, is_default: false, is_active: true,
});

@Component({
  selector: 'app-printers-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucidePrinter, LucideGlobe, LucideUsb, LucidePencil, LucideTrash2, LucideX, LucideCheck],
  template: `
    <div class="max-w-2xl mx-auto space-y-6">

      <!-- Page header -->
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold flex items-center gap-2"><svg lucidePrinter [size]="20"></svg> Принтеры</h1>
          <p class="text-sm mt-0.5" style="color:var(--color-muted)">
            Термопринтеры для печати предчеков
          </p>
        </div>
        <button (click)="openCreate()" class="btn btn-primary">＋ Добавить</button>
      </div>

      <!-- Printers list -->
      @if (printers().length) {
        <div class="space-y-3">
          @for (p of printers(); track p.id) {
            <div class="card p-0 overflow-hidden">

              <!-- Header row -->
              <div class="flex items-center gap-3 px-4 py-3"
                   style="border-bottom:1px solid var(--color-border)">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2">
                    <span class="font-bold text-sm">{{ p.name }}</span>
                    @if (p.is_default) {
                      <span class="badge badge-gold">По умолчанию</span>
                    }
                    <span class="badge" [class]="p.is_active ? 'badge-green' : 'badge-gray'">
                      {{ p.is_active ? 'Активен' : 'Отключён' }}
                    </span>
                  </div>
                  <p class="text-xs mt-0.5" style="color:var(--color-muted)">
                    @if (p.connection === 'network') {
                      <svg lucideGlobe [size]="12" class="inline-block mr-1"></svg>Ethernet · {{ p.host }}:{{ p.port }} · {{ p.width }} симв.
                    } @else {
                      <svg lucideUsb [size]="12" class="inline-block mr-1"></svg>USB-агент · ключ: {{ p.agent_key || '—' }} · {{ p.width }} симв.
                    }
                  </p>
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 flex-shrink-0">
                  <button (click)="testPrint(p)"
                          [disabled]="testing() === p.id"
                          class="btn btn-ghost btn-sm"
                          title="Тестовая печать">
                    <svg lucidePrinter [size]="14"></svg>
                  </button>
                  <button (click)="openEdit(p)" class="btn btn-ghost btn-sm"><svg lucidePencil [size]="14"></svg></button>
                  <button (click)="confirmDelete(p)" class="btn btn-ghost btn-sm"
                          style="color:var(--color-red)"><svg lucideTrash2 [size]="14"></svg></button>
                </div>
              </div>

              <!-- Test result -->
              @if (testResult()[p.id]) {
                <div class="px-4 py-2 text-xs font-medium"
                     [style]="testResult()[p.id]!.ok
                       ? 'background:var(--color-green-bg);color:var(--color-green)'
                       : 'background:var(--color-red-bg);color:var(--color-red)'">
                  @if (testResult()[p.id]!.ok) {
                    <svg lucideCheck [size]="12" class="inline-block mr-1"></svg>Принтер ответил
                  } @else {
                    <svg lucideX [size]="12" class="inline-block mr-1"></svg> {{ testResult()[p.id]!.error }}
                  }
                </div>
              }
            </div>
          }
        </div>
      } @else if (!loading()) {
        <div class="card text-center py-12">
          <svg lucidePrinter [size]="48" class="mb-3 mx-auto" style="color:var(--color-muted)"></svg>
          <p style="color:var(--color-muted)">Принтеры не настроены</p>
          <button (click)="openCreate()" class="btn btn-primary btn-sm mt-3">
            Добавить принтер
          </button>
        </div>
      }

      @if (loading()) {
        <div class="text-center py-8" style="color:var(--color-muted)">Загрузка...</div>
      }
    </div>

    <!-- ── Printer form modal ────────────────────────────────────── -->
    @if (formOpen()) {
      <div class="fixed inset-0 z-50 flex items-end md:items-center justify-center"
           style="background:rgba(0,0,0,0.45)" (click)="closeForm()">
      </div>
      <div class="fixed bottom-0 left-0 right-0 md:bottom-auto md:left-1/2 md:-translate-x-1/2
                  md:top-1/2 md:-translate-y-1/2 md:w-[480px] z-[60] flex flex-col rounded-t-2xl md:rounded-2xl"
           style="background:white;max-height:92dvh;box-shadow:0 -8px 32px rgba(0,0,0,0.15)">

        <!-- Handle (mobile) -->
        <div class="flex justify-center pt-3 pb-1 md:hidden cursor-pointer" (click)="closeForm()">
          <div class="w-10 h-1 rounded-full" style="background:var(--color-border-mid)"></div>
        </div>

        <!-- Title -->
        <div class="flex items-center justify-between px-5 py-4"
             style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">
            {{ editId() ? 'Редактировать принтер' : 'Добавить принтер' }}
          </h2>
          <button (click)="closeForm()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>

        <!-- Form body -->
        <div class="overflow-y-auto flex-1 px-5 py-4 space-y-4">

          <!-- Name -->
          <div>
            <label class="section-title block mb-1.5">Название</label>
            <input [(ngModel)]="form.name" class="field" placeholder="Касса, Бар, Кухня..." />
          </div>

          <!-- Connection type -->
          <div>
            <label class="section-title block mb-1.5">Подключение</label>
            <div class="flex gap-2">
              <button (click)="form.connection = 'network'"
                      class="btn btn-sm flex items-center gap-1" style="flex:1"
                      [class]="form.connection === 'network' ? 'btn-primary' : 'btn-outline'">
                <svg lucideGlobe [size]="14"></svg> Ethernet
              </button>
              <button (click)="form.connection = 'agent'"
                      class="btn btn-sm flex items-center gap-1" style="flex:1"
                      [class]="form.connection === 'agent' ? 'btn-primary' : 'btn-outline'">
                <svg lucideUsb [size]="14"></svg> USB-агент
              </button>
            </div>
          </div>

          <!-- Network fields -->
          @if (form.connection === 'network') {
            <div class="grid grid-cols-[1fr_auto] gap-2">
              <div>
                <label class="section-title block mb-1.5">IP-адрес / хост</label>
                <input [(ngModel)]="form.host" class="field" placeholder="192.168.1.100" />
              </div>
              <div>
                <label class="section-title block mb-1.5">Порт</label>
                <input [(ngModel)]="form.port" type="number" class="field w-24" placeholder="9100" />
              </div>
            </div>
          }

          <!-- Agent key -->
          @if (form.connection === 'agent') {
            <div>
              <label class="section-title block mb-1.5">Ключ агента</label>
              <input [(ngModel)]="form.agent_key" class="field"
                     placeholder="Уникальный ключ из настроек агента" />
              <p class="text-xs mt-1" style="color:var(--color-muted)">
                Установите агент на ПК с подключённым принтером. Ключ должен совпадать.
              </p>
            </div>
          }

          <!-- Width -->
          <div>
            <label class="section-title block mb-1.5">Ширина чека</label>
            <div class="flex gap-2">
              @for (w of [32, 40, 42, 48, 58, 80]; track w) {
                <button (click)="form.width = w"
                        class="btn btn-sm" style="flex:1"
                        [class]="form.width === w ? 'btn-primary' : 'btn-outline'">{{ w }}</button>
              }
            </div>
            <p class="text-xs mt-1" style="color:var(--color-muted)">
              Символов в строке (48 — стандарт для 80мм бумаги)
            </p>
          </div>

          <!-- Flags -->
          <div class="flex gap-3">
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" [(ngModel)]="form.is_default"
                     class="w-4 h-4 rounded accent-amber-500" />
              <span class="text-sm font-medium">По умолчанию</span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" [(ngModel)]="form.is_active"
                     class="w-4 h-4 rounded accent-amber-500" />
              <span class="text-sm font-medium">Активен</span>
            </label>
          </div>
        </div>

        <!-- Footer -->
        <div class="flex-shrink-0 px-5 py-4" style="border-top:1px solid var(--color-border)">
          <button (click)="saveForm()" [disabled]="saving() || !form.name.trim()"
                  class="btn btn-primary btn-full" style="height:48px">
            {{ saving() ? 'Сохранение...' : (editId() ? 'Сохранить' : 'Добавить принтер') }}
          </button>
        </div>
      </div>
    }

    <!-- ── Delete confirm ────────────────────────────────────────── -->
    @if (deleteTarget()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center px-4"
           style="background:rgba(0,0,0,0.45)" (click)="deleteTarget.set(null)">
      </div>
      <div class="fixed left-4 right-4 z-[60] rounded-2xl p-5 md:left-1/2 md:-translate-x-1/2 md:w-80"
           style="background:white;top:50%;transform:translateY(-50%);box-shadow:0 8px 32px rgba(0,0,0,0.2)">
        <p class="font-bold mb-1">Удалить принтер?</p>
        <p class="text-sm mb-4" style="color:var(--color-muted)">
          «{{ deleteTarget()!.name }}» будет удалён безвозвратно.
        </p>
        <div class="flex gap-2">
          <button (click)="deleteTarget.set(null)" class="btn btn-ghost btn-sm" style="flex:1">
            Отмена
          </button>
          <button (click)="doDelete()" [disabled]="saving()"
                  class="btn btn-sm" style="flex:1;background:var(--color-red);color:white">
            {{ saving() ? '...' : 'Удалить' }}
          </button>
        </div>
      </div>
    }
  `
})
export class PrintersPage implements OnInit {
  private api = inject(ApiService);

  printers     = signal<Printer[]>([]);
  loading      = signal(true);
  saving       = signal(false);
  testing      = signal<number | null>(null);
  testResult   = signal<Record<number, { ok: boolean; error?: string }>>({});

  formOpen     = signal(false);
  editId       = signal<number | null>(null);
  deleteTarget = signal<Printer | null>(null);

  form: PrinterForm = BLANK_FORM();

  ngOnInit() { this.load(); }

  load() {
    this.loading.set(true);
    this.api.getPrinters().subscribe({
      next: list => { this.printers.set(list); this.loading.set(false); },
      error: ()   => this.loading.set(false),
    });
  }

  openCreate() {
    this.editId.set(null);
    this.form = BLANK_FORM();
    this.formOpen.set(true);
  }

  openEdit(p: Printer) {
    this.editId.set(p.id);
    this.form = {
      name: p.name, connection: p.connection, host: p.host,
      port: p.port, agent_key: p.agent_key, width: p.width,
      is_default: p.is_default, is_active: p.is_active,
    };
    this.formOpen.set(true);
  }

  closeForm() { this.formOpen.set(false); }

  saveForm() {
    if (this.saving() || !this.form.name.trim()) return;
    this.saving.set(true);
    const id = this.editId();
    const req = id
      ? this.api.updatePrinter(id, this.form)
      : this.api.createPrinter(this.form);

    req.subscribe({
      next: () => { this.saving.set(false); this.closeForm(); this.load(); },
      error: ()  => this.saving.set(false),
    });
  }

  confirmDelete(p: Printer) { this.deleteTarget.set(p); }

  doDelete() {
    const p = this.deleteTarget();
    if (!p || this.saving()) return;
    this.saving.set(true);
    this.api.deletePrinter(p.id).subscribe({
      next: () => { this.saving.set(false); this.deleteTarget.set(null); this.load(); },
      error: ()  => this.saving.set(false),
    });
  }

  testPrint(p: Printer) {
    if (this.testing() !== null) return;
    this.testing.set(p.id);
    this.testResult.update(m => { const n = { ...m }; delete n[p.id]; return n; });
    this.api.testPrinter(p.id).subscribe({
      next: res => {
        this.testing.set(null);
        this.testResult.update(m => ({ ...m, [p.id]: res }));
        setTimeout(() => this.testResult.update(m => { const n = { ...m }; delete n[p.id]; return n; }), 5000);
      },
      error: () => {
        this.testing.set(null);
        this.testResult.update(m => ({ ...m, [p.id]: { ok: false, error: 'Ошибка соединения' } }));
        setTimeout(() => this.testResult.update(m => { const n = { ...m }; delete n[p.id]; return n; }), 5000);
      },
    });
  }
}
