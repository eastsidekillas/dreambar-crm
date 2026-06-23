import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BdToastComponent } from './shared/ui/toast/toast.component';
import { ConnectivityService } from './core/services/connectivity.service';
import { OfflineService } from './core/services/offline.service';
import { PwaUpdateService } from './core/services/pwa-update.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { LoggerService } from './core/services/logger.service';
import { SystemStatusService } from './core/services/system-status.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BdToastComponent],
  template: `
    @if (connectivity.offline()) {
      <div class="offline-banner">
        ⚠ Нет связи с сервером — данные могут быть устаревшими
        @if (offline.pendingCount() > 0) { · {{ offline.pendingCount() }} изм. ждут отправки }
      </div>
    } @else if (offline.pendingCount() > 0) {
      <div class="offline-banner" style="background:#B8922A">
        ↻ Синхронизация: {{ offline.pendingCount() }} изм.
      </div>
    }
    @if (pwa.updateReady()) {
      <button class="update-banner" (click)="pwa.apply()">
        ↻ Доступно обновление — нажмите, чтобы обновить
      </button>
    }
    <router-outlet /><bd-toast />

    @if (system.stopped()) {
      <div class="stop-overlay">
        <div class="stop-card">
          <div class="stop-icon">⏻</div>
          <h1>Программа остановлена</h1>
          <p>{{ system.message() || 'Работа приложения временно приостановлена.' }}</p>
        </div>
      </div>
    }
  `,
  styles: [`
    .offline-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9999;
      padding: 6px 12px;
      padding-top: calc(6px + env(safe-area-inset-top, 0px));
      background: #dc2626;
      color: white;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
    }
    .update-banner {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9999;
      padding: 10px 12px;
      padding-top: calc(10px + env(safe-area-inset-top, 0px));
      border: none;
      background: #B8922A;
      color: white;
      font-size: 13px;
      font-weight: 600;
      text-align: center;
      cursor: pointer;
    }
    /* Полноэкранная заглушка остановки — поверх всего, перехватывает любые касания. */
    .stop-overlay {
      position: fixed;
      inset: 0;
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      padding-top: calc(24px + env(safe-area-inset-top, 0px));
      background: #0c0a09;
      color: #fafaf9;
      -webkit-user-select: none;
      user-select: none;
    }
    .stop-card { max-width: 420px; text-align: center; }
    .stop-icon {
      font-size: 64px;
      line-height: 1;
      color: #dc2626;
      margin-bottom: 20px;
    }
    .stop-card h1 {
      margin: 0 0 12px;
      font-size: 1.5rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }
    .stop-card p {
      margin: 0;
      font-size: 1rem;
      line-height: 1.5;
      color: #a8a29e;
    }
  `],
})
export class App implements OnInit {
  readonly connectivity = inject(ConnectivityService);
  readonly offline = inject(OfflineService);
  readonly pwa = inject(PwaUpdateService);
  private auth = inject(AuthService);
  private router = inject(Router);
  // Инстанцируем на старте: тема применяется к <html>, логгер ловит глобальные ошибки.
  private theme = inject(ThemeService);
  private logger = inject(LoggerService);
  readonly system = inject(SystemStatusService);

  /** Авто-блокировка по бездействию (важно для всегда-открытого бармен-POS). */
  private readonly IDLE_LOCK_MS = 60 * 60 * 1000;   // 1 час
  private idleTimer: any;

  ngOnInit() {
    this.pwa.init();
    this.system.start();   // опрос «рубильника» остановки
    // PIN при сворачивании/смене вкладки НЕ требуем (неудобно). Блокировка только при
    // ЗАКРЫТИИ: флаг разблокировки в sessionStorage снимается при закрытии вкладки/приложения,
    // поэтому холодный старт → /pin (см. guards). Сворачивание/фон сессию не сбрасывают.
    // Дополнительно — авто-лок по бездействию (для всегда-открытого бармен-POS).
    const reset = () => this.resetIdle();
    ['pointerdown', 'keydown', 'touchstart'].forEach(ev =>
      window.addEventListener(ev, reset, { passive: true }));
    this.resetIdle();
  }

  private resetIdle() {
    clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.auth.isLoggedIn() && this.auth.isUnlocked()) {
        this.auth.lock();
        this.router.navigate(['/pin']);
      }
    }, this.IDLE_LOCK_MS);
  }
}