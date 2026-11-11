import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { DataSource, ImportHistoryRow, SyncSystem } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { ChipTone, Column, DataTableComponent, ErrorStateComponent, PageHeaderComponent, StatusChipComponent } from '../../shared/ui';
import { ImportHandoff } from '../import/import-handoff';

interface SystemCard {
  system: SyncSystem;
  name: string;
  kind: string;
  mark: string;
}

const SYSTEMS: SystemCard[] = [
  { system: 'erp', name: 'SAP S/4HANA', kind: 'ERP', mark: 'SAP' },
  { system: 'plm', name: 'Trace One', kind: 'PLM', mark: 'T1' },
];

/** Screen 18 (first part): connect a client's systems once, then sync with the saved mapping. */
@Component({
  selector: 'app-data-sources',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, PageHeaderComponent, StatusChipComponent, DataTableComponent, ErrorStateComponent],
  template: `
    <app-page-header title="Data sources" />

    @if (sources.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="sources.reload()" />
    } @else {
      <div class="systems">
        @for (card of cards(); track card.system) {
          <section class="card system" [class.connected]="!!card.source">
            <div class="head">
              <span class="mark" aria-hidden="true">{{ card.mark }}</span>
              <div class="title">
                <b>{{ card.name }}</b>
                <span class="muted">{{ card.kind }}</span>
              </div>
              <app-status-chip [tone]="tone(card.source)">{{ statusLabel(card.source) }}</app-status-chip>
            </div>

            @if (card.source; as s) {
              <dl class="facts">
                <div><dt>Last sync</dt><dd>{{ s.last_synced_at ? (s.last_synced_at | date: 'd MMM, HH:mm') : '—' }}</dd></div>
                <div><dt>Products</dt><dd>{{ s.last_result?.['imported_products'] ?? '—' }}</dd></div>
                <div><dt>Mapped columns</dt><dd>{{ s.mapped_columns || '—' }}</dd></div>
                <div><dt>Syncs</dt><dd>{{ s.syncs }}</dd></div>
              </dl>
              <div class="foot">
                <label class="switch">
                  <input type="checkbox" role="switch" [checked]="s.auto_approve" [disabled]="!s.mapped_columns"
                         (change)="toggle(s, $any($event.target).checked)" />
                  <span class="track" aria-hidden="true"></span>
                  Auto-approve
                </label>
                <button type="button" class="btn btn-primary" [disabled]="busy() === card.system" (click)="sync(s)">
                  {{ busy() === card.system ? 'Syncing…' : 'Sync now' }}
                </button>
              </div>
            } @else {
              <div class="foot">
                <span></span>
                <button type="button" class="btn btn-secondary" [disabled]="busy() === card.system" (click)="connect(card.system)">Connect</button>
              </div>
            }
          </section>
        }
      </div>

      <h2 class="section-title">Sync history</h2>
      <app-data-table [columns]="columns" [rows]="history.value() ?? []" [loading]="history.loading()" [trackBy]="byId">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('when') { <span class="muted">{{ row.created_at | date: 'd MMM, HH:mm' }}</span> }
            @case ('status') { <app-status-chip [tone]="historyTone(row.status)">{{ historyLabel(row.status) }}</app-status-chip> }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }
  `,
  styles: `
    .systems {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .system {
      display: flex;
      flex-direction: column;
      gap: 18px;
      margin: 0;
    }
    .head {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .mark {
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--accent);
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: 0.02em;
    }
    .system:not(.connected) .mark {
      background: var(--border);
      color: var(--muted);
    }
    .title {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin: 0;
    }
    .facts dt {
      font-size: 12px;
      color: var(--muted);
    }
    .facts dd {
      margin: 2px 0 0;
      font-weight: 600;
    }
    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-top: auto;
    }
    .switch {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      font-size: 13px;
    }
    .switch input {
      position: absolute;
      opacity: 0;
      width: 1px;
      height: 1px;
    }
    .track {
      position: relative;
      width: 34px;
      height: 20px;
      border-radius: 10px;
      background: var(--border);
      transition: background 0.15s;
    }
    .track::after {
      content: '';
      position: absolute;
      top: 2px;
      left: 2px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #fff;
      box-shadow: 0 1px 2px rgb(0 0 0 / 0.2);
      transition: transform 0.15s;
    }
    .switch input:checked + .track {
      background: var(--accent);
    }
    .switch input:checked + .track::after {
      transform: translateX(14px);
    }
    .switch input:focus-visible + .track {
      outline: 2px solid var(--accent);
      outline-offset: 2px;
    }
    .switch input:disabled + .track {
      opacity: 0.5;
    }
    .section-title {
      font-size: 15px;
      font-weight: 600;
      margin: 0 0 12px;
    }
    @media (max-width: 560px) {
      .facts {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `,
})
export class DataSourcesComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly handoff = inject(ImportHandoff);
  private readonly destroyRef = inject(DestroyRef);
  private poll?: Subscription;

  protected readonly sources = load(() => this.api.dataSources());
  protected readonly history = load(() => this.api.importHistory());
  protected readonly busy = signal<SyncSystem | null>(null);

  protected readonly cards = computed(() =>
    SYSTEMS.map((c) => ({ ...c, source: (this.sources.value() ?? []).find((s) => s.system === c.system) ?? null })),
  );

  protected readonly columns: Column<ImportHistoryRow>[] = [
    { key: 'when', label: 'When' },
    { key: 'source', label: 'Source', value: (r) => (r.source === 'csv' ? 'File' : r.source.toUpperCase()) },
    { key: 'filename', label: 'Name', value: (r) => r.filename },
    { key: 'rows', label: 'Rows', value: (r) => r.row_count, align: 'end' },
    { key: 'products', label: 'Products', value: (r) => r.imported_products ?? '—', align: 'end' },
    { key: 'status', label: 'Status' },
  ];

  protected readonly byId = (r: ImportHistoryRow) => r.id;

  constructor() {
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
  }

  protected tone(s: DataSource | null): ChipTone {
    if (!s) return 'neutral';
    return s.last_status === 'succeeded' ? 'green' : s.last_status === 'running' ? 'blue' : s.last_status === 'failed' ? 'red' : 'amber';
  }

  protected statusLabel(s: DataSource | null): string {
    if (!s) return 'Not connected';
    return s.last_status === 'succeeded' ? 'Synced' : s.last_status === 'running' ? 'Syncing' : s.last_status === 'failed' ? 'Failed' : 'Connected';
  }

  protected historyTone(status: ImportHistoryRow['status']): ChipTone {
    return status === 'imported' ? 'green' : status === 'approved' ? 'blue' : status === 'failed' ? 'red' : 'amber';
  }

  protected historyLabel(status: ImportHistoryRow['status']): string {
    return { imported: 'Imported', approved: 'Importing', failed: 'Failed', draft: 'Waiting for review' }[status];
  }

  protected connect(system: SyncSystem): void {
    this.busy.set(system);
    this.api.connectSource(system).subscribe({
      next: () => {
        this.busy.set(null);
        this.sources.reload();
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  protected toggle(s: DataSource, on: boolean): void {
    this.api.setAutoApprove(s.id, on).subscribe({
      next: (updated) => this.sources.set((this.sources.value() ?? []).map((x) => (x.id === updated.id ? updated : x))),
      error: (e: unknown) => this.fail(e),
    });
  }

  /** Auto-approved syncs import in the background; others open on the Import screen for review. */
  protected sync(s: DataSource): void {
    this.busy.set(s.system);
    this.api.syncSource(s.id).subscribe({
      next: ({ draft, job_id }) => {
        if (!job_id) {
          this.busy.set(null);
          this.handoff.draft.set(draft);
          void this.router.navigate(['/app/import']);
          return;
        }
        this.poll?.unsubscribe();
        this.poll = interval(500)
          .pipe(
            switchMap(() => this.api.job(job_id)),
            takeWhile((j) => j.status === 'queued' || j.status === 'running', true),
          )
          .subscribe({
            next: (j) => {
              if (j.status === 'succeeded') {
                this.toast.show(`${s.name}: ${j.result?.['imported_products'] ?? 0} products synced`);
              } else if (j.status === 'failed') {
                this.toast.show(j.error ?? 'Sync failed', 'error');
              } else {
                return;
              }
              this.busy.set(null);
              this.sources.reload();
              this.history.reload();
            },
            error: (e: unknown) => this.fail(e),
          });
      },
      error: (e: unknown) => this.fail(e),
    });
  }

  private fail(e: unknown): void {
    this.busy.set(null);
    this.toast.show(toProblem(e).detail, 'error');
  }
}
