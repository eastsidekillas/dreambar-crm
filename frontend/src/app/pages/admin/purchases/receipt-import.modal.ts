import { Component, ElementRef, EventEmitter, OnDestroy, Output, ViewChild, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InventoryApi } from '../../../entities/inventory';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { Product, ReceiptImport, ReceiptImportLine } from '../../../core/models';
import { LucideX, LucideCamera, LucideCircleCheck, LucidePackage } from '@lucide/angular';

const POLL_MS = 3000;

/**
 * Импорт кассового чека магазина: скан QR (камера) или вставка ссылки →
 * сервис проверки чеков → сопоставление позиций товарам → оприходование.
 */
@Component({
  selector: 'receipt-import-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideX, LucideCamera, LucideCircleCheck, LucidePackage],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50" style="background:rgba(0,0,0,0.5)" (click)="close()"></div>
      <div class="fixed inset-x-0 bottom-0 md:inset-0 md:m-auto z-[60] flex flex-col rounded-t-2xl md:rounded-2xl overflow-hidden"
           style="background:white;max-height:92dvh;md:max-width:720px;max-width:100%;width:100%;margin-inline:auto;align-self:center"
           [style.max-width]="'720px'">

        <div class="flex-shrink-0 flex items-center justify-between px-4 py-3"
             style="border-bottom:1px solid var(--color-border)">
          <h2 class="font-bold text-base">Чек из магазина (QR)</h2>
          <button (click)="close()" class="btn btn-ghost btn-sm"><svg lucideX [size]="16"></svg></button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">

          <!-- ── Шаг 1: получить QR ── -->
          @if (step() === 'scan') {
            <p class="text-sm" style="color:var(--color-muted)">
              Отсканируй QR-код с чека камерой или вставь ссылку из QR
              (формат <code>t=...&s=...&fn=...&i=...&fp=...</code>).
            </p>

            @if (scanning()) {
              <div class="rounded-xl overflow-hidden relative" style="background:#000">
                <video #video autoplay playsinline class="w-full" style="max-height:340px;object-fit:cover"></video>
                <button (click)="stopScan()" class="btn btn-sm absolute top-2 right-2"
                        style="background:rgba(0,0,0,0.6);color:white">Остановить</button>
              </div>
              <p class="text-xs text-center" style="color:var(--color-muted)">Наведи камеру на QR-код чека…</p>
            } @else {
              <button (click)="startScan()" class="btn btn-primary btn-full flex items-center justify-center gap-2"
                      style="height:48px">
                <svg lucideCamera [size]="18"></svg> Сканировать камерой
              </button>
              @if (scanError()) {
                <p class="text-xs" style="color:var(--color-red)">{{ scanError() }}</p>
              }
            }

            <div class="flex items-center gap-2 text-xs" style="color:var(--color-muted)">
              <span class="flex-1" style="border-top:1px solid var(--color-border)"></span>
              или вручную
              <span class="flex-1" style="border-top:1px solid var(--color-border)"></span>
            </div>

            <textarea [(ngModel)]="qrText" rows="2" class="field w-full" style="font-size:0.85rem"
                      placeholder="t=20260612T1830&s=4823.00&fn=9251440300007971&i=141637&fp=4087570038&n=1"></textarea>
            <button (click)="submitQr(qrText)" [disabled]="!qrText.trim() || submitting()"
                    class="btn btn-primary btn-full" style="height:44px">
              {{ submitting() ? 'Отправка...' : 'Загрузить чек' }}
            </button>
          }

          <!-- ── Шаг 2: ожидание проверки ── -->
          @if (step() === 'poll') {
            <div class="text-center py-10">
              <div class="inline-block w-8 h-8 rounded-full animate-spin mb-3"
                   style="border:3px solid var(--color-border);border-top-color:var(--color-gold)"></div>
              <p class="font-semibold">Проверяем чек в ФНС…</p>
              <p class="text-xs mt-1" style="color:var(--color-muted)">
                Обычно занимает 10–30 секунд. Если чек свежий, данные могут появиться у ОФД с задержкой —
                можно закрыть окно и вернуться позже, чек сохранён.
              </p>
            </div>
          }

          <!-- ── Шаг 3: сопоставление и оприходование ── -->
          @if (step() === 'map') {
            <div class="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p class="font-semibold text-sm">{{ imp()?.store || 'Магазин' }}</p>
                <p class="text-xs" style="color:var(--color-muted)">
                  {{ imp()?.purchased_at }} · итого {{ imp()?.total | number:'1.2-2' }} ₽
                </p>
              </div>
              <p class="text-xs" style="color:var(--color-muted)">
                Выбрано {{ selectedCount() }} из {{ lines().length }} · {{ selectedSum() | number:'1.2-2' }} ₽
              </p>
            </div>

            <div class="space-y-2">
              @for (l of lines(); track $index) {
                <div class="rounded-xl p-3"
                     [style]="l.product ? 'border:1.5px solid var(--color-gold);background:var(--color-gold-light)'
                                        : 'border:1px solid var(--color-border)'">
                  <div class="flex items-start justify-between gap-2">
                    <p class="text-sm font-medium flex-1" style="word-break:break-word">{{ l.name }}</p>
                    <p class="text-sm font-semibold flex-shrink-0">
                      {{ l.quantity }} × {{ l.price | number:'1.2-2' }} ₽
                    </p>
                  </div>
                  <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <select [ngModel]="l.product" (ngModelChange)="setProduct($index, $event)"
                            class="field text-sm" style="flex:1;min-width:200px;height:38px;padding:0 8px">
                      <option [ngValue]="null">— не приходовать —</option>
                      @for (p of products(); track p.id) {
                        <option [ngValue]="p.id">{{ p.name }} ({{ p.unit }})</option>
                      }
                    </select>
                    @if (l.product; as pid) {
                      <span class="text-xs flex-shrink-0" style="color:var(--color-gold-hover)">
                        +{{ stockDelta(l) }}
                      </span>
                    }
                  </div>
                </div>
              }
            </div>
          }

          <!-- ── Шаг 4: готово ── -->
          @if (step() === 'done') {
            <div class="text-center py-10">
              <svg lucideCircleCheck [size]="48" class="mx-auto mb-3" style="color:#16a34a"></svg>
              <p class="font-bold">Оприходовано</p>
              <p class="text-sm mt-1" style="color:var(--color-muted)">
                Закупка создана, остатки и закупочные цены обновлены.
              </p>
            </div>
          }

          @if (errorText()) {
            <div class="rounded-xl p-3 text-sm" style="background:var(--color-red-bg);color:var(--color-red)">
              {{ errorText() }}
            </div>
          }
        </div>

        @if (step() === 'map') {
          <div class="flex-shrink-0 p-3" style="border-top:1px solid var(--color-border)">
            <label class="flex items-center gap-2 text-sm mb-2 px-1" style="color:var(--color-muted)">
              <input type="checkbox" [(ngModel)]="rememberAll" class="w-4 h-4"/>
              Запомнить сопоставления для следующих чеков
            </label>
            <button (click)="apply()" [disabled]="!selectedCount() || submitting()"
                    class="btn btn-primary btn-full flex items-center justify-center gap-2" style="height:48px">
              <svg lucidePackage [size]="16"></svg>
              {{ submitting() ? 'Оприходование...' : 'Оприходовать ' + selectedCount() + ' поз.' }}
            </button>
          </div>
        }
        @if (step() === 'done') {
          <div class="flex-shrink-0 p-3" style="border-top:1px solid var(--color-border)">
            <button (click)="close()" class="btn btn-primary btn-full" style="height:44px">Закрыть</button>
          </div>
        }
      </div>
    }
  `,
})
export class ReceiptImportModal implements OnDestroy {
  @Output() applied = new EventEmitter<void>();
  @ViewChild('video') videoRef?: ElementRef<HTMLVideoElement>;

  private api   = inject(InventoryApi);
  private toast = inject(ToastService);

  open       = signal(false);
  step       = signal<'scan' | 'poll' | 'map' | 'done'>('scan');
  submitting = signal(false);
  scanning   = signal(false);
  scanError  = signal('');
  errorText  = signal('');
  imp        = signal<ReceiptImport | null>(null);
  lines      = signal<ReceiptImportLine[]>([]);
  products   = signal<Product[]>([]);

  qrText = '';
  rememberAll = true;

  private pollTimer?: ReturnType<typeof setInterval>;
  private mediaStream?: MediaStream;
  private detectTimer?: ReturnType<typeof setInterval>;

  selectedCount = computed(() => this.lines().filter(l => l.product).length);
  selectedSum   = computed(() =>
    this.lines().filter(l => l.product).reduce((s, l) => s + +l.sum, 0));

  show() {
    this.open.set(true);
    this.step.set('scan');
    this.qrText = '';
    this.errorText.set('');
    this.scanError.set('');
    this.imp.set(null);
    this.lines.set([]);
    if (!this.products().length) {
      this.api.getProducts().subscribe(p => this.products.set(p.filter(x => x.is_active)));
    }
  }

  close() {
    this.open.set(false);
    this.stopScan();
    this.stopPoll();
  }

  ngOnDestroy() { this.close(); }

  // ── Сканирование камерой (BarcodeDetector, есть в Chrome/Android) ──
  async startScan() {
    const Detector = (window as any).BarcodeDetector;
    if (!Detector) {
      this.scanError.set('Сканер не поддерживается этим браузером — вставь ссылку из QR вручную (камера телефона сама распознаёт QR и даёт скопировать ссылку).');
      return;
    }
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
    } catch {
      this.scanError.set('Нет доступа к камере — разреши доступ или вставь ссылку вручную.');
      return;
    }
    this.scanning.set(true);
    setTimeout(() => {
      const video = this.videoRef?.nativeElement;
      if (!video || !this.mediaStream) return;
      video.srcObject = this.mediaStream;
      const detector = new Detector({ formats: ['qr_code'] });
      this.detectTimer = setInterval(async () => {
        try {
          const codes = await detector.detect(video);
          if (codes.length && codes[0].rawValue) {
            const value = codes[0].rawValue as string;
            this.stopScan();
            this.submitQr(value);
          }
        } catch { /* кадр не готов — пробуем дальше */ }
      }, 400);
    });
  }

  stopScan() {
    if (this.detectTimer) { clearInterval(this.detectTimer); this.detectTimer = undefined; }
    this.mediaStream?.getTracks().forEach(t => t.stop());
    this.mediaStream = undefined;
    this.scanning.set(false);
  }

  // ── Отправка и опрос ───────────────────────────────────────────────
  submitQr(qr: string) {
    qr = (qr || '').trim();
    if (!qr || this.submitting()) return;
    this.submitting.set(true);
    this.errorText.set('');
    this.api.createReceiptImport(qr).subscribe({
      next: imp => {
        this.submitting.set(false);
        this.imp.set(imp);
        this.step.set('poll');
        this.startPoll(imp.id);
      },
      error: err => {
        this.submitting.set(false);
        const detail = err?.error?.detail || 'Не удалось отправить чек';
        this.errorText.set(detail);
        // Чек уже загружали — открываем его
        const existingId = err?.error?.existing_id;
        if (err?.status === 409 && existingId) {
          this.errorText.set('');
          this.step.set('poll');
          this.startPoll(existingId);
        }
      },
    });
  }

  private startPoll(id: number) {
    this.stopPoll();
    const tick = () => this.api.pollReceiptImport(id).subscribe({
      next: imp => {
        this.imp.set(imp);
        if (imp.status === 'done' || imp.status === 'applied') {
          this.stopPoll();
          this.lines.set((imp.lines ?? []).map(l => ({ ...l })));
          this.step.set(imp.status === 'applied' ? 'done' : 'map');
        } else if (imp.status === 'error') {
          this.stopPoll();
          this.step.set('scan');
          this.errorText.set('Чек не прошёл проверку: ' + (imp.error || 'неизвестная ошибка'));
        }
      },
      error: err => this.errorText.set(err?.error?.detail || 'Ошибка опроса сервиса'),
    });
    tick();
    this.pollTimer = setInterval(tick, POLL_MS);
  }

  private stopPoll() {
    if (this.pollTimer) { clearInterval(this.pollTimer); this.pollTimer = undefined; }
  }

  // ── Сопоставление и оприходование ─────────────────────────────────
  setProduct(idx: number, productId: number | null) {
    this.lines.update(ls => ls.map((l, i) => i === idx ? { ...l, product: productId } : l));
  }

  /** Подпись «+3000 мл» — на сколько вырастет остаток. */
  stockDelta(l: ReceiptImportLine): string {
    const p = this.products().find(x => x.id === l.product);
    if (!p) return '';
    const units = +l.quantity * +p.pack_size;
    return `${+units.toFixed(3)} ${p.unit}`;
  }

  apply() {
    const imp = this.imp();
    if (!imp || this.submitting()) return;
    this.submitting.set(true);
    const payload = this.lines()
      .filter(l => l.product)
      .map(l => ({ ...l, remember: this.rememberAll }));
    this.api.applyReceiptImport(imp.id, payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.step.set('done');
        this.toast.success('Чек оприходован — остатки обновлены');
        this.applied.emit();
      },
      error: err => {
        this.submitting.set(false);
        this.errorText.set(err?.error?.detail || 'Не удалось оприходовать чек');
      },
    });
  }
}