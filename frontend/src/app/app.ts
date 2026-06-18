import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BdToastComponent } from './shared/ui/toast/toast.component';
import { ConnectivityService } from './core/services/connectivity.service';
import { PwaUpdateService } from './core/services/pwa-update.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { LoggerService } from './core/services/logger.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BdToastComponent],
  template: `
    @if (connectivity.offline()) {
      <div class="offline-banner">
        ⚠ Нет связи с сервером — данные могут быть устаревшими
      </div>
    }
    @if (pwa.updateReady()) {
      <button class="update-banner" (click)="pwa.apply()">
        ↻ Доступно обновление — нажмите, чтобы обновить
      </button>
    }
    <router-outlet /><bd-toast />
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
  `],
})
export class App implements OnInit {
  readonly connectivity = inject(ConnectivityService);
  readonly pwa = inject(PwaUpdateService);
  private auth = inject(AuthService);
  private router = inject(Router);
  // Инстанцируем на старте: тема применяется к <html>, логгер ловит глобальные ошибки.
  private theme = inject(ThemeService);
  private logger = inject(LoggerService);

  /** Авто-блокировка по бездействию (важно для всегда-открытого бармен-POS). */
  private readonly IDLE_LOCK_MS = 60 * 60 * 1000;   // 1 час
  private idleTimer: any;

  ngOnInit() {
    this.pwa.init();
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