import type { LucideIconInput } from '@lucide/angular';
import { ROLE_LABEL, ROLE_ICON } from '../../shared/lib/roles';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models';
import {
  LucideDynamicIcon, LucideGlassWater, LucideCalendar,
} from '@lucide/angular';

const ROLE_DESC: Record<string, string> = {
  admin:     'Управление сменами, меню, персоналом',
  waiter:    'Приём заказов за столами',
  bartender: 'Работа за барной стойкой',
  kitchen:   'Экран повара — статус блюд',
  wardrobe:  'Продажа входных билетов',
};

/** Пункт на экране выбора: роль или отдельный интерфейс внутри роли. */
interface RoleOption {
  role: Role;
  label: string;
  icon: LucideIconInput;
  desc: string;
  /** Куда вести; по умолчанию — landingRoute роли. */
  route?: string;
}

@Component({
  selector: 'app-role-select',
  standalone: true,
  imports: [CommonModule, LucideDynamicIcon, LucideGlassWater],
  template: `
    <div class="min-h-screen flex items-center justify-center px-4" style="background:var(--color-bg)">
      <div class="w-full max-w-md">

        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
               style="background:var(--color-gold)">
            <svg lucideGlassWater [size]="32" style="color:white"></svg>
          </div>
          <h1 class="text-2xl font-bold" style="color:var(--color-text)">Кем работаешь сегодня?</h1>
          <p class="text-sm mt-1" style="color:var(--color-muted)">{{ userName }}</p>
        </div>

        <div class="space-y-3">
          @for (opt of options; track $index) {
            <button (click)="selectOption(opt)"
              class="w-full text-left p-4 rounded-xl transition-all"
              style="background:var(--color-surface);border:2px solid var(--color-border)"
              (mouseenter)="hovered = $index" (mouseleave)="hovered = null"
              [style.border-color]="hovered === $index ? 'var(--color-gold)' : 'var(--color-border)'">
              <div class="flex items-center gap-4">
                <svg [lucideIcon]="opt.icon" [size]="28"></svg>
                <div>
                  <div class="font-semibold" style="color:var(--color-text)">{{ opt.label }}</div>
                  <div class="text-sm" style="color:var(--color-muted)">{{ opt.desc }}</div>
                </div>
                <span class="ml-auto text-lg" style="color:var(--color-muted)">→</span>
              </div>
            </button>
          }
        </div>

        <button (click)="auth.logout()" class="mt-6 w-full text-center text-sm" style="color:var(--color-muted)">
          Выйти
        </button>
      </div>
    </div>
  `
})
export class RoleSelectPage implements OnInit {
  options: RoleOption[] = [];
  userName = '';
  hovered: number | null = null;

  constructor(readonly auth: AuthService, private router: Router) {}

  ngOnInit() {
    const user = this.auth.user();
    if (!user) { this.router.navigateByUrl('/login'); return; }

    this.options = this.buildOptions(user.allowed_roles ?? []);
    // Один пункт — выбирать нечего, сразу на рабочий экран
    if (this.options.length <= 1) {
      const only = this.options[0];
      if (only) this.auth.setActiveRole(only.role);
      this.router.navigateByUrl(only?.route ?? this.auth.landingRoute(only?.role));
      return;
    }
    this.userName = user.display_name || user.username;
  }

  private buildOptions(allowed: Role[]): RoleOption[] {
    const options: RoleOption[] = [];
    for (const role of allowed) {
      options.push({
        role,
        label: ROLE_LABEL[role] ?? role,
        icon: ROLE_ICON[role] ?? ROLE_ICON['waiter'],
        desc: ROLE_DESC[role] ?? '',
      });
      // У бармена два интерфейса: барный терминал и мобильные брони
      if (role === 'bartender') {
        options.push({
          role,
          label: 'Брони',
          icon: LucideCalendar,
          desc: 'Приём броней с телефона',
          route: '/bartender/reservations',
        });
      }
    }
    return options;
  }

  selectOption(opt: RoleOption) {
    this.auth.setActiveRole(opt.role);
    this.router.navigateByUrl(opt.route ?? this.auth.landingRoute(opt.role));
  }
}