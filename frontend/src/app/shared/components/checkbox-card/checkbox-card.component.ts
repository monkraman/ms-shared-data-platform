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
      background: #121e18;
      border: 1px solid #1e332a;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      user-select: none;
    }
    .selection-card:hover:not(.disabled) {
      border-color: #10b981;
      background: #17261f;
      transform: translateY(-1px);
    }
    .selection-card.selected {
      border-color: #10b981;
      background: rgba(16, 185, 129, 0.08);
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
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
      font-size: 1.5rem;
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
      font-size: 0.9rem;
      font-weight: 600;
      color: #f1f5f9;
    }
    .card-badge {
      font-size: 0.68rem;
      font-weight: 700;
      font-family: ui-monospace, monospace;
      padding: 2px 6px;
      border-radius: 4px;
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .card-subtitle {
      font-size: 0.78rem;
      color: #94a3b8;
      line-height: 1.3;
    }
    .card-meta {
      font-size: 0.72rem;
      color: #64748b;
      margin-top: 2px;
    }
    .card-checkbox {
      width: 20px;
      height: 20px;
      border-radius: 4px;
      border: 1.5px solid #2a483b;
      background: #090e0c;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #042f1a;
      flex-shrink: 0;
      transition: all 0.2s;
    }
    .card-checkbox.checked {
      background: #10b981;
      border-color: #10b981;
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
