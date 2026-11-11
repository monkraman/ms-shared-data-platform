import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** Page title with optional actions on the right: `<app-page-header title="Products"><button>…</button></app-page-header>` */
@Component({
  selector: 'app-page-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>{{ title() }}</h1>
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      min-height: 36px;
      margin-bottom: 24px;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      letter-spacing: -0.01em;
      color: var(--text-primary);
    }
    .actions {
      display: flex;
      gap: 8px;
    }
  `,
})
export class PageHeaderComponent {
  readonly title = input.required<string>();
}
