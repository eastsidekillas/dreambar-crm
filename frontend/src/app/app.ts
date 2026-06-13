import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BdToastComponent } from './shared/ui/toast/toast.component';
import { ConnectivityService } from './core/services/connectivity.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BdToastComponent],
  template: `
    @if (connectivity.offline()) {
      <div class="offline-banner">
        ⚠ Нет связи с сервером — данные могут быть устаревшими
      </div>
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
  `],
})
export class App {
  readonly connectivity = inject(ConnectivityService);
}