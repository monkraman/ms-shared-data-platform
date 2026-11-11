import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Label, control and its error:
 * `<app-form-field label="Name" for="name" [error]="problem?.fields['name']"><input id="name" /></app-form-field>`
 * The control should set `[attr.aria-describedby]="'name-error'"` when invalid.
 */
@Component({
  selector: 'app-form-field',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class.invalid]': '!!error()' },
  template: `
    <label [attr.for]="for()">{{ label() }}</label>
    <ng-content />
    @if (error()) {
      <span class="error" [id]="for() + '-error'" role="alert">{{ error() }}</span>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    label {
      font-size: 13px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    :host ::ng-deep :is(input, select, textarea) {
      height: 36px;
      padding: 0 10px;
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-md);
      background: var(--bg-input);
      color: var(--text-primary);
      font: inherit;
      font-size: 14px;
    }
    :host ::ng-deep textarea {
      height: auto;
      min-height: 80px;
      padding: 8px 10px;
    }
    :host ::ng-deep :is(input, select, textarea):focus-visible {
      outline: 2px solid var(--border-active);
      outline-offset: -1px;
    }
    :host(.invalid) ::ng-deep :is(input, select, textarea) {
      border-color: var(--status-red-text);
    }
    .error {
      font-size: 12px;
      color: var(--status-red-text);
    }
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly for = input.required<string>();
  readonly error = input<string | undefined>();
}
