import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type ChipTone = 'neutral' | 'green' | 'amber' | 'red' | 'blue';

/** `<app-status-chip tone="green">Active</app-status-chip>` */
@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'tone()' },
  template: `<ng-content />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      height: 22px;
      padding: 0 8px;
      border-radius: var(--radius-full);
      font-size: 12px;
      font-weight: 500;
      white-space: nowrap;
      background: var(--bg-secondary);
      color: var(--text-secondary);
    }
    :host(.green) {
      background: var(--status-green-bg);
      color: var(--status-green-text);
    }
    :host(.amber) {
      background: var(--status-amber-bg);
      color: var(--status-amber-text);
    }
    :host(.red) {
      background: var(--status-red-bg);
      color: var(--status-red-text);
    }
    :host(.blue) {
      background: var(--navy-soft);
      color: var(--navy-primary);
    }
  `,
})
export class StatusChipComponent {
  readonly tone = input<ChipTone>('neutral');
}
