import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { BdToastComponent } from './shared/ui/toast/toast.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, BdToastComponent],
  template: `<router-outlet /><bd-toast />`,
})
export class App {}
