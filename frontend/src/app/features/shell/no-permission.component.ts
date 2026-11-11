import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EmptyStateComponent } from '../../shared/ui';

@Component({
  selector: 'app-no-permission',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EmptyStateComponent, RouterLink],
  template: `
    <app-empty-state title="You don’t have access to this page">
      <a class="btn btn-secondary" routerLink="/app">Go home</a>
    </app-empty-state>
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      min-height: 60vh;
    }
  `,
})
export class NoPermissionComponent {}
