import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Subscription, interval, switchMap, takeWhile } from 'rxjs';
import { ImportDraft, ImportPreview, JobStatus } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { PageHeaderComponent, StatusChipComponent } from '../../shared/ui';
import { parseCsv, toCsv } from './csv';

type Step = 'upload' | 'map' | 'review' | 'run';

const TEMPLATE = [
  ['sku', 'product_name', 'brand', 'gtin', 'component_name', 'packaging_level', 'units_per_pack', 'material', 'polymer', 'weight_g', 'recycled_content_pct'],
  ['HLA-KET-250', 'Classic Tomato Ketchup 250g squeezy', 'HLA Classic', '5790001000059', 'Squeezy bottle', 'Primary', 1, 'Plastic', 'PP', 18, 0],
  ['HLA-KET-250', 'Classic Tomato Ketchup 250g squeezy', 'HLA Classic', '5790001000059', 'Flip-top cap', 'Primary', 1, 'Plastic', 'PP', 4, 0],
  ['HLA-KET-250', 'Classic Tomato Ketchup 250g squeezy', 'HLA Classic', '5790001000059', '24-bottle tray', 'Transit', 24, 'Paper/board', 'n/a', 160, 85],
];

/** Screen 5: bring products and packaging in from a spreadsheet. */
@Component({
  selector: 'app-import',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink, PageHeaderComponent, StatusChipComponent],
  template: `
    <app-page-header title="Import">
      <button type="button" class="btn btn-secondary" (click)="downloadTemplate()">Download template</button>
    </app-page-header>

    <ol class="stepper" aria-label="Import steps">
      @for (s of steps; track s.id; let i = $index) {
        <li [class.on]="stepIndex() >= i" [attr.aria-current]="step() === s.id ? 'step' : null">
          <span class="num">{{ i + 1 }}</span>{{ s.label }}
        </li>
      }
    </ol>

    @if (problem(); as p) {
      <div class="card alert" role="alert">{{ p.detail }}</div>
    }

    @switch (step()) {
      @case ('upload') {
        <label class="drop" [class.over]="dragging()" (dragover)="$event.preventDefault(); dragging.set(true)"
               (dragleave)="dragging.set(false)" (drop)="onDrop($event)">
          <input type="file" accept=".csv,text/csv" (change)="onFile($event)" />
          <svg width="28" height="28" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" aria-hidden="true">
            <path d="M8 10.5V2.5M5 5.5l3-3 3 3M2.5 10.5v3h11v-3" />
          </svg>
          <b>Drop a CSV file or choose one</b>
        </label>
      }
      @case ('map') {
        @if (draft(); as d) {
          <section class="card">
            <h2 class="card-title">{{ d.filename }} · {{ d.row_count }} rows</h2>
            <div class="map">
              @for (col of d.columns; track col) {
                <div class="map-row">
                  <span class="mono">{{ col }}</span>
                  <span class="arrow" aria-hidden="true">→</span>
                  <select [attr.aria-label]="'Field for ' + col" [ngModel]="mapping()[col]" (ngModelChange)="setMap(col, $event)">
                    <option [ngValue]="null">Skip</option>
                    @for (t of d.targets; track t.key) {
                      <option [ngValue]="t.key">{{ t.label }}{{ t.dp ? ' · ' + t.dp : '' }}</option>
                    }
                  </select>
                </div>
              }
            </div>
            @if (missingRequired().length) {
              <p class="error-text">Map {{ missingRequired().join(', ') }}</p>
            }
          </section>
          <div class="actions">
            <button type="button" class="btn btn-secondary" (click)="restart()">Start over</button>
            <button type="button" class="btn btn-primary" [disabled]="busy() || missingRequired().length" (click)="review()">Review</button>
          </div>
        }
      }
      @case ('review') {
        @if (preview(); as p) {
          <div class="kpis">
            <div class="kpi dark"><div class="kpi-label">Valid rows</div><div class="kpi-value">{{ p.valid_rows }}</div></div>
            <div class="kpi"><div class="kpi-label">Rows with errors</div><div class="kpi-value">{{ p.invalid_rows }}</div></div>
            <div class="kpi"><div class="kpi-label">New products</div><div class="kpi-value">{{ p.new_products }}</div></div>
            <div class="kpi"><div class="kpi-label">Updated products</div><div class="kpi-value">{{ p.updated_products }}</div></div>
          </div>
          @if (p.issues.length) {
            <section class="card">
              <h2 class="card-title">Rows that will be skipped</h2>
              @for (i of p.issues; track $index) {
                <div class="issue"><span class="mono">Row {{ i.row }}</span><span>{{ i.column }}</span><app-status-chip tone="red">{{ i.message }}</app-status-chip></div>
              }
            </section>
          }
          <div class="actions">
            <button type="button" class="btn btn-secondary" (click)="step.set('map')">Back</button>
            <button type="button" class="btn btn-primary" [disabled]="busy() || !p.valid_rows" (click)="approve()">Approve import</button>
          </div>
        }
      }
      @case ('run') {
        @if (job(); as j) {
          <section class="card run">
            <div class="run-head">
              <b>{{ j.status === 'succeeded' ? 'Import complete' : j.status === 'failed' ? 'Import failed' : 'Importing' }}</b>
              <span class="muted">{{ j.progress }}%</span>
            </div>
            <div class="bar" [class.red]="j.status === 'failed'"><span [style.width.%]="j.progress"></span></div>
            @if (j.status === 'succeeded') {
              <p>{{ j.result?.['imported_products'] }} products imported.</p>
              <div class="actions">
                <button type="button" class="btn btn-secondary" (click)="restart()">Import another file</button>
                <a class="btn btn-primary" routerLink="/app/products">Open products</a>
              </div>
            }
            @if (j.error) { <p class="error-text">{{ j.error }}</p> }
          </section>
        }
      }
    }
  `,
  styles: `
    .stepper {
      display: flex;
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0 0 18px;
    }
    .stepper li {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px 8px 8px;
      border-radius: 99px;
      background: var(--card);
      border: 1px solid var(--border);
      color: var(--muted);
      font-weight: 600;
    }
    .stepper li.on {
      color: var(--navy-700);
      border-color: #c9d6ea;
      background: #e9eff8;
    }
    .num {
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: var(--border);
      font-size: 12px;
    }
    .stepper li.on .num {
      background: var(--navy-700);
      color: #fff;
    }
    .drop {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 240px;
      border: 2px dashed var(--border-2);
      border-radius: var(--r-lg);
      background: var(--card);
      color: var(--muted);
      cursor: pointer;
    }
    .drop.over,
    .drop:hover {
      border-color: var(--navy-700);
      color: var(--navy-700);
    }
    .drop b {
      color: var(--ink);
    }
    .drop input {
      position: absolute;
      inset: 0;
      opacity: 0;
      cursor: pointer;
    }
    .drop:focus-within {
      outline: 2px solid var(--navy-700);
      outline-offset: 2px;
    }
    .map {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .map-row {
      display: grid;
      grid-template-columns: 1fr 24px 1.2fr;
      align-items: center;
      gap: 10px;
      padding: 6px 0;
      border-bottom: 1px solid var(--border);
    }
    .map-row select {
      height: 34px;
      padding: 0 8px;
      border: 1px solid var(--border-2);
      border-radius: 8px;
      font: inherit;
      background: var(--card);
    }
    .arrow {
      color: var(--muted);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 16px;
    }
    .issue {
      display: grid;
      grid-template-columns: 90px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
    }
    .alert {
      margin-bottom: 14px;
      color: var(--red-ink);
      background: var(--red-bg);
      border-color: #f3c9ca;
    }
    .run {
      max-width: 640px;
    }
    .run-head {
      display: flex;
      justify-content: space-between;
      margin-bottom: 10px;
    }
  `,
})
export class ImportComponent {
  private readonly api = inject(PlatformApi);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly steps: { id: Step; label: string }[] = [
    { id: 'upload', label: 'Upload' },
    { id: 'map', label: 'Map columns' },
    { id: 'review', label: 'Review' },
    { id: 'run', label: 'Import' },
  ];
  protected readonly step = signal<Step>('upload');
  protected readonly dragging = signal(false);
  protected readonly busy = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected readonly draft = signal<ImportDraft | null>(null);
  protected readonly mapping = signal<Record<string, string | null>>({});
  protected readonly preview = signal<ImportPreview | null>(null);
  protected readonly job = signal<JobStatus | null>(null);
  private poll?: Subscription;

  constructor() {
    this.destroyRef.onDestroy(() => this.poll?.unsubscribe());
  }

  protected stepIndex(): number {
    return this.steps.findIndex((s) => s.id === this.step());
  }

  protected missingRequired(): string[] {
    const d = this.draft();
    if (!d) return [];
    const mapped = new Set(Object.values(this.mapping()));
    return d.targets.filter((t) => t.required && !mapped.has(t.key)).map((t) => t.label);
  }

  protected onDrop(e: DragEvent): void {
    e.preventDefault();
    this.dragging.set(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) void this.read(file);
  }

  protected onFile(e: Event): void {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) void this.read(file);
  }

  private async read(file: File): Promise<void> {
    this.problem.set(null);
    const rows = parseCsv(await file.text());
    if (rows.length < 2) {
      this.problem.set({ status: 422, title: 'Empty file', detail: 'The file needs a header row and at least one data row.', fields: {} });
      return;
    }
    const [columns, ...data] = rows;
    this.busy.set(true);
    this.api.startImport({ filename: file.name, columns, rows: data }).subscribe({
      next: (d) => {
        this.busy.set(false);
        this.draft.set(d);
        this.mapping.set({ ...d.suggested_mapping });
        this.step.set('map');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected setMap(col: string, key: string | null): void {
    this.mapping.update((m) => ({ ...m, [col]: key }));
  }

  protected review(): void {
    const d = this.draft();
    if (!d) return;
    this.busy.set(true);
    this.api.mapImport(d.id, this.mapping()).subscribe({
      next: (p) => {
        this.busy.set(false);
        this.preview.set(p);
        this.step.set('review');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected approve(): void {
    const d = this.draft();
    if (!d) return;
    this.busy.set(true);
    this.api.approveImport(d.id).subscribe({
      next: ({ job_id }) => {
        this.busy.set(false);
        this.step.set('run');
        this.job.set({ id: job_id, kind: 'ingestion.import', status: 'queued', progress: 0, result: null, error: null });
        this.poll = interval(400)
          .pipe(
            switchMap(() => this.api.job(job_id)),
            takeWhile((j) => j.status === 'queued' || j.status === 'running', true),
          )
          .subscribe({ next: (j) => this.job.set(j), error: (err: unknown) => this.fail(err) });
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  protected restart(): void {
    this.poll?.unsubscribe();
    this.step.set('upload');
    this.draft.set(null);
    this.preview.set(null);
    this.job.set(null);
    this.problem.set(null);
  }

  protected downloadTemplate(): void {
    const blob = new Blob([toCsv(TEMPLATE)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products-import-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.problem.set(toProblem(err));
  }
}
