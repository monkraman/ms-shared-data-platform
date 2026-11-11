import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * Side panel for a record's details: `<app-drawer [open]="!!selected()" [title]="…" (closed)="selected.set(null)">`.
 * Escape and the backdrop close it.
 */
@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
      <aside class="panel" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.width.px]="width()">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" class="btn btn-ghost close" (click)="closed.emit()" aria-label="Close">&times;</button>
        </header>
        <div class="body"><ng-content /></div>
        <footer><ng-content select="[actions]" /></footer>
      </aside>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 60;
      background: rgb(14 35 64 / 0.18);
    }
    .panel {
      position: fixed;
      z-index: 61;
      top: 0;
      right: 0;
      bottom: 0;
      max-width: 100vw;
      display: flex;
      flex-direction: column;
      background: var(--card, #fff);
      box-shadow: var(--shadow-lg);
      animation: slide 0.18s ease-out;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 18px 20px 12px;
    }
    h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }
    .close {
      width: 32px;
      height: 32px;
      padding: 0;
      font-size: 20px;
    }
    .body {
      flex: 1;
      overflow: auto;
      padding: 4px 20px 20px;
    }
    footer:empty {
      display: none;
    }
    footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 14px 20px;
      border-top: 1px solid var(--border);
    }
    @keyframes slide {
      from {
        transform: translateX(24px);
        opacity: 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .panel {
        animation: none;
      }
    }
  `,
})
export class DrawerComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly width = input(480);
  readonly closed = output<void>();
}
