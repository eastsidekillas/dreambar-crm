import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ThemeService, ThemeMode } from '../../../core/services/theme.service';
import { LoggerService, LogLevel } from '../../../core/services/logger.service';
import { environment } from '../../../../environments/environment';
import { LucideDynamicIcon, LucideSettings, LucideTrash2, LucideSun, LucideMoon, LucideMonitor } from '@lucide/angular';
import type { LucideIconInput } from '@lucide/angular';

/** Настройки официанта: тема приложения, логи (диагностика), версия. */
@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideSettings, LucideTrash2],
  host: { class: 'block' },
  template: `
    <div class="flex items-center gap-2 mb-4">
      <svg lucideSettings [size]="20" style="color:var(--color-muted)"></svg>
      <h1 class="text-xl font-bold">Настройки</h1>
    </div>

    <!-- ── Тема ── -->
    <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">ТЕМА</p>
    <div class="grid grid-cols-3 gap-2 mb-5">
      @for (m of modes; track m.value) {
        <button (click)="theme.set(m.value)"
                class="flex flex-col items-center gap-1.5 py-3 rounded-xl text-sm font-semibold"
                [style.background]="theme.mode() === m.value ? 'var(--color-gold-light)' : 'var(--color-surface)'"
                [style.border]="'1.5px solid ' + (theme.mode() === m.value ? 'var(--color-gold-mid)' : 'var(--color-border)')"
                [style.color]="theme.mode() === m.value ? 'var(--color-gold-hover)' : 'var(--color-text)'">
          <svg [lucideIcon]="m.icon" [size]="20"></svg>
          {{ m.label }}
        </button>
      }
    </div>

    <!-- ── Логи ── -->
    <div class="flex items-center justify-between mb-1.5">
      <p class="text-xs font-semibold" style="color:var(--color-muted)">ЛОГИ · {{ logger.entries().length }}</p>
      @if (logger.entries().length) {
        <button (click)="logger.clear()" class="flex items-center gap-1 text-xs font-medium" style="color:var(--color-red)">
          <svg lucideTrash2 [size]="13"></svg> Очистить
        </button>
      }
    </div>
    <div class="mb-5" style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px;overflow:hidden">
      @if (!logger.entries().length) {
        <p class="text-sm text-center py-6" style="color:var(--color-muted)">Логов пока нет</p>
      } @else {
        <div style="max-height:42dvh;overflow-y:auto">
          @for (e of logger.entries(); track $index) {
            <div class="flex items-start gap-2 px-3 py-2" style="border-bottom:1px solid var(--color-border)">
              <span class="text-xs font-mono flex-shrink-0" style="color:var(--color-light)">{{ fmt(e.ts) }}</span>
              <span class="text-xs font-bold uppercase flex-shrink-0" [style.color]="levelColor(e.level)">{{ e.level }}</span>
              <span class="text-xs flex-1 break-words">{{ e.msg }}</span>
            </div>
          }
        </div>
      }
    </div>

    <!-- ── Версия ── -->
    <p class="text-xs font-semibold mb-1.5" style="color:var(--color-muted)">ВЕРСИЯ</p>
    <div class="flex items-center justify-between px-3 py-3"
         style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:14px">
      <span class="text-sm">Версия приложения</span>
      <span class="text-sm font-mono font-semibold">{{ version }}</span>
    </div>
  `,
})
export class SettingsPage {
  theme = inject(ThemeService);
  logger = inject(LoggerService);
  version = environment.appVersion;

  modes: { value: ThemeMode; label: string; icon: LucideIconInput }[] = [
    { value: 'light',  label: 'Светлая',   icon: LucideSun },
    { value: 'dark',   label: 'Тёмная',    icon: LucideMoon },
    { value: 'system', label: 'Системная', icon: LucideMonitor },
  ];

  levelColor(l: LogLevel): string {
    return l === 'error' ? 'var(--color-red)' : l === 'warn' ? 'var(--color-amber)' : 'var(--color-muted)';
  }
  fmt(ts: number): string {
    return new Date(ts).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}