import { Component, Input } from '@angular/core';

@Component({
  selector: 'bd-divider',
  standalone: true,
  template: `
    <div class="flex items-center gap-2" [style.margin]="my + ' 0'">
      <span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(198,160,99,0.45),transparent)"></span>
      @if (diamond) {
        <span style="width:4px;height:4px;background:#c6a063;transform:rotate(45deg);flex-shrink:0"></span>
      }
      <span style="flex:1;height:1px;background:linear-gradient(to right,transparent,rgba(198,160,99,0.45),transparent)"></span>
    </div>
  `
})
export class BdDividerComponent {
  @Input() diamond = true;
  @Input() my = '8px';
}
