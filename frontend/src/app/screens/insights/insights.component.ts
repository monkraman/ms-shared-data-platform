import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, switchMap } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Insights, Recommendation, ScenarioResult } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import { ChipTone, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/ui';
import { EprId, ScenarioDraft } from './scenario-draft';


const KIND: Record<Recommendation['kind'], { label: string; tone: ChipTone }> = {
  lightweight: { label: 'Lightweight', tone: 'green' },
  measure: { label: 'Measure', tone: 'blue' },
  recyclability: { label: 'Recyclability', tone: 'amber' },
  recycled_content: { label: 'Recycled content', tone: 'neutral' },
};
const MATERIALS = ['Plastic', 'Paper/board', 'Glass', 'Steel', 'Aluminium', 'Wood', 'Fibre composite'];

/**
 * Screen 14 (first part), two pages on one component (route data `view`):
 * Hotspots — why the fee is what it is and what to do about it; Scenarios — what if.
 */
@Component({
  selector: 'app-insights',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, CurrencyPipe, PageHeaderComponent, StatusChipComponent, ErrorStateComponent],
  template: `
    <app-page-header [title]="view() === 'hotspots' ? 'Hotspots' : 'Scenarios'">
      <a class="btn btn-secondary" routerLink="/app/actions">Actions</a>
    </app-page-header>

    <nav class="segmented" role="tablist" aria-label="Regimes">
      @for (r of tabs(); track r.id) {
        <button type="button" role="tab" [attr.aria-selected]="active() === r.id" [class.on]="active() === r.id" (click)="switchTo(r.id)">
          {{ r.name }}
        </button>
      }
    </nav>

    @if (problem(); as p) {
      <app-error-state [problem]="p" (retry)="fetch()" />
    } @else if (data(); as d) {
      <div class="kpis">
        <div class="kpi dark"><div class="kpi-label">{{ d.name }} fee {{ d.year }}</div><div class="kpi-value">{{ d.total_fee | currency: d.currency : 'symbol' : '1.0-0' }}</div></div>
        <div class="kpi"><div class="kpi-label">Top 3 components</div><div class="kpi-value">{{ d.hotspots.top3_share_pct }}%</div></div>
        <div class="kpi"><div class="kpi-label">Possible savings</div><div class="kpi-value">{{ savings() | currency: d.currency : 'symbol' : '1.0-0' }}</div></div>
        <div class="kpi"><div class="kpi-label">Recommendations</div><div class="kpi-value">{{ d.recommendations.length }}</div></div>
      </div>

      @if (view() === 'hotspots') {
      <div class="grid">
        <section class="card">
          <h2 class="card-title">Where the fee comes from</h2>
          @for (c of d.hotspots.components; track c.component_id) {
            <div class="hot">
              <div class="hot-head">
                <div class="who">
                  <b>{{ c.name }}</b>
                  <span class="muted">{{ c.product_name }}</span>
                </div>
                <div class="amount">
                  <b>{{ c.fee | currency: d.currency : 'symbol' : '1.0-0' }}</b>
                  <span class="muted">{{ c.share_pct }}%</span>
                </div>
              </div>
              <div class="bar"><span [style.width.%]="barWidth(c.share_pct)"></span></div>
              <div class="hot-foot">
                <span class="muted">{{ c.why }}@if (c.estimated) { · estimated weight }</span>
                <button type="button" class="link" (click)="addChange(c.component_id, c.name, c.product_name)">What if</button>
              </div>
            </div>
          }
        </section>

        <section class="card">
          <h2 class="card-title">By material</h2>
          @for (m of d.hotspots.materials; track m.code) {
            <div class="mat">
              <div><b>{{ m.name }}</b><span class="muted">{{ m.why }}</span></div>
              <div class="amount"><b>{{ m.fee | currency: d.currency : 'symbol' : '1.0-0' }}</b><span class="muted">{{ m.share_pct }}%</span></div>
            </div>
          }
        </section>
      </div>
      } @else {
      <section class="card scenario" id="scenario">
        <div class="scenario-head">
          <h2 class="card-title">Scenario</h2>
          @if (changes().length) {
            <button type="button" class="btn btn-ghost" (click)="changes.set([])">Clear</button>
          }
        </div>
        <label class="field add">Component
          <select [ngModel]="''" (ngModelChange)="addById($event)">
            <option value="">Add a component</option>
            @for (c of available(); track c.component_id) {
              <option [value]="c.component_id">{{ c.name }} · {{ c.product_name }}</option>
            }
          </select>
        </label>
        @if (changes().length) {
          @for (ch of changes(); track ch.component_id; let i = $index) {
            <div class="change">
              <div class="who"><b>{{ ch.name }}</b><span class="muted">{{ ch.product_name }}</span></div>
              <label class="field">Weight (g)
                <input type="number" min="0" step="0.1" [ngModel]="ch.weight_g" (ngModelChange)="edit(i, 'weight_g', $event)" />
              </label>
              <label class="field">Material
                <select [ngModel]="ch.material ?? ''" (ngModelChange)="edit(i, 'material', $event)">
                  <option value="">Unchanged</option>
                  @for (m of materials; track m) { <option [value]="m">{{ m }}</option> }
                </select>
              </label>
              <button type="button" class="btn btn-ghost" aria-label="Remove change" (click)="remove(i)">×</button>
            </div>
          }
          @if (result(); as r) {
            <div class="outcome">
              <div><span class="muted">Today</span><b>{{ r.baseline_fee | currency: r.currency : 'symbol' : '1.0-0' }}</b></div>
              <div class="arrow" aria-hidden="true">→</div>
              <div><span class="muted">Scenario</span><b>{{ r.scenario_fee | currency: r.currency : 'symbol' : '1.0-0' }}</b></div>
              <div class="delta" [class.down]="r.delta < 0" [class.up]="r.delta > 0">
                {{ r.delta < 0 ? '−' : '+' }}{{ abs(r.delta) | currency: r.currency : 'symbol' : '1.0-0' }}
                <span>{{ r.delta_pct }}%</span>
              </div>
            </div>
          }
        }
      </section>
      }

      <h2 class="section-title">Recommendations</h2>
      <div class="recs">
        @for (r of d.recommendations; track r.id) {
          <article class="card rec">
            <div class="rec-top">
              <app-status-chip [tone]="kind(r).tone">{{ kind(r).label }}</app-status-chip>
              <span class="muted effort">{{ r.effort }} effort</span>
            </div>
            <h3>{{ r.title }}</h3>
            <p class="muted">{{ r.detail }}</p>
            <div class="rec-foot">
              @if (r.impact_value !== null && r.impact_value !== undefined) {
                <div class="impact"><span class="muted">{{ r.impact_label }}</span><b>{{ r.impact_value | currency: d.currency : 'symbol' : '1.0-0' }}</b></div>
              } @else {
                <span></span>
              }
              <div class="rec-actions">
                @if (r.scenario) {
                  <button type="button" class="btn btn-ghost" (click)="tryScenario(r)">Try in scenario</button>
                }
                @if (r.action_id) {
                  <a class="btn btn-secondary" routerLink="/app/actions">Action created</a>
                } @else if (canAct()) {
                  <button type="button" class="btn btn-primary" [disabled]="creating() === r.id" (click)="createAction(r, d)">Create action</button>
                }
              </div>
            </div>
          </article>
        }
      </div>
    } @else {
      <div class="card muted">Calculating…</div>
    }
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: 3fr 2fr;
      gap: 16px;
      margin: 16px 0;
    }
    .grid .card,
    .scenario {
      margin: 0;
    }
    .hot + .hot {
      margin-top: 14px;
    }
    .hot-head,
    .hot-foot,
    .mat {
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .who,
    .mat > div:first-child {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .amount {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .bar {
      height: 6px;
      margin: 6px 0 4px;
      border-radius: 3px;
      background: var(--border);
      overflow: hidden;
    }
    .bar span {
      display: block;
      height: 100%;
      background: var(--accent);
      border-radius: 3px;
    }
    .hot-foot {
      font-size: 12px;
      align-items: center;
    }
    .link {
      border: 0;
      background: none;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      padding: 0;
      white-space: nowrap;
    }
    .mat {
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .scenario {
      margin-bottom: 28px;
    }
    .scenario-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .add {
      max-width: 360px;
      margin-bottom: 12px;
    }
    .change {
      display: grid;
      grid-template-columns: 1fr 140px 170px auto;
      gap: 12px;
      align-items: end;
      padding: 10px 0;
      border-bottom: 1px solid var(--border);
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
      color: var(--muted);
    }
    .field input,
    .field select {
      padding: 7px 9px;
      border: 1px solid var(--border);
      border-radius: 8px;
      font: inherit;
      color: var(--ink);
      background: var(--bg-input, #fff);
    }
    .outcome {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      margin-top: 16px;
      padding: 16px;
      border-radius: 12px;
      background: var(--bg);
    }
    .outcome > div:not(.arrow) {
      display: flex;
      flex-direction: column;
      font-size: 20px;
      font-variant-numeric: tabular-nums;
    }
    .outcome span {
      font-size: 12px;
    }
    .arrow {
      color: var(--muted);
      font-size: 20px;
    }
    .delta {
      margin-left: auto;
      font-weight: 700;
    }
    .delta.down {
      color: #15966a;
    }
    .delta.up {
      color: #c0211f;
    }
    .recs {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
      gap: 16px;
    }
    .rec {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin: 0;
    }
    .rec h3 {
      margin: 0;
      font-size: 15px;
      line-height: 1.35;
    }
    .rec p {
      margin: 0;
      font-size: 13px;
    }
    .rec-top,
    .rec-foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .rec-foot {
      margin-top: auto;
      padding-top: 8px;
    }
    .effort {
      font-size: 12px;
      text-transform: capitalize;
    }
    .impact {
      display: flex;
      flex-direction: column;
      font-variant-numeric: tabular-nums;
    }
    .impact span {
      font-size: 12px;
    }
    .rec-actions {
      display: flex;
      gap: 6px;
    }
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
      .change {
        grid-template-columns: 1fr 1fr;
      }
    }
  `,
})
export class InsightsComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  private readonly router = inject(Router);
  private readonly draft = inject(ScenarioDraft);

  /** Which page this is (route data). */
  readonly view = input<'hotspots' | 'scenarios'>('hotspots');

  protected readonly regimes = load(() => this.api.regimes());
  protected readonly tabs = computed(() => (this.regimes.value() ?? []).filter((r) => r.in_scope && r.id !== 'ppwr_dk'));
  protected readonly active = this.draft.regime;
  protected readonly data = signal<Insights | null>(null);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly changes = this.draft.changes;
  protected readonly result = signal<ScenarioResult | null>(null);
  protected readonly creating = signal<string | null>(null);
  protected readonly canAct = computed(() => this.session.can('actions.manage'));
  protected readonly materials = MATERIALS;
  protected readonly savings = computed(() =>
    (this.data()?.recommendations ?? [])
      .filter((r) => r.kind === 'lightweight')
      .reduce((sum, r) => sum + (r.impact_value ?? 0), 0),
  );
  /** Components not yet in the scenario. */
  protected readonly available = computed(() =>
    (this.data()?.hotspots.components ?? []).filter((c) => !this.changes().some((ch) => ch.component_id === c.component_id)),
  );
  private readonly recalc = new Subject<void>();

  constructor() {
    effect(() => {
      const first = this.tabs()[0];
      if (first && !this.tabs().some((t) => t.id === this.active())) this.active.set(first.id as EprId);
    });
    effect(() => {
      this.active();
      this.fetch();
    });
    this.recalc
      .pipe(
        debounceTime(300),
        switchMap(() =>
          this.api.scenario(
            this.active(),
            this.changes().map(({ component_id, weight_g, material }) => ({
              component_id,
              weight_g: weight_g ? String(weight_g) : null,
              material: material || null,
            })),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe({ next: (r) => this.result.set(r), error: (e: unknown) => this.toast.show(toProblem(e).detail, 'error') });
    // A scenario started from Hotspots ("What if") is calculated when Scenarios opens.
    if (this.changes().length) queueMicrotask(() => this.recalc.next());
  }

  protected fetch(): void {
    this.problem.set(null);
    this.data.set(null);
    this.api.insights(this.active()).subscribe({
      next: (d) => this.data.set(d),
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }

  protected switchTo(id: string): void {
    this.changes.set([]);
    this.result.set(null);
    this.active.set(id as EprId);
  }

  protected kind(r: Recommendation) {
    return KIND[r.kind];
  }

  protected barWidth(share: number): number {
    const top = this.data()?.hotspots.components[0]?.share_pct || 1;
    return Math.max(2, (share / top) * 100);
  }

  protected abs(n: number): number {
    return Math.abs(n);
  }

  protected addChange(componentId: string, name: string, productName: string, weight?: string | null): void {
    if (!this.changes().some((c) => c.component_id === componentId)) {
      this.changes.update((list) => [...list, { component_id: componentId, name, product_name: productName, weight_g: weight ?? null, material: null }]);
    } else if (weight) {
      this.changes.update((list) => list.map((c) => (c.component_id === componentId ? { ...c, weight_g: weight } : c)));
    }
    if (this.view() === 'hotspots') {
      void this.router.navigate(['/app/scenarios']);
      return;
    }
    this.recalc.next();
  }

  protected addById(componentId: string): void {
    const c = this.data()?.hotspots.components.find((x) => x.component_id === componentId);
    if (c) this.addChange(c.component_id, c.name, c.product_name);
  }

  protected tryScenario(r: Recommendation): void {
    const hot = this.data()?.hotspots.components.find((c) => c.component_id === r.component_id);
    this.addChange(r.component_id, hot?.name ?? r.title, hot?.product_name ?? r.sku, r.scenario?.weight_g ?? null);
  }

  protected edit(i: number, key: 'weight_g' | 'material', value: string | number): void {
    this.changes.update((list) => list.map((c, j) => (j === i ? { ...c, [key]: value === '' ? null : String(value) } : c)));
    this.recalc.next();
  }

  protected remove(i: number): void {
    this.changes.update((list) => list.filter((_, j) => j !== i));
    if (this.changes().length) this.recalc.next();
    else this.result.set(null);
  }

  protected createAction(r: Recommendation, d: Insights): void {
    this.creating.set(r.id);
    this.api
      .createAction({
        title: r.title,
        detail: r.detail,
        recommendation_id: r.id,
        kind: r.kind,
        regime: d.regime,
        sku: r.sku,
        impact_value: r.impact_value ?? null,
        impact_label: r.impact_label ?? null,
        currency: d.currency,
        owner: '',
      })
      .subscribe({
        next: (a) => {
          this.creating.set(null);
          this.data.update((x) =>
            x ? { ...x, recommendations: x.recommendations.map((y) => (y.id === r.id ? { ...y, action_id: a.id } : y)) } : x,
          );
          this.toast.show('Action created');
        },
        error: (e: unknown) => {
          this.creating.set(null);
          this.toast.show(toProblem(e).detail, 'error');
        },
      });
  }
}
