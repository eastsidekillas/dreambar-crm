import { Injectable, inject } from '@angular/core';
import { Receipt } from '../../core/models';
import { ApiService } from '../../core/services/api.service';
import { ToastService } from '../../shared/ui';

/**
 * Печать чека. Открывает отдельное окно с версткой чека под узкую ленту (~58мм)
 * и вызывает печать. Работает без зависимостей и не вмешивается в DOM приложения.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptPrintService {
  private api = inject(ApiService);
  private toast = inject(ToastService);

  /**
   * Аппаратная печать на термопринтере (ATOL RP-326) через backend.
   * При ошибке сети/сервера откатывается на браузерную печать `print()`.
   */
  printHardware(receipts: Receipt | Receipt[]): void {
    const list = Array.isArray(receipts) ? receipts : [receipts];
    for (const r of list) {
      this.api.printReceipt(r.id).subscribe({
        next: (res) => {
          if (res.status === 'error') {
            this.toast.error(`Принтер: ${res.error || 'ошибка печати'}`);
          } else if (res.status === 'pending') {
            this.toast.show(`Чек ${r.code} отправлен на печать`, 'info');
          } else {
            this.toast.success(`Чек ${r.code} напечатан`);
          }
        },
        error: () => {
          this.toast.error('Принтер недоступен — печать в браузере');
          this.print(r);
        },
      });
    }
  }

  print(receipts: Receipt | Receipt[]): void {
    const list = Array.isArray(receipts) ? receipts : [receipts];
    if (!list.length) return;

    const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8">
      <title>Чек ${list.map(r => r.code).join(', ')}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Courier New',monospace; color:#000; background:#fff;
               font-size:12px; line-height:1.35; }
        .receipt { width:280px; margin:0 auto; padding:10px 8px 18px; }
        .center { text-align:center; }
        .brand { font-size:16px; font-weight:bold; letter-spacing:2px; }
        .muted { color:#000; font-size:11px; }
        .hr { border-top:1px dashed #000; margin:6px 0; }
        .row { display:flex; justify-content:space-between; gap:8px; }
        .row .name { flex:1; }
        .row .num { white-space:nowrap; }
        .qty { color:#000; }
        .total { font-size:14px; font-weight:bold; }
        .small { font-size:10px; }
        @media print { @page { margin:0; } body { width:auto; } }
      </style></head><body>
      ${list.flatMap(r => [this.renderReceipt(r, ''), this.renderReceipt(r, 'ДЛЯ СВЕРКИ')])
            .join('<div style="page-break-after:always"></div>')}
      <script>window.onload = function(){ window.print(); setTimeout(function(){ window.close(); }, 300); };<\/script>
    </body></html>`;

    const w = window.open('', '_blank', 'width=360,height=640');
    if (!w) {
      alert('Разрешите всплывающие окна, чтобы напечатать чек.');
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
  }

  private renderReceipt(r: Receipt, copyLabel: string): string {
    const dt = new Date(r.issued_at).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    const rows = r.items.map(it => `
      <div class="row">
        <span class="name">${this.esc(it.menu_item_name)}
          <span class="qty">×${it.quantity}</span>
          ${it.menu_item_volume ? `<br><span class="muted" style="font-size:10px">${this.esc(it.menu_item_volume)}</span>` : ''}
        </span>
        <span class="num">${this.money(it.subtotal)}</span>
      </div>`).join('');

    const labelHtml = copyLabel
      ? `<div class="hr"></div><div class="center small" style="font-weight:bold">${this.esc(copyLabel)}</div>`
      : '';

    return `<div class="receipt">
      <div class="center brand">BAR DREAM</div>
      <div class="center muted">vk.com/mydreambar</div>
      <div class="hr"></div>
      <div class="row"><span>Чек №</span><span>${r.code}</span></div>
      <div class="row"><span>Стол</span><span>${this.esc(r.table_number) || '—'}</span></div>
      <div class="row"><span>Официант</span><span>${this.esc(r.waiter_name) || '—'}</span></div>
      <div class="row"><span>Дата</span><span>${dt}</span></div>
      <div class="hr"></div>
      ${rows}
      <div class="hr"></div>
      <div class="row total"><span>ИТОГО</span><span>${this.money(r.total)} ₽</span></div>
      ${r.deposit_amount > 0 ? `<div class="row"><span>Депозит (${this.esc(r.deposit_method_label || r.deposit_method || '')})</span><span>−${this.money(r.deposit_amount)} ₽</span></div>
      <div class="row total"><span>К оплате</span><span>${this.money(+r.total - +r.deposit_amount)} ₽</span></div>` : ''}
      <div class="row"><span>Оплата</span><span>${this.esc(r.payment_label)}</span></div>
      <div class="hr"></div>
      <div class="center small">Спасибо за визит!</div>
      ${labelHtml}
    </div>`;
  }

  private money(v: number | string): string {
    return new Intl.NumberFormat('ru-RU').format(Math.round(Number(v)));
  }
  private esc(s: string): string {
    return (s ?? '').replace(/[&<>"]/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
  }
}
