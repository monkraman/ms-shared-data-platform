import { CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlatformApi } from '../../core/api/platform-api';
import { load } from '../../core/api/resource';
import { SessionService } from '../../core/session/session.service';
import { EmptyStateComponent, ErrorStateComponent } from '../../shared/ui';

/**
 * Home: the workspace on one page. Every figure comes from `GET /home`, which uses the same
 * engines as the other screens (fees, assessment, validation, gaps, recommendations, actions).
 */
@Component({
  selector: 'app-home-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, CurrencyPipe, ErrorStateComponent, EmptyStateComponent],
  template: `
    <h1 class="greeting">{{ greeting() }}</h1>

    @if (summary.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="summary.reload()" />
    } @else if (summary.value(); as h) {
      @if (!h.skus) {
        <app-empty-state title="No products yet">
          <a class="btn btn-primary" routerLink="/app/data">Collect data</a>
        </app-empty-state>
      } @else {
        <div class="kpis">
          @for (f of h.fees; track f.regime; let first = $first) {
            <a class="kpi link" [class.dark]="first" routerLink="/app/compliance">
              <div class="kpi-label">{{ f.name }} {{ f.year }}</div>
              <div class="kpi-value">{{ f.total_fee | currency: f.currency : 'symbol' : '1.0-0' }}</div>
              <div class="ram" [attr.aria-label]="'RAM: green ' + f.ram_share_pct.Green + '%, amber ' + f.ram_share_pct.Amber + '%, red ' + f.ram_share_pct.Red + '%'">
                <span class="g" [style.flex]="f.ram_share_pct.Green"></span>
                <span class="a" [style.flex]="f.ram_share_pct.Amber"></span>
                <span class="r" [style.flex]="f.ram_share_pct.Red"></span>
              </div>
            </a>
          }
          @if (h.ppwr; as p) {
            <a class="kpi link" routerLink="/app/compliance">
              <div class="kpi-label">EU PPWR · declarations ready</div>
              <div class="kpi-value">{{ p.declarations_ready }}<small> of {{ p.declarations_total }}</small></div>
              @if (p.fails_2030) {
                <span class="tag red">{{ p.fails_2030 }} fail 2030</span>
              }
            </a>
          }
        </div>

        <div class="grid">
          <section class="card">
            <div class="card-head">
              <h2 class="card-title">Biggest cost hotspots</h2>
              <a class="link-more" routerLink="/app/insights">Hotspots</a>
            </div>
            <table class="table">
              <thead>
                <tr><th>Component</th><th class="num">Fee</th><th class="num">Share</th><th>Recommendation</th></tr>
              </thead>
              <tbody>
                @for (c of h.hotspots; track c.component_id) {
                  <tr>
                    <td><b>{{ c.name }}</b> · {{ c.product_name }}</td>
                    <td class="num">{{ c.fee | currency: h.hotspots_currency ?? 'GBP' : 'symbol' : '1.0-0' }}</td>
                    <td class="num">{{ c.share_pct }}%</td>
                    <td>{{ c.recommendation ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </section>

          <div class="side">
            <section class="card">
              <h2 class="card-title">Data health</h2>
              <div class="health-bar" aria-hidden="true">
                <span class="g" [style.flex]="h.data_health.verified"></span>
                <span class="a" [style.flex]="h.data_health.estimated"></span>
                <span class="r" [style.flex]="h.data_health.flagged"></span>
              </div>
              <div class="row"><span><i class="dot g"></i>Verified</span><b>{{ h.data_health.verified_pct }}%</b></div>
              <div class="row"><span><i class="dot a"></i>Estimated</span><b>{{ h.data_health.estimated_pct }}%</b></div>
              <div class="row"><span><i class="dot r"></i>Flagged</span><b>{{ h.data_health.flagged_pct }}%</b></div>
              <div class="row"><span>Open data gaps</span><b>{{ h.data_health.open_gaps }}</b></div>
            </section>

            @if (h.waiting.length) {
              <section class="card">
                <h2 class="card-title">Waiting for you <span class="count">{{ h.waiting.length }}</span></h2>
                @for (w of h.waiting; track w.key) {
                  <a class="row link-row" [routerLink]="w.link"><span>{{ w.label }}</span><b>{{ w.count }}</b></a>
                }
              </section>
            }

            @if (h.savings.length) {
              <section class="card">
                <h2 class="card-title">Savings in plan</h2>
                @for (s of h.savings; track s.currency) {
                  <a class="row link-row" routerLink="/app/actions">
                    <span>{{ s.actions }} actions</span><b>{{ s.amount | currency: s.currency : 'symbol' : '1.0-0' }}</b>
                  </a>
                }
              </section>
            }
          </div>
        </div>
      }
    } @else {
      <div class="card skeleton" aria-busy="true"></div>
    }
  `,
  styles: `
    .greeting {
      margin: 8px 0 18px;
      font-size: 28px;
      letter-spacing: -0.02em;
    }
    .kpi.link {
      display: block;
      color: inherit;
      text-decoration: none;
    }
    .kpi-value small {
      font-size: 0.5em;
      font-weight: 500;
      opacity: 0.7;
    }
    .ram,
    .health-bar {
      display: flex;
      height: 6px;
      margin-top: 12px;
      border-radius: 999px;
      overflow: hidden;
      background: var(--border);
    }
    .health-bar {
      height: 10px;
      margin: 4px 0 12px;
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
    .tag {
      display: inline-block;
      margin-top: 10px;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
    }
    .tag.red {
      background: var(--red-bg);
      color: var(--red-ink);
    }
    .grid {
      display: grid;
      grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
      gap: 16px;
      margin-top: 16px;
    }
    .side {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
    }
    .link-more {
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .table th {
      text-align: left;
      font-size: 12px;
      color: var(--muted);
      font-weight: 600;
      padding: 6px 8px 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .table td {
      padding: 10px 8px 10px 0;
      border-bottom: 1px solid var(--border);
      vertical-align: top;
    }
    .num {
      text-align: right;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }
    .row {
      display: flex;
      justify-content: space-between;
      padding: 7px 0;
      font-size: 14px;
    }
    .link-row {
      color: inherit;
      text-decoration: none;
      border-top: 1px solid var(--border);
    }
    .link-row:hover b {
      text-decoration: underline;
    }
    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 8px;
      border-radius: 50%;
    }
    .count {
      margin-left: 6px;
      padding: 1px 7px;
      border-radius: 999px;
      background: var(--red-bg);
      color: var(--red-ink);
      font-size: 12px;
    }
    .skeleton {
      height: 240px;
    }
    @media (max-width: 1000px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class HomeDashboardComponent {
  private readonly api = inject(PlatformApi);
  private readonly session = inject(SessionService);
  protected readonly summary = load(() => this.api.home());

  protected readonly greeting = computed(() => {
    const first = (this.session.me()?.user.full_name ?? '').split(' ')[0];
    const hour = new Date().getHours();
    const part = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    return first ? `${part}, ${first}` : part;
  });
}
