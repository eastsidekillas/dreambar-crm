import { Component, computed, inject } from '@angular/core';
import { NetworkService } from '../../core/services/network.service';
import { OutboxService } from '../../core/services/outbox.service';

/**
 * Глобальная плашка состояния сети и офлайн-очереди.
 * Показывается только когда есть что сообщить (офлайн / идёт синхронизация / ошибка).
 */
@Component({
  selector: 'offline-banner',
  standalone: true,
  template: `
    @if (state(); as s) {
      <div class="ob-bar" [style.background]="s.bg" [style.color]="s.fg">
        <span class="ob-dot" [style.background]="s.fg" [class.ob-pulse]="s.pulse"></span>
        <span class="ob-msg">{{ s.text }}</span>
      </div>
    }
  `,
  styles: [`
    .ob-bar {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9998;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 6px 12px;
      font-size: 12.5px;
      font-weight: 600;
      text-align: center;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      pointer-events: none;
      animation: ob-drop 0.2s ease both;
    }
    @keyframes ob-drop { from { transform: translateY(-100%); } to { transform: translateY(0); } }
    .ob-dot { width: 8px; height: 8px; border-radius: 9999px; flex-shrink: 0; }
    .ob-pulse { animation: ob-blink 1.1s ease-in-out infinite; }
    @keyframes ob-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.25; } }
    .ob-msg { line-height: 1.3; }
  `],
})
export class OfflineBannerComponent {
  private net = inject(NetworkService);
  private outbox = inject(OutboxService);

  readonly state = computed(() => {
    const online = this.net.online();
    const pending = this.outbox.pendingCount();
    const errors = this.outbox.hasErrors();

    if (!online) {
      return {
        bg: '#7f1d1d', fg: '#fecaca', pulse: true,
        text: pending > 0
          ? `🔴 Нет сети — работаете офлайн · ${pending} в очереди (синхр. при подключении)`
          : '🔴 Нет сети — работаете офлайн, действия сохраняются',
      };
    }
    if (pending > 0) {
      return { bg: '#1e3a8a', fg: '#bfdbfe', pulse: true, text: `⏳ Синхронизация… осталось ${pending}` };
    }
    if (errors) {
      return { bg: '#92400e', fg: '#fde68a', pulse: false, text: '⚠ Часть действий не удалось синхронизировать — проверьте столы' };
    }
    return null;
  });
}