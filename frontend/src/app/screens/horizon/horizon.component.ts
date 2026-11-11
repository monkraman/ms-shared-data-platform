import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Milestone } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import { ChipTone, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/ui';

const STATUS: Record<Milestone['status'], { label: string; tone: ChipTone }> = {
  now: { label: 'In force', tone: 'green' },
  collecting: { label: 'Collecting now', tone: 'blue' },
  upcoming: { label: 'Upcoming', tone: 'neutral' },
};
const SOURCES: Record<string, string> = { erp: 'ERP', plm: 'PLM', supplier: 'Supplier', man: 'Manual' };

/** Horizon scanning: upcoming requirements, when their data collection starts, and readiness. */
@Component({
  selector: 'app-horizon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, DatePipe, PageHeaderComponent, StatusChipComponent, ErrorStateComponent],
  template: `
    <app-page-header title="Horizon">
      <label class="lead">
        <span>Start collecting</span>
        <select aria-label="Lead time" [disabled]="!canEdit() || saving()" [ngModel]="horizon.value()?.lead_months"
                (ngModelChange)="setLead(+$event)">
          @for (m of leads; track m) { <option [value]="m">{{ m }} {{ m === 1 ? 'month' : 'months' }} before</option> }
        </select>
      </label>
    </app-page-header>

    @if (horizon.error(); as p) {
      <app-error-state [problem]="p" (retry)="horizon.reload()" />
    } @else if (horizon.value(); as h) {
      <div class="kpis">
        <div class="kpi dark"><div class="kpi-label">Next requirement</div><div class="kpi-value">{{ next() ? (next()!.date | date: 'MMM y') : '—' }}</div></div>
        <div class="kpi"><div class="kpi-label">Collecting now</div><div class="kpi-value">{{ count('collecting') }}</div></div>
        <div class="kpi"><div class="kpi-label">Upcoming</div><div class="kpi-value">{{ count('upcoming') }}</div></div>
        <div class="kpi"><div class="kpi-label">In force</div><div class="kpi-value">{{ count('now') }}</div></div>
      </div>

      <ol class="timeline">
        @for (m of h.milestones; track m.id) {
          <li class="item" [class]="m.status">
            <div class="when">
              <b>{{ m.date | date: 'd MMM y' }}</b>
              <span class="muted">{{ when(m) }}</span>
            </div>
            <div class="node" aria-hidden="true"></div>
            <article class="card body">
              <div class="top">
                <div>
                  <span class="reg">{{ m.regulation }}</span>
                  <h2>{{ m.title }}</h2>
                </div>
                <app-status-chip [tone]="status(m).tone">{{ status(m).label }}</app-status-chip>
              </div>
              <p class="muted">{{ m.note }}</p>
              <div class="facts">
                <div><span>Collect from</span><b>{{ m.collect_from | date: 'd MMM y' }}</b></div>
                <div><span>Data ready</span><b>{{ m.coverage_pct }}%</b></div>
                <div><span>Open gaps</span><b>{{ m.open_gaps }}</b></div>
                <div><span>Data points</span><b>{{ m.data_points.length }}</b></div>
              </div>
              <div class="bar"><span [style.width.%]="m.coverage_pct"></span></div>
              <button type="button" class="link" (click)="toggle(m.id)" [attr.aria-expanded]="open().has(m.id)">
                {{ open().has(m.id) ? 'Hide data points' : 'Show data points' }}
              </button>
              @if (open().has(m.id)) {
                <table>
                  <thead><tr><th>Data point</th><th>Source</th><th class="n">Filled</th><th>Ready</th></tr></thead>
                  <tbody>
                    @for (p of m.data_points; track p.code) {
                      <tr>
                        <td><span class="mono muted">{{ p.code }}</span> {{ p.name }}</td>
                        <td>{{ source(p.source) }}</td>
                        <td class="n">{{ p.filled }}/{{ p.total }}</td>
                        <td><div class="mini"><span [style.width.%]="p.coverage_pct"></span></div></td>
                      </tr>
                    }
                  </tbody>
                </table>
                @if (m.open_gaps) {
                  <a class="btn btn-secondary" routerLink="/app/gaps">Open gaps</a>
                }
              }
            </article>
          </li>
        } @empty {
          <li class="muted">No upcoming requirements for this workspace's modules and countries.</li>
        }
      </ol>
    }
  `,
  styles: `
    .lead {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      color: var(--muted);
    }
    .timeline {
      list-style: none;
      margin: 8px 0 0;
      padding: 0;
    }
    .item {
      display: grid;
      grid-template-columns: 130px 28px 1fr;
      gap: 0 12px;
      position: relative;
    }
    .item::before {
      content: '';
      position: absolute;
      left: 155px;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border);
    }
    .item:first-child::before {
      top: 22px;
    }
    .item:last-child::before {
      bottom: calc(100% - 22px);
    }
    .when {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      padding-top: 12px;
      text-align: right;
      font-size: 13px;
    }
    .node {
      position: relative;
      z-index: 1;
      width: 14px;
      height: 14px;
      margin: 16px auto 0;
      border-radius: 50%;
      background: var(--card);
      border: 3px solid var(--border);
    }
    .item.collecting .node {
      border-color: var(--accent);
      box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 20%, transparent);
    }
    .item.now .node {
      border-color: #15966a;
      background: #15966a;
    }
    .body {
      margin: 0 0 16px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
    }
    .reg {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent);
    }
    h2 {
      margin: 2px 0 0;
      font-size: 16px;
    }
    .body > p {
      margin: 8px 0 12px;
      font-size: 13px;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
    }
    .facts div {
      display: flex;
      flex-direction: column;
    }
    .facts span {
      font-size: 12px;
      color: var(--muted);
    }
    .bar,
    .mini {
      height: 6px;
      border-radius: 3px;
      background: var(--border);
      overflow: hidden;
    }
    .bar {
      margin: 12px 0 8px;
    }
    .mini {
      width: 90px;
    }
    .bar span,
    .mini span {
      display: block;
      height: 100%;
      background: var(--accent);
    }
    .link {
      border: 0;
      background: none;
      padding: 0;
      color: var(--accent);
      font: inherit;
      font-weight: 600;
      cursor: pointer;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 13px;
    }
    th,
    td {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid var(--border);
    }
    th {
      color: var(--muted);
      font-weight: 600;
    }
    .n {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    @media (max-width: 700px) {
      .item {
        grid-template-columns: 1fr;
      }
      .item::before,
      .node {
        display: none;
      }
      .when {
        align-items: flex-start;
        text-align: left;
        padding: 0 0 6px;
      }
      .facts {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
})
export class HorizonComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);

  protected readonly horizon = load(() => this.api.horizon());
  protected readonly leads = [0, 1, 3, 6, 12, 18, 24];
  protected readonly canEdit = computed(() => this.session.can('settings.manage'));
  protected readonly saving = signal(false);
  protected readonly open = signal(new Set<string>());
  protected readonly next = computed(() => (this.horizon.value()?.milestones ?? []).find((m) => m.status !== 'now') ?? null);

  protected count(status: Milestone['status']): number {
    return (this.horizon.value()?.milestones ?? []).filter((m) => m.status === status).length;
  }

  protected status(m: Milestone) {
    return STATUS[m.status];
  }

  protected source(s: string): string {
    return SOURCES[s] ?? s;
  }

  protected when(m: Milestone): string {
    if (m.days_until <= 0) return 'In force';
    const months = Math.round(m.days_until / 30.4);
    return months < 1 ? `In ${m.days_until} days` : months < 24 ? `In ${months} months` : `In ${Math.round(months / 12)} years`;
  }

  protected toggle(id: string): void {
    this.open.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  protected setLead(months: number): void {
    this.saving.set(true);
    this.api.setLeadTime(months).subscribe({
      next: (h) => {
        this.saving.set(false);
        this.horizon.set(h);
        this.toast.show(`Data collection now starts ${months} ${months === 1 ? 'month' : 'months'} before each requirement`);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.toast.show(toProblem(e).detail, 'error');
      },
    });
  }
}
