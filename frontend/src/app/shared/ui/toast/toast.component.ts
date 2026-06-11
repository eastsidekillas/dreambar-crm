import type { LucideIconInput } from '@lucide/angular';
import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService, ToastType } from './toast.service';
import {
  LucideDynamicIcon,
  LucideCheck, LucideX, LucideTriangleAlert, LucideInfo,
} from '@lucide/angular';

const ICONS: Record<ToastType, LucideIconInput> = {
  success: LucideCheck,
  error:   LucideX,
  warn:    LucideTriangleAlert,
  info:    LucideInfo,
};

@Component({
  selector: 'bd-toast',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideX],
  template: `
    <div class="bd-toast-container">
      @for (t of svc.toasts(); track t.id) {
        <div class="bd-toast bd-toast-{{ t.type }}" (click)="svc.dismiss(t.id)">
          <span class="bd-toast-icon"><svg [lucideIcon]="icon(t.type)" [size]="15"></svg></span>
          <span class="bd-toast-msg">{{ t.message }}</span>
          <button class="bd-toast-close" (click)="svc.dismiss(t.id); $event.stopPropagation()">
            <svg lucideX [size]="11"></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .bd-toast-container {
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      width: min(92vw, 440px);
      display: flex;
      flex-direction: column;
      gap: 8px;
      z-index: 9999;
      pointer-events: none;
    }
    .bd-toast {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 13px 14px;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.45;
      box-shadow: 0 8px 32px rgba(0,0,0,0.45);
      pointer-events: all;
      cursor: pointer;
      animation: bd-slide-up 0.22s cubic-bezier(.2,.8,.4,1) both;
    }
    @keyframes bd-slide-up {
      from { opacity: 0; transform: translateY(18px) scale(0.97); }
      to   { opacity: 1; transform: translateY(0)    scale(1); }
    }
    .bd-toast-success {
      background: #0d2318;
      border: 1px solid #166534;
      color: #86efac;
    }
    .bd-toast-error {
      background: #200d0d;
      border: 1px solid #991b1b;
      color: #fca5a5;
    }
    .bd-toast-warn {
      background: #1c1500;
      border: 1px solid #92400e;
      color: #fcd34d;
    }
    .bd-toast-info {
      background: #0c1829;
      border: 1px solid #1e40af;
      color: #93c5fd;
    }
    .bd-toast-icon {
      font-size: 15px;
      flex-shrink: 0;
      margin-top: 1px;
      font-weight: 700;
    }
    .bd-toast-msg {
      flex: 1;
      word-break: break-word;
    }
    .bd-toast-close {
      background: none;
      border: none;
      color: inherit;
      opacity: 0.45;
      font-size: 11px;
      cursor: pointer;
      flex-shrink: 0;
      padding: 2px 0 0 4px;
      line-height: 1;
      transition: opacity 0.15s;
    }
    .bd-toast-close:hover { opacity: 0.85; }
  `],
})
export class BdToastComponent {
  svc = inject(ToastService);
  icon(type: ToastType): LucideIconInput { return ICONS[type] ?? LucideInfo; }
}
