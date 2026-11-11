import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ActionItem, ActionPatch } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import { EmptyStateComponent, ErrorStateComponent, PageHeaderComponent } from '../../shared/ui';

const COLUMNS: { status: ActionItem['status']; label: string }[] = [
  { status: 'open', label: 'To do' },
  { status: 'in_progress', label: 'In progress' },
  { status: 'done', label: 'Done' },
];

/** Screen 14 (first part): recommendations the client acts on, by status. */
@Component({
  selector: 'app-actions',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CurrencyPipe, DatePipe, PageHeaderComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    <app-page-header title="Actions">
      <a class="btn btn-secondary" routerLink="/app/insights">Hotspots and scenarios</a>
    </app-page-header>

    @if (list.error(); as p) {
      <app-error-state [problem]="p" (retry)="list.reload()" />
    } @else if (!list.loading() && !(list.value() ?? []).length) {
      <app-empty-state title="No actions yet">
        <a class="btn btn-primary" routerLink="/app/insights">See recommendations</a>
      </app-empty-state>
    } @else {
      <div class="kpis">
        <div class="kpi dark"><div class="kpi-label">Open savings</div><div class="kpi-value">{{ openSavings() | currency: currency() : 'symbol' : '1.0-0' }}</div></div>
        @for (c of columns; track c.status) {
          <div class="kpi"><div class="kpi-label">{{ c.label }}</div><div class="kpi-value">{{ byStatus(c.status).length }}</div></div>
        }
      </div>
      <div class="board">
        @for (c of columns; track c.status) {
          <section class="col" [attr.aria-label]="c.label">
            <h2>{{ c.label }} <span class="count">{{ byStatus(c.status).length }}</span></h2>
            @for (a of byStatus(c.status); track a.id) {
              <article class="card item">
                <b>{{ a.title }}</b>
                @if (a.impact_value !== null && a.impact_value !== undefined) {
                  <span class="impact">{{ a.impact_label }} · {{ a.impact_value | currency: a.currency ?? 'GBP' : 'symbol' : '1.0-0' }}</span>
                }
                <div class="fields">
                  <input type="text" placeholder="Owner" aria-label="Owner" [disabled]="!canAct()" [ngModel]="a.owner"
                         (change)="save(a, { owner: $any($event.target).value })" />
                  <input type="date" aria-label="Due date" [disabled]="!canAct()" [ngModel]="a.due_date"
                         (change)="save(a, { due_date: $any($event.target).value || null })" />
                </div>
                <div class="foot">
                  <span class="muted">{{ a.created_at | date: 'd MMM' }}</span>
                  @if (canAct()) {
                    <select aria-label="Status" [ngModel]="a.status" (ngModelChange)="save(a, { status: $event })">
                      @for (s of columns; track s.status) { <option [value]="s.status">{{ s.label }}</option> }
                    </select>
                  }
                </div>
              </article>
            }
          </section>
        }
      </div>
    }
  `,
  styles: `
    .board {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      align-items: start;
    }
    .col {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 12px;
      border-radius: 14px;
      background: var(--bg);
      min-height: 120px;
    }
    h2 {
      margin: 0 0 4px;
      font-size: 13px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
    }
    .count {
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--card);
      font-size: 12px;
    }
    .item {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
      font-size: 13px;
    }
    .impact {
      color: #15966a;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .fields {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 6px;
    }
    .fields input,
    .foot select {
      padding: 6px 8px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
      font-size: 12.5px;
      color: var(--ink);
      background: var(--bg-input, #fff);
      min-width: 0;
    }
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media (max-width: 900px) {
      .board {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ActionsComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  protected readonly list = load(() => this.api.actions());
  protected readonly columns = COLUMNS;
  protected readonly canAct = computed(() => this.session.can('actions.manage'));
  protected readonly saving = signal(false);
  protected readonly currency = computed(() => (this.list.value() ?? []).find((a) => a.currency)?.currency ?? 'GBP');
  protected readonly openSavings = computed(() =>
    (this.list.value() ?? [])
      .filter((a) => a.status !== 'done' && a.impact_label === 'Saving per year')
      .reduce((sum, a) => sum + (a.impact_value ?? 0), 0),
  );

  protected byStatus(status: ActionItem['status']): ActionItem[] {
    return (this.list.value() ?? []).filter((a) => a.status === status);
  }

  protected save(a: ActionItem, patch: ActionPatch): void {
    this.api.updateAction(a.id, patch).subscribe({
      next: (updated) => this.list.set((this.list.value() ?? []).map((x) => (x.id === updated.id ? updated : x))),
      error: (e: unknown) => this.toast.show(toProblem(e).detail, 'error'),
    });
  }
}
