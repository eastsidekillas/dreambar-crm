import { Component, Input } from '@angular/core';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

export interface NavItem { path: string; label: string; icon: string; }

@Component({
  selector: 'bottom-nav',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="flex items-stretch safe-bottom"
         style="background:#111009;border-top:1px solid rgba(198,160,99,0.18);position:fixed;bottom:0;left:0;right:0;z-index:50">
      @for (item of items; track item.path) {
        <a [routerLink]="item.path" routerLinkActive #rla="routerLinkActive"
           class="flex-1 flex flex-col items-center justify-center gap-0.5 py-3 transition-all"
           [style.color]="rla.isActive ? '#c6a063' : '#6f5a37'"
           [style.border-top]="rla.isActive ? '2px solid #c6a063' : '2px solid transparent'"
           [style.background]="rla.isActive ? 'rgba(198,160,99,0.06)' : 'transparent'"
           style="text-decoration:none;min-height:56px">
          <span style="font-size:1.1rem;line-height:1">{{ item.icon }}</span>
          <span style="font-family:'Oswald',sans-serif;font-weight:300;font-size:0.55rem;letter-spacing:0.18em;text-transform:uppercase;margin-top:2px">
            {{ item.label }}
          </span>
        </a>
      }
    </nav>
    <!-- spacer so content doesn't hide behind fixed nav -->
    <div style="height:56px"></div>
  `
})
export class BottomNavComponent {
  @Input() items: NavItem[] = [];
}
