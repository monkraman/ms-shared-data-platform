import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface WizardStep {
  number: number;
  title: string;
  subtitle: string;
}

@Component({
  selector: 'app-step-indicator',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stepper-wrapper" id="wizard-stepper">
      @for (step of steps(); track step.number; let idx = $index) {
        <div 
          class="step-item"
          [class.active]="currentStep() === step.number"
          [class.completed]="currentStep() > step.number"
          (click)="stepClick.emit(step.number)"
        >
          <div class="step-circle">
            @if (currentStep() > step.number) {
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
              </svg>
            } @else {
              <span>{{ step.number }}</span>
            }
          </div>
          <div class="step-meta">
            <span class="step-title">{{ step.title }}</span>
            <span class="step-subtitle">{{ step.subtitle }}</span>
          </div>
        </div>
        @if (idx < steps().length - 1) {
          <div class="step-connector" [class.completed]="currentStep() > step.number"></div>
        }
      }
    </div>
  `,
  styles: [`
    .stepper-wrapper {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      margin-bottom: 28px;
      padding: 16px 20px;
      background: rgba(18, 30, 24, 0.7);
      border: 1px solid #1e332a;
      border-radius: 12px;
      backdrop-filter: blur(8px);
    }
    .step-item {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      user-select: none;
      transition: opacity 0.2s;
    }
    .step-item:not(.active):not(.completed) {
      opacity: 0.55;
    }
    .step-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
      font-weight: 700;
      font-family: var(--font-mono);
      background: var(--bg-card);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      transition: all var(--transition-fast);
    }
    .step-item.active .step-circle {
      border-color: var(--border-active);
      background: var(--btn-primary-bg);
      color: var(--btn-primary-text);
    }
    .step-item.completed .step-circle {
      border-color: var(--border-active);
      background: var(--bg-secondary);
      color: var(--text-primary);
    }
    .step-meta {
      display: flex;
      flex-direction: column;
    }
    .step-title {
      font-size: 0.82rem;
      font-weight: 600;
      color: var(--text-primary);
    }
    .step-subtitle {
      font-size: 0.72rem;
      color: var(--text-muted);
    }
    .step-connector {
      flex: 1;
      height: 1px;
      margin: 0 16px;
      background: var(--border-subtle);
      transition: background 0.3s;
    }
    .step-connector.completed {
      background: var(--border-active);
    }
    @media (max-width: 768px) {
      .step-subtitle { display: none; }
      .step-connector { margin: 0 8px; }
    }
  `],
})
export class StepIndicatorComponent {
  readonly steps = input.required<WizardStep[]>();
  readonly currentStep = input.required<number>();
  readonly stepClick = output<number>();
}
