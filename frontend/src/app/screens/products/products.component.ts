import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ProductSummary } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import {
  Column,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';
import { ProductFormComponent } from './product-form.component';

/** Screen 4: the client's products and their packaging. */
@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    DecimalPipe,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ProductFormComponent,
  ],
  template: `
    <app-page-header title="Products">
      <button type="button" class="btn btn-primary" (click)="formOpen.set(true)">Add product</button>
    </app-page-header>

    <div class="kpis">
      <div class="kpi dark"><div class="kpi-label">Products</div><div class="kpi-value">{{ all().length }}</div></div>
      <div class="kpi"><div class="kpi-label">Components</div><div class="kpi-value">{{ components() }}</div></div>
      <div class="kpi"><div class="kpi-label">Data complete</div><div class="kpi-value">{{ avgComplete() }}%</div></div>
      <div class="kpi"><div class="kpi-label">Open gaps</div><div class="kpi-value">{{ gaps() }}</div></div>
    </div>

    @if (q()) {
      <div class="toolbar">
        <span class="query">Results for “{{ q() }}”</span>
        <button type="button" class="btn btn-ghost" (click)="setQuery('')">Clear</button>
      </div>
    }

    @if (list.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="list.reload()" />
    } @else if (!list.loading() && !rows().length) {
      <app-empty-state [title]="q() ? 'No products match' : 'No products yet'">
        @if (!q()) { <button type="button" class="btn btn-primary" (click)="formOpen.set(true)">Add product</button> }
      </app-empty-state>
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="list.loading()" [clickable]="true"
                      [trackBy]="bySku" (rowClick)="open($event)">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('sku') { <span class="mono">{{ row.sku }}</span> }
            @case ('name') { <b>{{ row.name }}</b> }
            @case ('materials') {
              <span class="chips">@for (m of row.materials; track m) { <app-status-chip>{{ m }}</app-status-chip> }</span>
            }
            @case ('complete') {
              <span class="complete">
                <span class="bar" [class.amber]="row.completeness_pct < 90"><span [style.width.%]="row.completeness_pct"></span></span>
                {{ row.completeness_pct }}%
              </span>
            }
            @case ('gaps') {
              @if (row.open_gaps) {
                <app-status-chip tone="amber">{{ row.open_gaps }}</app-status-chip>
              } @else {
                <app-status-chip tone="green">None</app-status-chip>
              }
            }
            @case ('weight') { {{ row.packaging_g_per_unit | number: '1.0-1' }} g }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }

    <app-product-form [open]="formOpen()" (closed)="formOpen.set(false)" (created)="created($event.sku)" />
  `,
  styles: `
    .query {
      font-weight: 600;
    }
    .complete {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-variant-numeric: tabular-nums;
    }
  `,
})
export class ProductsComponent {
  private readonly api = inject(PlatformApi);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** The top bar's search lands here as `?q=`. */
  protected readonly q = toSignal(inject(ActivatedRoute).queryParamMap.pipe(map((p) => p.get('q') ?? '')), {
    initialValue: '',
  });
  protected readonly list = load(() => this.api.products());
  protected readonly formOpen = signal(false);

  protected readonly all = computed(() => this.list.value() ?? []);
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return this.all().filter((p) => !q || [p.sku, p.name, p.brand, p.gtin].some((v) => v.toLowerCase().includes(q)));
  });
  protected readonly components = computed(() => this.all().reduce((s, p) => s + p.component_count, 0));
  protected readonly gaps = computed(() => this.all().reduce((s, p) => s + p.open_gaps, 0));
  protected readonly avgComplete = computed(() => {
    const list = this.all();
    return list.length ? Math.round(list.reduce((s, p) => s + p.completeness_pct, 0) / list.length) : 0;
  });

  protected readonly columns: Column<ProductSummary>[] = [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Product' },
    { key: 'brand', label: 'Brand', value: (p) => p.brand },
    { key: 'components', label: 'Components', value: (p) => p.component_count, align: 'end' },
    { key: 'weight', label: 'Packaging per unit', align: 'end' },
    { key: 'materials', label: 'Materials' },
    { key: 'complete', label: 'Complete' },
    { key: 'gaps', label: 'Gaps' },
  ];

  protected readonly bySku = (p: ProductSummary) => p.sku;

  protected setQuery(q: string): void {
    void this.router.navigate([], { queryParams: q ? { q } : {}, replaceUrl: true });
  }

  protected open(p: ProductSummary): void {
    void this.router.navigate(['/app/products', p.sku]);
  }

  protected created(sku: string): void {
    this.formOpen.set(false);
    this.toast.show(`${sku} added`);
    void this.router.navigate(['/app/products', sku]);
  }
}
