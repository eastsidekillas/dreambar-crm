import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from './toast.service';

@Component({
  selector: 'bd-toast',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (svc.toast()) {
      <div class="fixed top-16 left-4 right-4 z-[999] py-2.5 px-4 text-center"
           style="background:#15130e;border:1px solid;font-family:'Oswald',sans-serif;font-weight:300;font-size:0.68rem;letter-spacing:0.2em;text-transform:uppercase"
           [style.border-color]="borderColor()"
           [style.color]="textColor()">
        {{ svc.toast()!.message }}
      </div>
    }
  `
})
export class BdToastComponent {
  svc = inject(ToastService);

  borderColor() {
    const t = this.svc.toast()?.type;
    return t === 'error' ? '#c0392b' : '#c6a063';
  }
  textColor() {
    const t = this.svc.toast()?.type;
    return t === 'error' ? '#c0392b' : '#e7d09a';
  }
}
