import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, TemplateRef, contentChild, input, output } from '@angular/core';

export interface Column<T> {
  key: string;
  label: string;
  /** Plain text for the cell. For chips or links, use the `#cell` template. */
  value?: (row: T) => string | number | null | undefined;
  align?: 'start' | 'end';
}

/**
 * A simple, accessible table. Custom cells: `<ng-template #cell let-row let-key="key">…</ng-template>`.
 * Rows become clickable (mouse and Enter) when `clickable` is set.
 */
@Component({
  selector: 'app-data-table',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
  template: `
    <table>
      <thead>
        <tr>
          @for (col of columns(); track col.key) {
            <th scope="col" [class.end]="col.align === 'end'">{{ col.label }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @if (loading()) {
          @for (i of skeletonRows; track i) {
            <tr class="skeleton" aria-hidden="true">
              @for (col of columns(); track col.key) {
                <td><span></span></td>
              }
            </tr>
          }
        } @else {
          @for (row of rows(); track trackBy()(row)) {
            <tr
              [class.clickable]="clickable()"
              [attr.tabindex]="clickable() ? 0 : null"
              (click)="open(row)"
              (keydown.enter)="open(row)"
            >
              @for (col of columns(); track col.key) {
                <td [class.end]="col.align === 'end'">
                  @if (cell(); as tpl) {
                    <ng-container
                      *ngTemplateOutlet="tpl; context: { $implicit: row, key: col.key, value: col.value?.(row) }"
                    />
                  } @else {
                    {{ col.value?.(row) }}
                  }
                </td>
              }
            </tr>
          }
        }
      </tbody>
    </table>
  `,
  styles: `
    :host {
      display: block;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      text-align: start;
      font-weight: 500;
      font-size: 12px;
      color: var(--text-muted);
      padding: 8px 12px;
      border-bottom: 1px solid var(--border-subtle);
      white-space: nowrap;
    }
    td {
      padding: 10px 12px;
      border-bottom: 1px solid var(--border-subtle);
      color: var(--text-primary);
    }
    .end {
      text-align: end;
      font-variant-numeric: tabular-nums;
    }
    tr.clickable {
      cursor: pointer;
    }
    tr.clickable:hover,
    tr.clickable:focus-visible {
      background: var(--bg-card-hover);
      outline: none;
    }
    .skeleton span {
      display: block;
      height: 12px;
      width: 60%;
      border-radius: 4px;
      background: var(--bg-secondary);
    }
  `,
})
export class DataTableComponent<T> {
  readonly columns = input.required<Column<T>[]>();
  readonly rows = input<T[]>([]);
  readonly loading = input(false);
  readonly clickable = input(false);
  readonly trackBy = input<(row: T) => unknown>((row: T) => row);
  readonly rowClick = output<T>();
  readonly cell = contentChild<TemplateRef<unknown>>('cell');
  protected readonly skeletonRows = [1, 2, 3];

  protected open(row: T): void {
    if (this.clickable()) this.rowClick.emit(row);
  }
}
