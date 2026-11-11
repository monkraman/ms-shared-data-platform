import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from '../../core/services/toast.service';

/** Renders `ToastService` messages. One per layout. */
@Component({
  selector: 'app-toast-outlet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (toasts.currentToast(); as toast) {
      <div class="toast" [class.error]="toast.type === 'error'" role="status" aria-live="polite">
        <span>{{ toast.message }}</span>
        <button type="button" (click)="toasts.dismiss()" aria-label="Dismiss">&times;</button>
      </div>
    }
  `,
  styles: `
    .toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 1000;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px 10px 16px;
      border-radius: var(--radius-md);
      background: var(--text-primary);
      color: var(--bg-surface);
      font-size: 14px;
      box-shadow: var(--card-shadow-hover);
    }
    .toast.error {
      background: var(--status-red-text);
      color: #fff;
    }
    button {
      border: 0;
      background: none;
      color: inherit;
      opacity: 0.7;
      font-size: 18px;
      line-height: 1;
      cursor: pointer;
    }
    button:hover {
      opacity: 1;
    }
  `,
})
export class ToastOutletComponent {
  readonly toasts = inject(ToastService);
}
