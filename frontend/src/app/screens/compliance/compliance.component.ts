import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { DeclarationRow, EprResult, Regime } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { Column, DataTableComponent, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/ui';

type EprId = 'epr_uk' | 'epr_dk' | 'sb54_ca';
const REQUIREMENTS = ['substances', 'recyclability', 'recycled', 'minimisation', 'labelling'] as const;
const REQUIREMENT_LABELS: Record<(typeof REQUIREMENTS)[number], string> = {
  substances: 'Substances',
  recyclability: 'Recyclability',
  recycled: 'Recycled content',
  minimisation: 'Minimisation',
  labelling: 'Labelling',
};

/** Screens 12–13 (first part): EPR fees and PPWR declarations from the workspace's own data. */
@Component({
  selector: 'app-compliance',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, CurrencyPipe, DecimalPipe, PageHeaderComponent, DataTableComponent, StatusChipComponent, ErrorStateComponent],
  template: `
    <app-page-header title="Compliance">
      @if (epr()?.years?.length && active() !== 'ppwr_dk') {
        <select aria-label="Reporting year" [ngModel]="epr()!.year" (ngModelChange)="year.set($event)">
          @for (y of epr()!.years; track y) { <option [value]="y">{{ y }}</option> }
        </select>
      }
    </app-page-header>

    <nav class="segmented" role="tablist" aria-label="Regimes">
      @for (r of tabs(); track r.id) {
        <button type="button" role="tab" [attr.aria-selected]="active() === r.id" [class.on]="active() === r.id"
                (click)="active.set(r.id)">
          <span class="flag" aria-hidden="true">{{ flag(r.country) }}</span>{{ r.name }}
        </button>
      }
    </nav>

    @if (problem(); as p) {
      <app-error-state [problem]="p" (retry)="reload()" />
    } @else if (active() === 'ppwr_dk') {
      <div class="kpis">
        <div class="kpi dark"><div class="kpi-label">Ready to sign</div><div class="kpi-value">{{ readyCount() }}</div></div>
        <div class="kpi"><div class="kpi-label">Drafts</div><div class="kpi-value">{{ (docs.value()?.length ?? 0) - readyCount() }}</div></div>
        <div class="kpi"><div class="kpi-label">Products</div><div class="kpi-value">{{ docs.value()?.length ?? 0 }}</div></div>
      </div>
      <app-data-table [columns]="docColumns" [rows]="docs.value() ?? []" [loading]="docs.loading()" [clickable]="true"
                      [trackBy]="bySku" (rowClick)="openDoc($event)">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('status') {
              <app-status-chip [tone]="row.status === 'ready' ? 'green' : 'amber'">{{ row.status === 'ready' ? 'Ready' : 'Draft' }}</app-status-chip>
            }
            @case ('checks') {
              <span class="dots">
                @for (k of requirements; track k) {
                  <span class="dot" [class]="row.requirements[k]" [title]="requirementLabel(k) + ': ' + row.requirements[k]"></span>
                }
              </span>
            }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    } @else if (epr(); as r) {
      @if (r.rates_status === 'placeholder') {
        <div class="notice" role="note"><b>Placeholder rates</b> {{ r.rates_note }}</div>
      }
      <div class="kpis">
        <div class="kpi dark">
          <div class="kpi-label">{{ r.name }} fee {{ r.year }}</div>
          <div class="kpi-value">{{ r.total_fee | currency: r.currency : 'symbol' : '1.0-0' }}</div>
        </div>
        <div class="kpi"><div class="kpi-label">Packaging placed</div><div class="kpi-value">{{ r.total_tonnes | number: '1.0-1' }} t</div></div>
        <div class="kpi"><div class="kpi-label">In fee scope</div><div class="kpi-value">{{ r.fee_tonnes | number: '1.0-1' }} t</div></div>
        <div class="kpi"><div class="kpi-label">Measured weights</div><div class="kpi-value">{{ confidence(r) }}%</div></div>
      </div>

      <div class="grid">
        <section class="card">
          <h2 class="card-title">Fee by material</h2>
          @for (m of r.by_material; track m.code) {
            <div class="bar-row">
              <div class="bar-head">
                <b>{{ m.name }}</b>
                <span class="num">{{ m.fee | currency: r.currency : 'symbol' : '1.0-0' }}</span>
              </div>
              <div class="bar"><span [style.width.%]="m.share_pct"></span></div>
              <div class="bar-foot muted">
                <span>{{ m.fee_tonnes | number: '1.0-1' }} t × {{ m.rate | currency: r.currency : 'symbol' : '1.0-0' }}/t</span>
                <span>{{ m.share_pct }}%</span>
              </div>
            </div>
          }
        </section>

        <section class="card">
          <h2 class="card-title">Data behind the number</h2>
          <dl class="quality">
            <div><dt>Components</dt><dd>{{ r.data_quality.components }}</dd></div>
            <div><dt>Missing weight or material</dt><dd [class.bad]="r.data_quality.missing_weight_or_material">{{ r.data_quality.missing_weight_or_material }}</dd></div>
            <div><dt>Estimated weights</dt><dd [class.warn]="r.data_quality.estimated_weights">{{ r.data_quality.estimated_weights }}</dd></div>
            <div><dt>Products without sales</dt><dd>{{ r.data_quality.products_without_sales }}</dd></div>
            <div><dt>Fee applies to</dt><dd>{{ r.fee_channels.join(', ') }}</dd></div>
          </dl>
          @if (r.targets.length) {
            <h3 class="sub">Targets</h3>
            @for (t of r.targets; track t.label) {
              <div class="target"><span>{{ t.label }}</span><b>{{ t.target }}</b></div>
            }
          }
          @if (r.rates_status === 'published') {
            <p class="muted small">{{ r.rates_note }}</p>
          }
        </section>
      </div>

      <h2 class="section-title">Fee by product</h2>
      <app-data-table [columns]="productColumns()" [rows]="r.by_product" [clickable]="true" [trackBy]="bySku"
                      (rowClick)="openProduct($event.sku)" />
    } @else {
      <div class="card muted">Calculating…</div>
    }
  `,
  styles: `
    .flag {
      font-size: 15px;
    }
    .notice {
      margin-bottom: 16px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fff7e6;
      border: 1px solid #f2d39a;
      color: #6b4a00;
      font-size: 13px;
    }
    .grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 16px;
      margin: 16px 0 28px;
    }
    .grid .card {
      margin: 0;
    }
    .bar-row + .bar-row {
      margin-top: 16px;
    }
    .bar-head,
    .bar-foot {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .bar-foot {
      font-size: 12px;
      margin-top: 4px;
    }
    .num {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .bar {
      height: 8px;
      margin-top: 6px;
      border-radius: 4px;
      background: var(--border);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      border-radius: 4px;
      background: var(--accent);
    }
    .quality {
      margin: 0;
    }
    .quality div {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .quality dt {
      color: var(--muted);
    }
    .quality dd {
      margin: 0;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .quality dd.bad {
      color: #c0211f;
    }
    .quality dd.warn {
      color: #a35f00;
    }
    .sub {
      font-size: 13px;
      margin: 16px 0 6px;
    }
    .target {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      font-size: 13px;
    }
    .small {
      font-size: 12px;
      margin: 14px 0 0;
    }
    .dots {
      display: inline-flex;
      gap: 5px;
    }
    .dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: var(--border);
    }
    .dot.ok {
      background: #15966a;
    }
    .dot.warning {
      background: #e0a100;
    }
    .dot.missing {
      background: #c0211f;
    }
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ComplianceComponent {
  private readonly api = inject(PlatformApi);
  private readonly router = inject(Router);

  protected readonly regimes = load(() => this.api.regimes());
  protected readonly active = signal<string>('epr_uk');
  protected readonly year = signal<string | undefined>(undefined);
  protected readonly epr = signal<EprResult | null>(null);
  protected readonly docs = load(() => this.api.declarations());
  protected readonly problem = signal<Problem | null>(null);
  protected readonly requirements = REQUIREMENTS;

  /** In-scope regimes first; the first one opens. */
  protected readonly tabs = computed(() => (this.regimes.value() ?? []).filter((r) => r.in_scope));
  protected readonly readyCount = computed(() => (this.docs.value() ?? []).filter((d) => d.status === 'ready').length);

  protected readonly docColumns: Column<DeclarationRow>[] = [
    { key: 'sku', label: 'SKU', value: (d) => d.sku },
    { key: 'product_name', label: 'Product', value: (d) => d.product_name },
    { key: 'reference', label: 'Declaration', value: (d) => d.reference || '—' },
    { key: 'checks', label: 'Requirements' },
    { key: 'status', label: 'Status' },
  ];

  protected readonly productColumns = computed<Column<EprResult['by_product'][number]>[]>(() => {
    const r = this.epr();
    const money = (n: number) =>
      new Intl.NumberFormat('en-GB', { style: 'currency', currency: r?.currency ?? 'GBP', maximumFractionDigits: 0 }).format(n);
    return [
      { key: 'sku', label: 'SKU', value: (p) => p.sku },
      { key: 'name', label: 'Product', value: (p) => p.name },
      { key: 'main_material', label: 'Main material', value: (p) => p.main_material ?? '—' },
      { key: 'tonnes', label: 'Tonnes', value: (p) => p.tonnes.toFixed(1), align: 'end' },
      { key: 'fee', label: 'Fee', value: (p) => money(p.fee), align: 'end' },
    ];
  });

  protected readonly bySku = (r: { sku: string }) => r.sku;

  constructor() {
    // Open the first regime the workspace covers.
    effect(() => {
      const first = this.tabs()[0];
      if (first && !this.tabs().some((t) => t.id === this.active())) this.active.set(first.id);
    });
    // Recalculate when the regime or the year changes.
    effect(() => this.fetch(this.active(), this.year()));
  }

  private fetch(id: string, year: string | undefined): void {
    if (id === 'ppwr_dk') return;
    this.problem.set(null);
    this.epr.set(null);
    this.api.epr(id as EprId, year).subscribe({
      next: (r) => this.epr.set(r),
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }

  protected reload(): void {
    this.problem.set(null);
    this.regimes.reload();
    this.docs.reload();
    this.fetch(this.active(), this.year());
  }

  protected flag(country: Regime['country']): string {
    return { UK: '🇬🇧', DK: '🇩🇰', 'US-CA': '🇺🇸' }[country] ?? '';
  }

  protected confidence(r: EprResult): number {
    const q = r.data_quality;
    const measured = q.components - q.missing_weight_or_material - q.estimated_weights;
    return q.components ? Math.round((measured / q.components) * 100) : 0;
  }

  protected requirementLabel(key: (typeof REQUIREMENTS)[number]): string {
    return REQUIREMENT_LABELS[key];
  }

  protected openDoc(d: DeclarationRow): void {
    void this.router.navigate(['/app/compliance/declarations', d.sku]);
  }

  protected openProduct(sku: string): void {
    void this.router.navigate(['/app/products', sku]);
  }
}
