import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DataPointCoverage, SourceId } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { load } from '../../core/api/resource';
import { ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/ui';
import { SOURCE_TONE } from '../data-points/data-points.component';

/** Screen 8: how complete the client's data is, data point by data point. */
@Component({
  selector: 'app-data-overview',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PageHeaderComponent, StatusChipComponent, ErrorStateComponent],
  template: `
    <app-page-header title="Data overview" />

    @if (overview.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="overview.reload()" />
    } @else if (overview.value(); as o) {
      <div class="kpis">
        <div class="kpi dark">
          <div class="kpi-label">Data ready</div>
          <div class="kpi-value">{{ o.readiness_pct }}%</div>
          <div class="bar on-dark"><span [style.width.%]="o.readiness_pct"></span></div>
        </div>
        <div class="kpi"><div class="kpi-label">Products</div><div class="kpi-value">{{ o.products }}</div></div>
        <div class="kpi"><div class="kpi-label">Components</div><div class="kpi-value">{{ o.components }}</div></div>
        <a class="kpi link" routerLink="/app/gaps">
          <div class="kpi-label">Open blockers</div>
          <div class="kpi-value">{{ o.open_blockers }}</div>
        </a>
      </div>

      <div class="sources">
        @for (s of o.by_source; track s.source) {
          <button type="button" class="card source" [class.on]="source() === s.source"
                  (click)="source.set(source() === s.source ? '' : s.source)" [attr.aria-pressed]="source() === s.source">
            <app-status-chip [tone]="tone(s.source)">{{ s.name }}</app-status-chip>
            <span class="pct">{{ s.coverage_pct }}%</span>
            <span class="bar" [class.amber]="s.coverage_pct < 90"><span [style.width.%]="s.coverage_pct"></span></span>
          </button>
        }
      </div>

      <section class="card">
        <div class="head">
          <h2 class="card-title">Data points</h2>
          <span class="legend">
            <span><i class="g"></i>Filled</span><span><i class="a"></i>Estimated</span><span><i class="r"></i>Missing</span>
          </span>
        </div>
        <div class="grid">
          @for (dp of points(); track dp.code) {
            <div class="dp" [title]="dp.name">
              <div class="dp-head">
                <span class="mono">{{ dp.code }}</span>
                <span class="dp-pct">{{ pct(dp) }}%</span>
              </div>
              <div class="dp-name">{{ dp.name }}</div>
              <div class="stack" role="img" [attr.aria-label]="dp.filled + ' filled, ' + dp.estimated + ' estimated, ' + dp.missing + ' missing'">
                @if (dp.filled) { <span class="g" [style.flex]="dp.filled"></span> }
                @if (dp.estimated) { <span class="a" [style.flex]="dp.estimated"></span> }
                @if (dp.missing) { <span class="r" [style.flex]="dp.missing"></span> }
              </div>
            </div>
          }
        </div>
      </section>
    } @else {
      <div class="kpis">@for (i of [1, 2, 3, 4]; track i) { <div class="kpi skeleton"></div> }</div>
    }
  `,
  styles: `
    .kpi.link {
      color: inherit;
      text-decoration: none;
    }
    .kpi.link:hover {
      border-color: var(--border-2);
    }
    .bar.on-dark {
      margin-top: 10px;
      background: rgb(255 255 255 / 0.16);
    }
    .sources {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 14px;
      margin-bottom: 20px;
    }
    .source {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 10px;
      font: inherit;
      text-align: left;
      cursor: pointer;
    }
    .source.on {
      border-color: var(--navy-700);
      box-shadow: 0 0 0 1px var(--navy-700);
    }
    .source .bar {
      width: 100%;
    }
    .pct {
      font-size: 22px;
      font-weight: 700;
    }
    .head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .legend {
      display: flex;
      gap: 14px;
      font-size: 12.5px;
      color: var(--muted);
    }
    .legend i {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 3px;
      margin-right: 6px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
      gap: 10px;
    }
    .dp {
      padding: 12px;
      border: 1px solid var(--border);
      border-radius: 12px;
      background: var(--card-2);
    }
    .dp-head {
      display: flex;
      justify-content: space-between;
    }
    .dp-pct {
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .dp-name {
      margin: 4px 0 10px;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .stack {
      display: flex;
      height: 6px;
      border-radius: 99px;
      overflow: hidden;
      background: #e8edf4;
      gap: 2px;
    }
    .g {
      background: var(--green);
    }
    .a {
      background: var(--amber);
    }
    .r {
      background: var(--red);
    }
    .skeleton {
      height: 96px;
    }
  `,
})
export class DataOverviewComponent {
  private readonly api = inject(PlatformApi);

  protected readonly overview = load(() => this.api.dataOverview());
  protected readonly source = signal<SourceId | ''>('');

  protected readonly points = computed(() =>
    (this.overview.value()?.data_points ?? []).filter((d) => d.total > 0 && (!this.source() || d.source === this.source())),
  );

  protected tone = (s: SourceId) => SOURCE_TONE[s];

  protected pct(d: DataPointCoverage): number {
    return d.total ? Math.round((d.filled / d.total) * 100) : 0;
  }
}
