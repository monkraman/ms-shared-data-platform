import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Gap, GapResolve, GapStatus } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import {
  ChipTone,
  Column,
  DataTableComponent,
  DrawerComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';
import { toCsv } from '../import/csv';

/** Screen 7: the gaps found by the rules, and fixing them one by one. */
@Component({
  selector: 'app-gaps',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    RouterLink,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    DrawerComponent,
    FormFieldComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header title="Gaps">
      <button type="button" class="btn btn-secondary" (click)="export()" [disabled]="!rows().length">Export</button>
      @if (canResolve() && estimableOpen().length) {
        <button type="button" class="btn btn-primary" [disabled]="filling()" (click)="fillAll()">
          {{ filling() ? 'Filling…' : 'Fill ' + estimableOpen().length + ' estimates' }}
        </button>
      }
    </app-page-header>

    <div class="kpis">
      <div class="kpi dark"><div class="kpi-label">Blockers</div><div class="kpi-value">{{ count('blocker') }}</div></div>
      <div class="kpi"><div class="kpi-label">Warnings</div><div class="kpi-value">{{ count('warning') }}</div></div>
      <div class="kpi"><div class="kpi-label">Can be estimated</div><div class="kpi-value">{{ estimableOpen().length }}</div></div>
      <div class="kpi"><div class="kpi-label">Waiting on suppliers</div><div class="kpi-value">{{ byStatus('requested') }}</div></div>
      <div class="kpi"><div class="kpi-label">Resolved</div><div class="kpi-value">{{ byStatus('resolved') }}</div></div>
    </div>

    <div class="segmented" role="tablist" aria-label="Gap groups">
      <button type="button" role="tab" [class.on]="group() === ''" (click)="group.set('')">All</button>
      <button type="button" role="tab" [class.on]="group() === 'estimable'" (click)="group.set('estimable')">
        Can be estimated <span class="count">{{ groupCount(true) }}</span>
      </button>
      <button type="button" role="tab" [class.on]="group() === 'data'" (click)="group.set('data')">
        Needs data <span class="count">{{ groupCount(false) }}</span>
      </button>
    </div>

    <div class="toolbar">
      <input type="search" placeholder="Search SKU or product" aria-label="Search gaps" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select aria-label="Severity" [ngModel]="severity()" (ngModelChange)="severity.set($event)">
        <option value="">All severities</option>
        <option value="blocker">Blockers</option>
        <option value="warning">Warnings</option>
      </select>
      <select aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
        <option value="open">Open</option>
        <option value="requested">Waiting on supplier</option>
        <option value="resolved">Resolved</option>
        <option value="">All</option>
      </select>
      <select aria-label="When due" [ngModel]="due()" (ngModelChange)="due.set($event)">
        <option value="due">Due now</option>
        <option value="upcoming">Upcoming</option>
        <option value="">Any time</option>
      </select>
      <select aria-label="Module" [ngModel]="module()" (ngModelChange)="module.set($event)">
        <option value="">All modules</option>
        @for (m of ['EPR', 'PPWR', 'DPP']; track m) { <option [value]="m">{{ m }}</option> }
      </select>
    </div>

    @if (gaps.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="gaps.reload()" />
    } @else if (!gaps.loading() && !rows().length) {
      <app-empty-state [title]="status() === 'open' ? 'No open gaps' : 'Nothing matches'" />
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="gaps.loading()" [clickable]="true"
                      [trackBy]="byId" (rowClick)="select($event)">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('severity') {
              <app-status-chip [tone]="row.severity === 'blocker' ? 'red' : 'amber'">{{ row.severity === 'blocker' ? 'Blocker' : 'Warning' }}</app-status-chip>
            }
            @case ('product') { <b>{{ row.product_name }}</b><div class="mono muted">{{ row.sku }}</div> }
            @case ('field') { {{ row.field_label }} <span class="mono muted">{{ row.data_point }}</span> }
            @case ('value') { <span [class.muted]="!row.current_value">{{ row.current_value || 'Empty' }}</span> }
            @case ('status') { <app-status-chip [tone]="statusTone(row.status)">{{ statusLabel(row.status) }}</app-status-chip> }
            @case ('estimate') {
              @if (row.estimate; as e) {
                <span class="estimate"><b>≈ {{ e.value }}</b><span class="muted">{{ e.basis }}</span></span>
              } @else {
                <span class="muted">Needs data</span>
              }
            }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }

    <app-drawer [open]="!!selected()" [title]="selected()?.rule_name ?? ''" (closed)="selected.set(null)">
      @if (selected(); as g) {
        <dl class="facts">
          <dt>Product</dt>
          <dd><a [routerLink]="['/app/products', g.sku]">{{ g.product_name }}</a></dd>
          @if (g.component_name) {
            <dt>Component</dt>
            <dd>{{ g.component_name }}</dd>
          }
          <dt>Field</dt>
          <dd>{{ g.field_label }} · <span class="mono">{{ g.data_point }}</span></dd>
          <dt>Current value</dt>
          <dd>{{ g.current_value || 'Empty' }}</dd>
          <dt>Needed for</dt>
          <dd>{{ g.modules.join(', ') }}</dd>
          <dt>Estimate</dt>
          <dd>{{ g.estimate ? '≈ ' + g.estimate.value + ' · ' + g.estimate.basis : 'Needs data' }}</dd>
          <dt>Status</dt>
          <dd><app-status-chip [tone]="statusTone(g.status)">{{ statusLabel(g.status) }}</app-status-chip></dd>
        </dl>

        @if (g.status !== 'resolved') {
          <div class="section-label">Fix</div>
          <div class="segmented" role="tablist">
            @if (g.estimate) {
              <button type="button" role="tab" [class.on]="mode() === 'use_estimate'" (click)="mode.set('use_estimate')">Use estimate</button>
            }
            <button type="button" role="tab" [class.on]="mode() === 'set_value'" (click)="mode.set('set_value')">Enter value</button>
            <button type="button" role="tab" [class.on]="mode() === 'request_supplier'" (click)="mode.set('request_supplier')">Ask supplier</button>
            @if (g.severity === 'warning') {
              <button type="button" role="tab" [class.on]="mode() === 'accept_estimate'" (click)="mode.set('accept_estimate')">Accept</button>
            }
          </div>
          @switch (mode()) {
            @case ('set_value') {
              <app-form-field label="New value" for="gap-value" [error]="problem()?.fields['value']">
                <input id="gap-value" [(ngModel)]="value" />
              </app-form-field>
            }
            @case ('request_supplier') {
              <app-form-field label="Message" for="gap-note">
                <textarea id="gap-note" [(ngModel)]="note"></textarea>
              </app-form-field>
            }
          }
        }
      }
      <ng-container actions>
        @if (selected(); as g) {
          @if (g.status !== 'resolved') {
            <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="resolve(g)">
              {{ mode() === 'use_estimate' ? 'Use ≈ ' + (g.estimate?.value ?? '') : mode() === 'set_value' ? 'Save value' : mode() === 'request_supplier' ? 'Send request' : 'Accept as is' }}
            </button>
          }
        }
      </ng-container>
    </app-drawer>
  `,
  styles: `
    textarea {
      min-height: 90px;
    }
    .estimate {
      display: flex;
      flex-direction: column;
      line-height: 1.3;
    }
    .estimate .muted {
      font-size: 12px;
    }
    a {
      color: var(--navy-700);
    }
  `,
})
export class GapsComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  protected readonly gaps = load(() => this.api.gaps());
  protected readonly q = signal('');
  protected readonly severity = signal('');
  protected readonly status = signal<GapStatus | ''>('open');
  protected readonly module = signal('');
  protected readonly selected = signal<Gap | null>(null);
  protected readonly mode = signal<GapResolve['action'] | 'use_estimate'>('set_value');
  /** Estimable vs needs-data grouping ('' = all). */
  protected readonly group = signal<'' | 'estimable' | 'data'>('');
  protected readonly filling = signal(false);
  /** Horizon: 'due' = in force or inside the collection lead time; 'upcoming' = later. */
  protected readonly due = signal<'' | 'due' | 'upcoming'>('due');
  protected readonly canResolve = computed(() => this.session.can('gaps.resolve'));
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected value = '';
  protected note = '';

  private readonly all = computed(() => this.gaps.value() ?? []);
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.all().filter(
      (g) =>
        (!q || g.sku.toLowerCase().includes(q) || g.product_name.toLowerCase().includes(q)) &&
        (!this.severity() || g.severity === this.severity()) &&
        (!this.status() || g.status === this.status()) &&
        (!this.module() || g.modules.includes(this.module() as Gap['modules'][number])) &&
        (!this.group() || g.estimable === (this.group() === 'estimable')) &&
        (!this.due() || (this.due() === 'upcoming') === (g.phase === 'upcoming')),
    );
  });

  protected readonly estimableOpen = computed(() => this.all().filter((g) => g.estimable && g.status === 'open'));

  protected readonly columns: Column<Gap>[] = [
    { key: 'severity', label: 'Severity' },
    { key: 'product', label: 'Product' },
    { key: 'component', label: 'Component', value: (g) => g.component_name ?? '—' },
    { key: 'field', label: 'Field' },
    { key: 'value', label: 'Value' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'rule', label: 'Rule', value: (g) => g.rule_name },
    { key: 'due', label: 'Applies', value: (g) => (g.phase === 'now' ? 'Now' : g.phase === 'collecting' ? 'Collecting' : (g.applies_from ?? '').slice(0, 7)) },
    { key: 'status', label: 'Status' },
  ];

  protected readonly byId = (g: Gap) => g.id;

  protected count(severity: Gap['severity']): number {
    return this.all().filter((g) => g.severity === severity && g.status === 'open').length;
  }

  protected byStatus(status: GapStatus): number {
    return this.all().filter((g) => g.status === status).length;
  }

  protected statusTone(s: GapStatus): ChipTone {
    return s === 'resolved' ? 'green' : s === 'requested' ? 'blue' : 'neutral';
  }

  protected statusLabel(s: GapStatus): string {
    return s === 'requested' ? 'Waiting on supplier' : s === 'resolved' ? 'Resolved' : 'Open';
  }

  protected groupCount(estimable: boolean): number {
    return this.all().filter((g) => g.status === 'open' && g.estimable === estimable).length;
  }

  /** Writes every open estimable gap's proposed value, marked as an estimate. */
  protected fillAll(): void {
    this.fill(this.estimableOpen().map((g) => g.id));
  }

  private fill(ids: string[]): void {
    this.filling.set(true);
    this.saving.set(true);
    this.api.fillEstimates(ids).subscribe({
      next: (r) => {
        this.filling.set(false);
        this.saving.set(false);
        this.selected.set(null);
        this.gaps.reload();
        this.toast.show(`${r.filled} ${r.filled === 1 ? 'estimate' : 'estimates'} filled`);
      },
      error: (e: unknown) => {
        this.filling.set(false);
        this.saving.set(false);
        this.toast.show(toProblem(e).detail, 'error');
      },
    });
  }

  protected select(g: Gap): void {
    this.selected.set(g);
    this.mode.set(g.estimate ? 'use_estimate' : 'set_value');
    this.value = '';
    this.note = '';
    this.problem.set(null);
  }

  protected resolve(g: Gap): void {
    const action = this.mode();
    if (action === 'use_estimate') {
      this.fill([g.id]);
      return;
    }
    const body: GapResolve =
      action === 'set_value'
        ? { action, value: this.value }
        : action === 'request_supplier'
          ? { action, note: this.note }
          : { action };
    this.saving.set(true);
    this.problem.set(null);
    this.api.resolveGap(g.id, body).subscribe({
      next: (updated) => {
        this.saving.set(false);
        this.selected.set(null);
        this.gaps.reload();
        this.toast.show(updated.status === 'requested' ? 'Request sent' : 'Gap resolved');
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }

  protected export(): void {
    const header = ['Severity', 'SKU', 'Product', 'Component', 'Data point', 'Field', 'Current value', 'Estimate', 'Estimate basis', 'Rule', 'Modules', 'Status'];
    const lines = this.rows().map((g) => [
      g.severity,
      g.sku,
      g.product_name,
      g.component_name ?? '',
      g.data_point,
      g.field_label,
      g.current_value,
      g.estimate?.value ?? '',
      g.estimate?.basis ?? 'Needs data',
      g.rule_name,
      g.modules.join(' '),
      this.statusLabel(g.status),
    ]);
    const blob = new Blob([toCsv([header, ...lines])], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'gap-worklist.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
