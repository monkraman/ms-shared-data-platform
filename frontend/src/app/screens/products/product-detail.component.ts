import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { Component as PackComponent, FieldValue, Product, ProductHistory } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import { SessionService } from '../../core/session/session.service';
import { DrawerComponent, EmptyStateComponent, ErrorStateComponent, StatusChipComponent } from '../../shared/ui';
import { FieldEditorComponent } from './field-editor.component';
import { RAM_TONE, STATUS_LABEL, STATUS_TONE, gradeTone } from './products.component';

type Editing = { kind: 'product' } | { kind: 'component'; code: string | null };

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
  imports: [RouterLink, CurrencyPipe, DecimalPipe, DatePipe, StatusChipComponent, ErrorStateComponent, EmptyStateComponent, DrawerComponent, FieldEditorComponent],
  template: `
    <nav class="crumbs" aria-label="Breadcrumb"><a routerLink="/app/products">SKU library</a><span>/</span><span>{{ sku() }}</span></nav>

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
          <div class="actions">
            <app-status-chip [tone]="statusTone[p.status]" [attr.title]="p.status_reasons.join('; ')">{{ statusLabel[p.status] }}</app-status-chip>
            @if (p.open_gaps) {
              <a class="btn btn-secondary" routerLink="/app/gaps">{{ p.open_gaps }} open gaps</a>
            }
            @if (canEdit()) {
              <button type="button" class="btn btn-primary" (click)="edit({ kind: 'product' }, p)">Edit</button>
            }
          </div>
        </header>

        <div class="kpis">
          <div class="kpi dark"><div class="kpi-label">Packaging per unit</div><div class="kpi-value">{{ p.packaging_g_per_unit | number: '1.0-1' }} g</div></div>
          @for (f of p.fees; track f.regime) {
            <div class="kpi"><div class="kpi-label">{{ f.name }} {{ f.year }}</div><div class="kpi-value">{{ f.fee | currency: f.currency : 'symbol' : '1.0-0' }}</div></div>
          }
          <div class="kpi"><div class="kpi-label">RAM</div><div class="kpi-value">{{ p.ram ?? '—' }}</div></div>
          <div class="kpi" [attr.title]="p.grade_reason">
            <div class="kpi-label">PPWR grade</div>
            <div class="kpi-value">{{ p.grade ?? '—' }}@if (p.recyclable_pct !== null) {<small> {{ p.recyclable_pct }}%</small>}</div>
          </div>
          <div class="kpi"><div class="kpi-label">Data complete</div><div class="kpi-value">{{ p.completeness_pct }}%</div></div>
        </div>

        @if (p.status_reasons.length) {
          <div class="reasons">
            @for (r of p.status_reasons; track r) { <app-status-chip [tone]="statusTone[p.status]">{{ r }}</app-status-chip> }
          </div>
        }

        <section class="card">
          <div class="card-head">
            <h2 class="card-title">Packaging</h2>
            @if (canEdit()) {
              <button type="button" class="btn btn-ghost" (click)="edit({ kind: 'component', code: null }, p)">Add component</button>
            }
          </div>
          @for (level of levels(p); track level.name) {
            <div class="level">
              <div class="level-name">{{ level.name }}</div>
              @for (c of level.items; track c.id) {
                <div class="comp" [class.editable]="canEdit()" [attr.role]="canEdit() ? 'button' : null" [attr.tabindex]="canEdit() ? 0 : null"
                     (click)="canEdit() && edit({ kind: 'component', code: c.id }, p)" (keydown.enter)="canEdit() && edit({ kind: 'component', code: c.id }, p)">
                  <div class="comp-main">
                    <b>{{ c.name }}</b>
                    <span class="chips">
                      <app-status-chip>{{ c.material }}</app-status-chip>
                      @if (c.polymer && c.polymer !== 'n/a') { <app-status-chip>{{ c.polymer }}</app-status-chip> }
                      @if (c.assessment.ram; as ram) {
                        <app-status-chip [tone]="ramTone[ram]" [attr.title]="c.assessment.ram_reason">RAM {{ ram }}</app-status-chip>
                      }
                      @if (c.assessment.grade; as g) {
                        <app-status-chip [tone]="gradeTone(g)" [attr.title]="c.assessment.grade_reason">PPWR {{ g }}</app-status-chip>
                      }
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
              <div class="row"><span>{{ s.period }} · {{ s.market || 'All markets' }} · {{ s.channel }}</span><b>{{ s.units_placed | number }}</b></div>
            } @empty {
              <app-empty-state title="No sales data" />
            }
          </section>
          <section class="card">
            <h2 class="card-title">Recycled plastic, 2030</h2>
            @for (u of p.recycled_content; track u.level) {
              <div class="row" [attr.title]="u.basis">
                <span>{{ u.level }}</span>
                <span class="chips">
                  <span>{{ u.recycled_pct ?? '—' }}% / {{ u.target_pct }}%</span>
                  <app-status-chip [tone]="u.met === null ? 'neutral' : u.met ? 'green' : 'red'">
                    {{ u.exempt ? 'Exempt' : u.met === null ? 'Unknown' : u.met ? 'Met' : 'Below' }}
                  </app-status-chip>
                </span>
              </div>
            } @empty {
              <app-empty-state title="No plastic packaging" />
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

        <section class="card history">
          <h2 class="card-title">History</h2>
          @for (e of history(); track $index) {
            @for (c of e.changes; track $index) {
              <div class="change">
                <span class="muted when">{{ e.at | date: 'd MMM, HH:mm' }}</span>
                <span><b>{{ c.label }}</b>@if (c.component) { <span class="muted"> · {{ componentName(p, c.component) }}</span> }</span>
                <span class="diff"><s class="muted">{{ c.before || '—' }}</s> → <b>{{ c.after || '—' }}</b></span>
                <span class="muted who">{{ e.by }}</span>
              </div>
            }
          } @empty {
            <p class="muted">No changes yet</p>
          }
        </section>

        <app-drawer [open]="!!editing()" [title]="drawerTitle(p)" [width]="560" (closed)="editing.set(null)">
          @if (editing() && catalogue.value(); as cat) {
            <app-field-editor [keys]="editKeys()" [catalogue]="cat" [stored]="editStored(p)" [draft]="draft" [errors]="errors()" />
          }
          <ng-container actions>
            @if (editing(); as ed) {
              @if (ed.kind === 'component' && ed.code) {
                <button type="button" class="btn btn-ghost danger" [disabled]="saving()" (click)="removeComponent(p, ed.code)">Remove component</button>
              }
              <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save(p)">Save</button>
            }
          </ng-container>
        </app-drawer>
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
    .actions {
      display: flex;
      gap: 8px;
    }
    .card-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .comp.editable {
      cursor: pointer;
    }
    .comp.editable:hover,
    .comp.editable:focus-visible {
      border-color: var(--accent);
    }
    .history {
      margin-top: 14px;
    }
    .change {
      display: grid;
      grid-template-columns: 110px 1.2fr 1.5fr 1fr;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid var(--border);
      font-size: 13px;
    }
    .change .who {
      text-align: right;
      overflow-wrap: anywhere;
    }
    .danger {
      color: #c0211f;
      margin-right: auto;
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
    .reasons {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: -4px 0 14px;
    }
    .two {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
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
  private readonly toast = inject(ToastService);
  private readonly session = inject(SessionService);
  protected readonly canEdit = computed(() => this.session.can('products.manage'));

  /** Route parameter `:sku`. */
  readonly sku = input.required<string>();
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusTone = STATUS_TONE;
  protected readonly ramTone = RAM_TONE;
  protected readonly gradeTone = gradeTone;
  protected readonly catalogue = load(() => this.api.fields());
  protected readonly editing = signal<Editing | null>(null);
  protected readonly errors = signal<Record<string, string>>({});
  protected readonly saving = signal(false);
  protected draft: Record<string, string> = {};
  private original: Record<string, string> = {};
  protected readonly history = toSignal(
    toObservable(computed(() => ({ sku: this.sku(), tick: this.tick() }))).pipe(
      switchMap(({ sku }) => this.api.productHistory(sku).pipe(catchError(() => of<ProductHistory[]>([])))),
    ),
    { initialValue: [] as ProductHistory[] },
  );
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


  protected entries(rec: Record<string, FieldValue>): [string, FieldValue][] {
    return Object.entries(rec);
  }

  protected label(key: string): string {
    return this.catalogue.value()?.[key]?.label ?? key;
  }


  /** Catalogue keys of the level being edited, stored ones first. */
  protected editKeys(): string[] {
    const cat = this.catalogue.value() ?? {};
    const levels = this.editing()?.kind === 'product' ? ['Product', 'Passport'] : ['Component'];
    return Object.keys(cat).filter((k) => levels.includes(cat[k].level));
  }

  protected editStored(p: Product): Record<string, FieldValue> {
    const ed = this.editing();
    if (!ed) return {};
    if (ed.kind === 'product') return { ...p.fields, ...p.passport };
    return p.components.find((c) => c.id === ed.code)?.fields ?? {};
  }

  protected drawerTitle(p: Product): string {
    const ed = this.editing();
    if (!ed) return '';
    if (ed.kind === 'product') return `Edit ${p.name}`;
    return ed.code ? `Edit ${this.componentName(p, ed.code)}` : 'Add component';
  }

  protected componentName(p: Product, code: string): string {
    return p.components.find((c) => c.id === code)?.name ?? code;
  }

  protected edit(target: Editing, p: Product): void {
    this.editing.set(target);
    this.errors.set({});
    const stored = this.editStored(p);
    this.draft = Object.fromEntries(Object.entries(stored).map(([k, v]) => [k, v.value]));
    this.original = { ...this.draft };
  }

  protected save(p: Product): void {
    const ed = this.editing();
    if (!ed) return;
    const changed = Object.fromEntries(
      Object.entries(this.draft).filter(([k, v]) => (v ?? '') !== (this.original[k] ?? '')),
    );
    if (!Object.keys(changed).length) {
      this.editing.set(null);
      return;
    }
    const request =
      ed.kind === 'product'
        ? this.api.editProduct(p.sku, changed)
        : ed.code
          ? this.api.editComponent(p.sku, ed.code, changed)
          : this.api.addComponent(p.sku, changed);
    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.show('Saved');
        this.reload();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        const problem = toProblem(e);
        this.errors.set(problem.fields);
        if (!Object.keys(problem.fields).length) this.toast.show(problem.detail, 'error');
      },
    });
  }

  protected removeComponent(p: Product, code: string): void {
    this.saving.set(true);
    this.api.removeComponent(p.sku, code).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.toast.show('Component removed');
        this.reload();
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.toast.show(toProblem(e).detail, 'error');
      },
    });
  }
}
