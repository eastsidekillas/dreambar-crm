import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-shifts-shell',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class ShiftsShell {}