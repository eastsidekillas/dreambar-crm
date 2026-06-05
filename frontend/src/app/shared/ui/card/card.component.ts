import { Component, Input } from '@angular/core';

@Component({
  selector: 'bd-card',
  standalone: true,
  template: `
    <div class="relative" [style.padding]="padding"
         style="background:#15130e; border-radius:2px"
         [style.border]="highlight ? '1px solid #c6a063' : '1px solid rgba(198,160,99,0.2)'">
      @if (corners) {
        <span class="absolute" style="top:7px;left:7px;width:10px;height:10px;border-top:1px solid #c6a063;border-left:1px solid #c6a063;pointer-events:none"></span>
        <span class="absolute" style="bottom:7px;right:7px;width:10px;height:10px;border-bottom:1px solid #c6a063;border-right:1px solid #c6a063;pointer-events:none"></span>
      }
      <ng-content />
    </div>
  `
})
export class BdCardComponent {
  @Input() corners = false;
  @Input() highlight = false;
  @Input() padding = '1rem';
}
