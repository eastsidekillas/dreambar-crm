import { Component, OnInit, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { SwUpdate, VersionReadyEvent } from '@angular/service-worker';
import { filter } from 'rxjs/operators';
import { BdToastComponent } from './shared/ui/toast/toast.component';
import { OfflineBannerComponent } from './widgets/offline-banner/offline-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BdToastComponent, OfflineBannerComponent],
  template: `
    <offline-banner />
    <router-outlet />
    @if (updateReady()) {
      <button class="bd-update-fab" (click)="reload()">⬆ Обновить приложение</button>
    }
    <bd-toast />
  `,
  styles: [`
    .bd-update-fab {
      position: fixed;
      left: 50%;
      bottom: 92px;
      transform: translateX(-50%);
      z-index: 9999;
      padding: 10px 18px;
      border: none;
      border-radius: 9999px;
      background: #166534;
      color: #fff;
      font-size: 13px;
      font-weight: 700;
      box-shadow: 0 6px 20px rgba(0,0,0,0.4);
      cursor: pointer;
      animation: bd-fab-in 0.25s ease both;
    }
    @keyframes bd-fab-in { from { opacity: 0; transform: translate(-50%, 10px); } to { opacity: 1; transform: translate(-50%, 0); } }
  `],
})
export class App implements OnInit {
  private swUpdate = inject(SwUpdate);
  readonly updateReady = signal(false);

  ngOnInit(): void {
    if (!this.swUpdate.isEnabled) return;
    this.swUpdate.versionUpdates
      .pipe(filter((e): e is VersionReadyEvent => e.type === 'VERSION_READY'))
      .subscribe(() => this.updateReady.set(true));
    // Периодически проверяем обновления (на случай долгой смены без перезагрузки).
    setInterval(() => this.swUpdate.checkForUpdate().catch(() => {}), 5 * 60_000);
  }

  reload(): void {
    this.swUpdate.activateUpdate().then(() => document.location.reload());
  }
}