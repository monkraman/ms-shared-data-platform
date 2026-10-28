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
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.85rem;
      font-weight: 700;
      font-family: ui-monospace, monospace;
      background: #15241d;
      border: 2px solid #2a483b;
      color: #94a3b8;
      transition: all 0.2s;
    }
    .step-item.active .step-circle {
      border-color: #10b981;
      background: #064e3b;
      color: #34d399;
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
    }
    .step-item.completed .step-circle {
      border-color: #10b981;
      background: #10b981;
      color: #042f1a;
    }
    .step-meta {
      display: flex;
      flex-direction: column;
    }
    .step-title {
      font-size: 0.85rem;
      font-weight: 600;
      color: #f1f5f9;
    }
    .step-subtitle {
      font-size: 0.72rem;
      color: #94a3b8;
    }
    .step-connector {
      flex: 1;
      height: 2px;
      margin: 0 16px;
      background: #1e332a;
      transition: background 0.3s;
    }
    .step-connector.completed {
      background: #10b981;
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
