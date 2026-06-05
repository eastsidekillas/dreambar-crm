import { Component, Input } from '@angular/core';

@Component({
  selector: 'bd-cat-header',
  standalone: true,
  template: `
    <div class="flex items-center gap-2" [style.margin-bottom]="mb">
      <span style="color:#c6a063;font-family:'Oswald',sans-serif;font-weight:300;font-size:1.05rem;line-height:1;flex-shrink:0">[</span>
      <span style="font-family:'Oswald',sans-serif;font-weight:500;text-transform:uppercase;color:#e7d09a;letter-spacing:0.12em;white-space:nowrap"
            [style.font-size]="size === 'sm' ? '0.72rem' : '0.85rem'">
        {{ title }}
      </span>
      @if (note) {
        <span style="font-family:'Oswald',sans-serif;font-weight:200;font-size:0.6rem;letter-spacing:0.1em;color:#6f5a37;flex-shrink:0">
          {{ note }}
        </span>
      }
      <span style="flex:1;height:1px;background:linear-gradient(to right,rgba(198,160,99,0.35),transparent)"></span>
      <span style="color:#c6a063;font-family:'Oswald',sans-serif;font-weight:300;font-size:1.05rem;line-height:1;flex-shrink:0">]</span>
    </div>
  `
})
export class BdCatHeaderComponent {
  @Input({ required: true }) title!: string;
  @Input() note = '';
  @Input() size: 'sm' | 'md' = 'md';
  @Input() mb = '0.5rem';
}
