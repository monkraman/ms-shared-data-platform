import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/** Centered modal for create and edit flows. Escape and the backdrop close it. */
@Component({
  selector: 'app-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'open() && closed.emit()' },
  template: `
    @if (open()) {
      <div class="backdrop" (click)="closed.emit()" aria-hidden="true"></div>
      <section class="dialog" role="dialog" aria-modal="true" [attr.aria-label]="title()" [style.max-width.px]="width()">
        <header>
          <h2>{{ title() }}</h2>
          <button type="button" class="btn btn-ghost close" (click)="closed.emit()" aria-label="Close">&times;</button>
        </header>
        <div class="body"><ng-content /></div>
        <footer><ng-content select="[actions]" /></footer>
      </section>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 70;
      background: rgb(14 35 64 / 0.32);
    }
    .dialog {
      position: fixed;
      z-index: 71;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: calc(100vw - 32px);
      max-height: calc(100vh - 48px);
      display: flex;
      flex-direction: column;
      background: var(--card, #fff);
      border-radius: var(--r-lg, 16px);
      box-shadow: var(--shadow-lg);
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 18px 22px 8px;
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
      overflow: auto;
      padding: 8px 22px 18px;
    }
    footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 14px 22px;
      border-top: 1px solid var(--border);
    }
    footer:empty {
      display: none;
    }
  `,
})
export class DialogComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly width = input(640);
  readonly closed = output<void>();
}
