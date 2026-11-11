import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

/** Root: the router decides between sign-in and the platform shell. */
@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  template: '<router-outlet />',
})
export class App {}
