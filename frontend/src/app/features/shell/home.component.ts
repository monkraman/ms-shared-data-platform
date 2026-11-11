import { ChangeDetectionStrategy, Component } from '@angular/core';
import { EmptyStateComponent, PageHeaderComponent } from '../../shared/ui';

/** Landing page of the platform shell until the screens that summarise work exist. */
@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PageHeaderComponent, EmptyStateComponent],
  template: `
    <app-page-header title="Home" />
    <app-empty-state title="Nothing here yet" />
  `,
})
export class HomeComponent {}
