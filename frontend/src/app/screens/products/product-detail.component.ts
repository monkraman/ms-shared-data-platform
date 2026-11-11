import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { Component as PackComponent, FieldValue, Product } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ChipTone, EmptyStateComponent, ErrorStateComponent, StatusChipComponent } from '../../shared/ui';

interface State {
  loading: boolean;
  product?: Product;
  problem?: Problem;
}

const LEVELS = ['Primary', 'Secondary', 'Transit'];

/** Screen 4: one product with its packaging BOM, sales placed on the market and passport data. */
@Component({
  selector: 'app-product-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DecimalPipe, StatusChipComponent, ErrorStateComponent, EmptyStateComponent],
  template: `
    <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/app/products">Products</a><span>/</span><span>{{ sku() }}</span></nav>

    @if (state(); as s) {
      @if (s.loading) {
        <div class="card skeleton" aria-busy="true"></div>
      } @else if (s.problem) {
        <app-error-state [problem]="s.problem" (retry)="reload()" />
      } @else if (s.product; as p) {
        <header class="head">
          <div>
            <h1>{{ p.name }}</h1>
            <div class="meta"><span class="mono">{{ p.sku }}</span><span>{{ p.brand }}</span><span class="mono">{{ p.gtin }}</span></div>
          </div>
          @if (p.open_gaps) {
            <a class="btn btn-secondary" routerLink="/app/gaps">{{ p.open_gaps }} open gaps</a>
          }
        </header>

        <div class="kpis">
          <div class="kpi dark"><div class="kpi-label">Packaging per unit</div><div class="kpi-value">{{ p.packaging_g_per_unit | number: '1.0-1' }} g</div></div>
          <div class="kpi"><div class="kpi-label">Components</div><div class="kpi-value">{{ p.component_count }}</div></div>
          <div class="kpi"><div class="kpi-label">Data complete</div><div class="kpi-value">{{ p.completeness_pct }}%</div></div>
          <div class="kpi"><div class="kpi-label">Units placed</div><div class="kpi-value">{{ unitsPlaced(p) | number }}</div></div>
        </div>

        <section class="card">
          <h2 class="card-title">Packaging</h2>
          @for (level of levels(p); track level.name) {
            <div class="level">
              <div class="level-name">{{ level.name }}</div>
              @for (c of level.items; track c.id) {
                <div class="comp">
                  <div class="comp-main">
                    <b>{{ c.name }}</b>
                    <span class="chips">
                      <app-status-chip>{{ c.material }}</app-status-chip>
                      @if (c.polymer && c.polymer !== 'n/a') { <app-status-chip>{{ c.polymer }}</app-status-chip> }
                      @if (c.recyclability) { <app-status-chip [tone]="recTone(c.recyclability)">{{ c.recyclability }}</app-status-chip> }
                    </span>
                  </div>
                  <div class="comp-nums">
                    <span><b>{{ c.weight_g ?? '—' }}</b> g</span>
                    <span class="muted">{{ c.weight_source }}</span>
                    <span>× {{ c.units_per_pack }}</span>
                    <span>{{ c.recycled_content_pct ?? 0 }}% recycled</span>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <div class="two">
          <section class="card">
            <h2 class="card-title">Placed on market</h2>
            @for (s of p.sales; track s.id) {
              <div class="row"><span>{{ s.period }} · {{ s.channel }}</span><b>{{ s.units_placed | number }}</b></div>
            } @empty {
              <app-empty-state title="No sales data" />
            }
          </section>
          <section class="card">
            <h2 class="card-title">Product passport</h2>
            @for (f of entries(p.passport); track f[0]) {
              <div class="row"><span class="muted">{{ label(f[0]) }}</span><span class="val">{{ f[1].value || '—' }}</span></div>
            } @empty {
              <app-empty-state title="No passport data" />
            }
          </section>
        </div>
      } @else {
        <app-empty-state title="Product not found" />
      }
    }
  `,
  styles: `
    .crumbs {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    .crumbs a {
      color: var(--muted);
      text-decoration: none;
    }
    .crumbs a:hover {
      color: var(--ink);
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 20px;
    }
    h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.3px;
    }
    .meta {
      display: flex;
      gap: 14px;
      margin-top: 6px;
      color: var(--muted);
    }
    .level + .level {
      margin-top: 16px;
    }
    .level-name {
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 6px;
    }
    .comp {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 12px 14px;
      border: 1px solid var(--border);
      border-radius: 12px;
      margin-bottom: 6px;
      background: var(--card-2);
    }
    .comp-main {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .comp-nums {
      display: flex;
      gap: 18px;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .two {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-top: 14px;
    }
    .row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 0;
      border-bottom: 1px solid var(--border);
    }
    .row:last-child {
      border-bottom: 0;
    }
    .val {
      text-align: right;
      overflow-wrap: anywhere;
    }
    .skeleton {
      height: 320px;
    }
    @media (max-width: 900px) {
      .two {
        grid-template-columns: 1fr;
      }
      .comp {
        flex-direction: column;
        align-items: flex-start;
      }
    }
  `,
})
export class ProductDetailComponent {
  private readonly api = inject(PlatformApi);

  /** Route parameter `:sku`. */
  readonly sku = input.required<string>();
  private readonly fields = load(() => this.api.fields());
  private readonly tick = signal(0);

  protected readonly state = toSignal(
    toObservable(computed(() => ({ sku: this.sku(), tick: this.tick() }))).pipe(
      switchMap(({ sku }) =>
        this.api.product(sku).pipe(
          map((product): State => ({ loading: false, product })),
          catchError((e: unknown) => of<State>({ loading: false, problem: toProblem(e) })),
          startWith<State>({ loading: true }),
        ),
      ),
    ),
    { initialValue: { loading: true } as State },
  );

  protected reload(): void {
    this.tick.update((n) => n + 1);
  }

  protected levels(p: Product): { name: string; items: PackComponent[] }[] {
    const names = [...LEVELS, ...new Set(p.components.map((c) => c.level).filter((l) => !LEVELS.includes(l)))];
    return names
      .map((name) => ({ name, items: p.components.filter((c) => c.level === name) }))
      .filter((l) => l.items.length);
  }

  protected unitsPlaced(p: Product): number {
    return p.sales.reduce((s, x) => s + x.units_placed, 0);
  }

  protected entries(rec: Record<string, FieldValue>): [string, FieldValue][] {
    return Object.entries(rec);
  }

  protected label(key: string): string {
    return this.fields.value()?.[key]?.label ?? key;
  }

  protected recTone(r: string): ChipTone {
    return r === 'Good' ? 'green' : r === 'Limited' ? 'amber' : 'red';
  }
}
