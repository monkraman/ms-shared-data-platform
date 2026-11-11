import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Problem } from '../../core/api/problem';

/** An API problem with a retry button. The request ID sits in the tooltip for support. */
@Component({
  selector: 'app-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p role="alert" [attr.title]="problem().requestId ? 'Request ' + problem().requestId : null">
      {{ problem().detail }}
    </p>
    <button type="button" class="btn btn-secondary" (click)="retry.emit()">Try again</button>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      padding: 72px 16px;
      text-align: center;
    }
    p {
      margin: 0;
      font-size: 15px;
      color: var(--text-primary);
    }
  `,
})
export class ErrorStateComponent {
  readonly problem = input.required<Problem>();
  readonly retry = output<void>();
}
