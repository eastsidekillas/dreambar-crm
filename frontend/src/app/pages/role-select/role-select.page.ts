import type { LucideIconInput } from '@lucide/angular';
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { Role } from '../../core/models';
import {
  LucideDynamicIcon,
  LucideUser, LucideGlassWater, LucideChefHat, LucideShirt, LucideCrown,
} from '@lucide/angular';

const ROLE_META: Record<string, { label: string; icon: LucideIconInput; desc: string }> = {
  admin:     { label: 'Администратор', icon: LucideCrown,      desc: 'Управление сменами, меню, персоналом' },
  waiter:    { label: 'Официант',      icon: LucideUser,        desc: 'Приём заказов за столами' },
  bartender: { label: 'Бармен',        icon: LucideGlassWater,  desc: 'Работа за барной стойкой' },
  kitchen:   { label: 'Кухня',         icon: LucideChefHat,     desc: 'Экран повара — статус блюд' },
  wardrobe:  { label: 'Гардероб',      icon: LucideShirt,       desc: 'Продажа входных билетов' },
};

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
          @for (role of availableRoles; track role) {
            <button (click)="selectRole(role)"
              class="w-full text-left p-4 rounded-xl transition-all"
              style="background:var(--color-surface);border:2px solid var(--color-border)"
              (mouseenter)="hovered = role" (mouseleave)="hovered = null"
              [style.border-color]="hovered === role ? 'var(--color-gold)' : 'var(--color-border)'">
              <div class="flex items-center gap-4">
                <svg [lucideIcon]="meta(role).icon" [size]="28"></svg>
                <div>
                  <div class="font-semibold" style="color:var(--color-text)">{{ meta(role).label }}</div>
                  <div class="text-sm" style="color:var(--color-muted)">{{ meta(role).desc }}</div>
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
  availableRoles: Role[] = [];
  userName = '';
  hovered: Role | null = null;

  constructor(readonly auth: AuthService, private router: Router) {}

  ngOnInit() {
    const user = this.auth.user();
    if (!user) { this.router.navigateByUrl('/login'); return; }

    const allowed = user.allowed_roles ?? [];
    if (allowed.length <= 1) {
      this.router.navigateByUrl(this.auth.landingRoute());
      return;
    }
    this.availableRoles = allowed;
    this.userName = user.display_name || user.username;
  }

  selectRole(role: Role) {
    this.auth.setActiveRole(role);
    this.router.navigateByUrl(this.auth.landingRoute(role));
  }

  meta(role: string): { label: string; icon: LucideIconInput; desc: string } {
    return ROLE_META[role] ?? { label: role, icon: LucideUser, desc: '' };
  }
}
