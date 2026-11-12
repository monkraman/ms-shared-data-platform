import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ValidationIssue } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import { Column, DataTableComponent, EmptyStateComponent, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/ui';
import { toCsv } from '../import/csv';

/** Demo step 4: values the catalogue does not accept, the correction, and the list for source systems. */
@Component({
  selector: 'app-validation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PageHeaderComponent, DataTableComponent, StatusChipComponent, EmptyStateComponent, ErrorStateComponent],
  template: `
    <app-page-header title="Validation">
      <button type="button" class="btn btn-secondary" [disabled]="!rows().length" (click)="exportForSources()">Export for source systems</button>
      @if (canFix() && fixable().length) {
        <button type="button" class="btn btn-primary" [disabled]="busy()" (click)="apply(fixable())">Apply {{ fixable().length }} corrections</button>
      }
    </app-page-header>

    <div class="kpis">
      <div class="kpi dark"><div class="kpi-label">Values to check</div><div class="kpi-value">{{ all().length }}</div></div>
      <div class="kpi"><div class="kpi-label">With a correction</div><div class="kpi-value">{{ withSuggestion() }}</div></div>
      @for (s of bySource(); track s.name) {
        <div class="kpi"><div class="kpi-label">From {{ s.name }}</div><div class="kpi-value">{{ s.count }}</div></div>
      }
    </div>

    <div class="toolbar">
      <input type="search" placeholder="Search SKU, product or field" aria-label="Search" [ngModel]="q()" (ngModelChange)="q.set($event)" />
      <select aria-label="Source" [ngModel]="source()" (ngModelChange)="source.set($event)">
        <option value="">All sources</option>
        @for (s of bySource(); track s.name) { <option [value]="s.name">{{ s.name }}</option> }
      </select>
    </div>

    @if (list.error(); as p) {
      <app-error-state [problem]="p" (retry)="list.reload()" />
    } @else if (!list.loading() && !rows().length) {
      <app-empty-state title="All values pass validation" />
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="list.loading()" [trackBy]="byId">
        <ng-template #cell let-row let-key="key">
          @switch (key) {
            @case ('product') {
              <a [routerLink]="['/app/products', row.sku]"><b>{{ row.product_name }}</b></a>
              <div class="muted small">{{ row.component_name ?? row.sku }}</div>
            }
            @case ('field') { {{ row.field_label }} @if (row.data_point) { <span class="mono muted">{{ row.data_point }}</span> } }
            @case ('value') { <span class="bad">{{ row.value }}</span><div class="muted small">{{ row.message }}</div> }
            @case ('suggestion') {
              @if (row.suggestion) { <span class="good">{{ row.suggestion }}</span> } @else { <span class="muted">Needs a person</span> }
            }
            @case ('source') { <app-status-chip>{{ row.source_name }}</app-status-chip> }
            @case ('action') {
              @if (canFix() && row.suggestion) {
                <button type="button" class="btn btn-ghost" [disabled]="busy()" (click)="apply([row])">Apply</button>
              }
            }
          }
        </ng-template>
      </app-data-table>
    }
  `,
  styles: `
    .small {
      font-size: 12px;
    }
    .bad {
      color: #c0211f;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .good {
      color: #0d6b4b;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    a {
      color: inherit;
      text-decoration: none;
    }
  `,
})
export class ValidationComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  protected readonly list = load(() => this.api.validation());
  protected readonly canFix = computed(() => this.session.can('products.manage'));
  protected readonly busy = signal(false);
  protected readonly q = signal('');
  protected readonly source = signal('');

  protected readonly all = computed(() => this.list.value() ?? []);
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.all().filter(
      (i) =>
        (!this.source() || i.source_name === this.source()) &&
        (!q || [i.sku, i.product_name, i.field_label, i.component_name ?? ''].some((v) => v.toLowerCase().includes(q))),
    );
  });
  protected readonly fixable = computed(() => this.rows().filter((i) => i.suggestion));
  protected readonly withSuggestion = computed(() => this.all().filter((i) => i.suggestion).length);
  protected readonly bySource = computed(() => {
    const counts = new Map<string, number>();
    for (const i of this.all()) counts.set(i.source_name, (counts.get(i.source_name) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count }));
  });

  protected readonly columns: Column<ValidationIssue>[] = [
    { key: 'product', label: 'Product' },
    { key: 'field', label: 'Field' },
    { key: 'value', label: 'Value' },
    { key: 'suggestion', label: 'Correction' },
    { key: 'source', label: 'Source' },
    { key: 'action', label: '' },
  ];
  protected readonly byId = (i: ValidationIssue) => i.id;

  protected apply(issues: ValidationIssue[]): void {
    this.busy.set(true);
    this.api.applyCorrections(issues.map((i) => i.id)).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.list.reload();
        this.toast.show(`${r.applied} ${r.applied === 1 ? 'value' : 'values'} corrected`);
      },
      error: (e: unknown) => {
        this.busy.set(false);
        this.toast.show(toProblem(e).detail, 'error');
      },
    });
  }

  /** The list each source system's team needs to fix at the source (one source of truth). */
  protected exportForSources(): void {
    const header = ['Source system', 'SKU', 'Product', 'Component ID', 'Component', 'Field', 'Data point', 'Current value', 'Corrected value', 'Problem'];
    const lines = [...this.rows()]
      .sort((a, b) => a.source_name.localeCompare(b.source_name))
      .map((i) => [i.source_name, i.sku, i.product_name, i.component_id ?? '', i.component_name ?? '', i.field_label, i.data_point ?? '', i.value, i.suggestion ?? '', i.message]);
    const blob = new Blob([toCsv([header, ...lines])], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'corrections-for-source-systems.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
