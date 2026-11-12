import { CurrencyPipe } from '@angular/common';
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
  ChipTone,
  Column,
  DataTableComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';
import { ProductFormComponent } from './product-form.component';

type SkuStatus = ProductSummary['status'];

export const STATUS_LABEL: Record<string, string> = { ok: 'OK', issue: 'Issue', at_risk: 'At risk' };
export const STATUS_TONE: Record<string, ChipTone> = { ok: 'green', issue: 'amber', at_risk: 'red' };
export const RAM_TONE: Record<string, ChipTone> = { Green: 'green', Amber: 'amber', Red: 'red' };

export function gradeTone(grade: string): ChipTone {
  return grade === 'A' || grade === 'B' ? 'green' : grade === 'C' ? 'amber' : 'red';
}

/**
 * Screen 4: the SKU library. Fees, RAM rating, PPWR grade, markets and status are calculated by
 * the backend from the stored values (app/modules/assessment.py); this screen only filters them.
 */
@Component({
  selector: 'app-products',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    CurrencyPipe,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    EmptyStateComponent,
    ErrorStateComponent,
    ProductFormComponent,
  ],
  template: `
    <app-page-header title="SKU library">
      <button type="button" class="btn btn-primary" (click)="formOpen.set(true)">Add product</button>
    </app-page-header>

    <div class="kpis">
      <div class="kpi dark">
        <div class="kpi-label">SKUs</div>
        <div class="kpi-value">{{ rows().length }}<small> of {{ all().length }}</small></div>
      </div>
      @for (r of regimes(); track r.regime) {
        <div class="kpi">
          <div class="kpi-label">{{ r.name }} {{ r.year }}</div>
          <div class="kpi-value">{{ r.fee | currency: r.currency : 'symbol' : '1.0-0' }}</div>
        </div>
      }
      <div class="kpi"><div class="kpi-label">With issues</div><div class="kpi-value">{{ count('issue') }}</div></div>
      <div class="kpi"><div class="kpi-label">At risk</div><div class="kpi-value">{{ count('at_risk') }}</div></div>
    </div>

    <div class="toolbar">
      @if (q()) {
        <span class="query">Results for “{{ q() }}”</span>
        <button type="button" class="btn btn-ghost" (click)="setQuery('')">Clear</button>
      }
      <select aria-label="Material" [ngModel]="material()" (ngModelChange)="material.set($event)">
        <option value="">All materials</option>
        @for (m of materials(); track m) { <option [value]="m">{{ m }}</option> }
      </select>
      <select aria-label="Market" [ngModel]="market()" (ngModelChange)="market.set($event)">
        <option value="">All markets</option>
        @for (m of markets(); track m) { <option [value]="m">{{ m }}</option> }
      </select>
      <select aria-label="RAM rating" [ngModel]="ram()" (ngModelChange)="ram.set($event)">
        <option value="">All RAM ratings</option>
        @for (r of ramOptions; track r) { <option [value]="r">{{ r }}</option> }
      </select>
      <select aria-label="PPWR grade" [ngModel]="grade()" (ngModelChange)="grade.set($event)">
        <option value="">All PPWR grades</option>
        @for (g of gradeOptions; track g) { <option [value]="g">{{ g }}</option> }
      </select>
      <select aria-label="Status" [ngModel]="status()" (ngModelChange)="status.set($event)">
        <option value="">All statuses</option>
        @for (s of statusOptions; track s) { <option [value]="s">{{ statusLabel[s] }}</option> }
      </select>
    </div>

    @if (list.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="list.reload()" />
    } @else if (!list.loading() && !rows().length) {
      <app-empty-state [title]="all().length ? 'No products match' : 'No products yet'">
        @if (!all().length) { <button type="button" class="btn btn-primary" (click)="formOpen.set(true)">Add product</button> }
      </app-empty-state>
    } @else {
      <app-data-table [columns]="columns()" [rows]="rows()" [loading]="list.loading()" [clickable]="true"
                      [trackBy]="bySku" (rowClick)="open($event)">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('sku') { <span class="mono">{{ row.sku }}</span> }
            @case ('name') { <b>{{ row.name }}</b> }
            @case ('materials') {
              <span class="chips">@for (m of row.materials; track m) { <app-status-chip>{{ m }}</app-status-chip> }</span>
            }
            @case ('markets') {
              <span class="chips">@for (m of row.markets; track m) { <app-status-chip>{{ m }}</app-status-chip> }</span>
            }
            @case ('ram') {
              @if (row.ram) { <app-status-chip [tone]="ramTone[row.ram]">{{ row.ram }}</app-status-chip> } @else { — }
            }
            @case ('grade') {
              @if (row.grade) {
                <app-status-chip [tone]="gradeTone(row.grade)" [attr.title]="row.grade_reason">{{ row.grade }}</app-status-chip>
              } @else {
                <span [attr.title]="row.grade_reason">—</span>
              }
            }
            @case ('status') {
              <app-status-chip [tone]="statusTone[row.status]" [attr.title]="row.status_reasons.join('; ')">
                {{ statusLabel[row.status] }}
              </app-status-chip>
            }
            @default {
              @if (fee(row, key); as f) {
                {{ f.fee | currency: f.currency : 'symbol' : '1.0-0' }}
              } @else {
                {{ value }}
              }
            }
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
    .kpi-value small {
      font-size: 0.5em;
      font-weight: 500;
      opacity: 0.7;
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

  protected readonly material = signal('');
  protected readonly market = signal('');
  protected readonly ram = signal('');
  protected readonly grade = signal('');
  protected readonly status = signal('');

  protected readonly ramOptions = ['Green', 'Amber', 'Red'];
  protected readonly gradeOptions = ['A', 'B', 'C', 'D', 'E'];
  protected readonly statusOptions: SkuStatus[] = ['ok', 'issue', 'at_risk'];
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;
  protected readonly ramTone = RAM_TONE;
  protected readonly gradeTone = gradeTone;

  protected readonly all = computed(() => this.list.value() ?? []);
  protected readonly materials = computed(() => [...new Set(this.all().flatMap((p) => p.materials))].sort());
  protected readonly markets = computed(() => [...new Set(this.all().flatMap((p) => p.markets))].sort());
  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    const [material, market, ram, grade, status] = [this.material(), this.market(), this.ram(), this.grade(), this.status()];
    return this.all().filter(
      (p) =>
        (!q || [p.sku, p.name, p.brand, p.gtin].some((v) => v.toLowerCase().includes(q))) &&
        (!material || p.materials.includes(material)) &&
        (!market || p.markets.includes(market)) &&
        (!ram || p.ram === ram) &&
        (!grade || p.grade === grade) &&
        (!status || p.status === status),
    );
  });

  /** Fee totals of the shown SKUs, per EPR regime the workspace covers (currencies are not added up). */
  protected readonly regimes = computed(() => {
    const out = new Map<string, { regime: string; name: string; currency: string; year: string | null; fee: number }>();
    for (const p of this.rows()) {
      for (const f of p.fees) {
        const r = out.get(f.regime) ?? { regime: f.regime, name: f.name, currency: f.currency, year: f.year ?? null, fee: 0 };
        r.fee += f.fee;
        out.set(f.regime, r);
      }
    }
    return [...out.values()];
  });

  protected readonly columns = computed<Column<ProductSummary>[]>(() => [
    { key: 'sku', label: 'SKU' },
    { key: 'name', label: 'Product' },
    { key: 'materials', label: 'Materials' },
    { key: 'markets', label: 'Markets' },
    ...this.regimes().map((r) => ({ key: `fee:${r.regime}`, label: r.name, align: 'end' as const })),
    { key: 'ram', label: 'RAM' },
    { key: 'grade', label: 'PPWR' },
    { key: 'status', label: 'Status' },
  ]);

  protected readonly bySku = (p: ProductSummary) => p.sku;

  protected count(status: SkuStatus): number {
    return this.rows().filter((p) => p.status === status).length;
  }

  protected fee(p: ProductSummary, key: string) {
    return p.fees.find((f) => `fee:${f.regime}` === key);
  }

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
