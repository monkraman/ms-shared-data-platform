import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One line plus, optionally, the one action that fills the page: `<app-empty-state title="No products"><button>Add product</button></app-empty-state>` */
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>{{ title() }}</p>
    <ng-content />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 72px 16px;
      text-align: center;
    }
    p {
      margin: 0;
      font-size: 15px;
      color: var(--text-muted);
    }
  `,
})
export class EmptyStateComponent {
  readonly title = input.required<string>();
}
