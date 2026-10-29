import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-checkbox-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div 
      class="selection-card" 
      [class.selected]="selected()"
      [class.disabled]="disabled()"
      (click)="toggle()"
    >
      <div class="card-left">
        @if (icon()) {
          <span class="card-icon">{{ icon() }}</span>
        }
        <div class="card-text">
          <div class="card-title-row">
            <span class="card-title">{{ title() }}</span>
            @if (badge()) {
              <span class="card-badge">{{ badge() }}</span>
            }
          </div>
          <p class="card-subtitle">{{ subtitle() }}</p>
          @if (meta()) {
            <span class="card-meta">{{ meta() }}</span>
          }
        </div>
      </div>
      <div class="card-checkbox" [class.checked]="selected()">
        @if (selected()) {
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
          </svg>
        }
      </div>
    </div>
  `,
  styles: [`
    .selection-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 14px 16px;
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      border-radius: 6px;
      cursor: pointer;
      transition: all var(--transition-fast);
      user-select: none;
    }
    .selection-card:hover:not(.disabled) {
      border-color: var(--border-hover);
      background: var(--bg-card-hover);
      transform: translateY(-1px);
    }
    .selection-card.selected {
      border-color: var(--border-active);
      background: var(--bg-secondary);
    }
    .selection-card.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .card-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .card-icon {
      font-size: 1.2rem;
      line-height: 1;
    }
    .card-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .card-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-title {
      font-size: 0.88rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .card-badge {
      font-size: 0.68rem;
      font-weight: 700;
      font-family: var(--font-mono);
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--bg-secondary);
      color: var(--text-primary);
      border: 1px solid var(--border-subtle);
    }
    .card-subtitle {
      font-size: 0.78rem;
      color: var(--text-muted);
      line-height: 1.3;
    }
    .card-meta {
      font-size: 0.72rem;
      color: var(--text-subtle);
      margin-top: 2px;
    }
    .card-checkbox {
      width: 18px;
      height: 18px;
      border-radius: 4px;
      border: 1px solid var(--border-subtle);
      background: var(--bg-secondary);
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--bg-primary);
      flex-shrink: 0;
      transition: all var(--transition-fast);
    }
    .card-checkbox.checked {
      background: var(--btn-primary-bg);
      border-color: var(--btn-primary-bg);
      color: var(--btn-primary-text);
    }
  `],
})
export class CheckboxCardComponent {
  readonly title = input.required<string>();
  readonly subtitle = input<string>('');
  readonly badge = input<string>('');
  readonly icon = input<string>('');
  readonly meta = input<string>('');
  readonly selected = input<boolean>(false);
  readonly disabled = input<boolean>(false);

  readonly toggleChange = output<boolean>();

  toggle(): void {
    if (!this.disabled()) {
      this.toggleChange.emit(!this.selected());
    }
  }
}
