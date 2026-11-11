import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GapRule, ModuleId, RuleCheck, Severity } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { ToastService } from '../../core/services/toast.service';
import {
  Column,
  DataTableComponent,
  DialogComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  FormFieldComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';

/** Screen 6: SuperAdmin keeps the rules that find gaps in client data. */
@Component({
  selector: 'app-gap-rules',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    DialogComponent,
    FormFieldComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header title="Gap rules">
      <button type="button" class="btn btn-primary" (click)="newOpen.set(true)">New rule</button>
    </app-page-header>

    @if (rules.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="rules.reload()" />
    } @else if (!rules.loading() && !(rules.value() ?? []).length) {
      <app-empty-state title="No rules">
        <button type="button" class="btn btn-primary" (click)="newOpen.set(true)">New rule</button>
      </app-empty-state>
    } @else {
      <app-data-table [columns]="columns" [rows]="rules.value() ?? []" [loading]="rules.loading()" [trackBy]="byId">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('id') { <span class="mono">{{ row.id }}</span> }
            @case ('name') { <b>{{ row.name }}</b> }
            @case ('severity') {
              <app-status-chip [tone]="row.severity === 'blocker' ? 'red' : 'amber'">{{ cap(row.severity) }}</app-status-chip>
            }
            @case ('modules') {
              <span class="chips">@for (m of row.modules; track m) { <app-status-chip tone="blue">{{ m }}</app-status-chip> }</span>
            }
            @case ('active') {
              <label class="switch" [attr.aria-label]="(row.active ? 'Turn off ' : 'Turn on ') + row.id">
                <input type="checkbox" [checked]="row.active" (change)="toggle(row)" />
                <span class="track" aria-hidden="true"></span>
              </label>
            }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }

    <app-dialog [open]="newOpen()" title="New rule" [width]="560" (closed)="newOpen.set(false)">
      <div class="form-grid">
        <app-form-field label="Name" for="r-name" class="wide" [error]="problem()?.fields['name']">
          <input id="r-name" [(ngModel)]="draft.name" />
        </app-form-field>
        <app-form-field label="Field" for="r-field" class="wide" [error]="problem()?.fields['field']">
          <select id="r-field" [(ngModel)]="draft.field">
            @for (f of fields(); track f.key) { <option [value]="f.key">{{ f.dp }} · {{ f.label }}</option> }
          </select>
        </app-form-field>
        <app-form-field label="Check" for="r-check">
          <select id="r-check" [(ngModel)]="draft.kind">
            <option value="missing">Value is missing</option>
            <option value="in">Value is one of</option>
          </select>
        </app-form-field>
        <app-form-field label="Severity" for="r-sev">
          <select id="r-sev" [(ngModel)]="draft.severity">
            <option value="blocker">Blocker</option>
            <option value="warning">Warning</option>
          </select>
        </app-form-field>
        @if (draft.kind === 'in') {
          <app-form-field label="Values (comma separated)" for="r-values" class="wide">
            <input id="r-values" [(ngModel)]="draft.values" />
          </app-form-field>
        }
        <app-form-field label="Estimate" for="r-estimate">
          <select id="r-estimate" [(ngModel)]="draft.estimate">
            <option value="">Needs real data</option>
            <option value="similar_average">Average of similar components</option>
            <option value="fixed">Fixed value</option>
          </select>
        </app-form-field>
        @if (draft.estimate === 'fixed') {
          <app-form-field label="Estimated value" for="r-est-value">
            <input id="r-est-value" [(ngModel)]="draft.estimateValue" />
          </app-form-field>
        }
      </div>
      <div class="section-label">Modules</div>
      <div class="choice-grid">
        @for (m of modules; track m) {
          <label class="choice"><input type="checkbox" [(ngModel)]="draft.modules[m]" />{{ m }}</label>
        }
      </div>
      <ng-container actions>
        <button type="button" class="btn btn-secondary" (click)="newOpen.set(false)">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="!draft.name.trim()" (click)="create()">Add rule</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
  `,
})
export class GapRulesComponent {
  private readonly api = inject(PlatformApi);
  private readonly toast = inject(ToastService);

  protected readonly rules = load(() => this.api.gapRules());
  protected readonly newOpen = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  private readonly catalogue = load(() => this.api.fields());
  /** Fields a rule can check: product, passport and component fields that answer a data point. */
  protected readonly fields = computed(() =>
    Object.entries(this.catalogue.value() ?? {})
      .filter(([, f]) => !!f.dp && ['Product', 'Passport', 'Component'].includes(f.level))
      .map(([key, f]) => ({ key, label: f.label, dp: f.dp as string })),
  );
  protected readonly modules: ModuleId[] = ['EPR', 'PPWR', 'DPP', 'LCA'];
  protected draft = blankDraft();

  protected readonly columns: Column<GapRule>[] = [
    { key: 'id', label: 'Rule' },
    { key: 'name', label: 'Name' },
    { key: 'dp', label: 'Data point', value: (r) => r.data_point },
    { key: 'check', label: 'Check', value: (r) => describe(r.check) },
    { key: 'severity', label: 'Severity' },
    { key: 'estimate', label: 'Estimate', value: (r) => estimateLabel(r.estimate) },
    { key: 'modules', label: 'Modules' },
    { key: 'active', label: 'On' },
  ];

  protected readonly byId = (r: GapRule) => r.id;
  protected cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  protected toggle(rule: GapRule): void {
    this.api.updateGapRule(rule.id, { active: !rule.active }).subscribe({
      next: (updated) => {
        this.rules.set((this.rules.value() ?? []).map((r) => (r.id === updated.id ? updated : r)));
        this.toast.show(`${updated.id} ${updated.active ? 'on' : 'off'}`);
      },
      error: (e: unknown) => this.toast.show(toProblem(e).detail, 'error'),
    });
  }

  protected create(): void {
    const field = this.fields().find((f) => f.key === this.draft.field);
    if (!field) return;
    const check: RuleCheck =
      this.draft.kind === 'in'
        ? { kind: 'in', values: this.draft.values.split(',').map((v) => v.trim()).filter(Boolean) }
        : { kind: 'missing' };
    this.problem.set(null);
    this.api
      .createGapRule({
        name: this.draft.name.trim(),
        field: field.key,
        data_point: field.dp,
        check,
        severity: this.draft.severity,
        modules: this.modules.filter((m) => this.draft.modules[m]),
        estimate: this.draft.estimate
          ? { method: this.draft.estimate, value: this.draft.estimate === 'fixed' ? this.draft.estimateValue : null }
          : null,
      })
      .subscribe({
        next: (rule) => {
          this.rules.set([...(this.rules.value() ?? []), rule]);
          this.newOpen.set(false);
          this.draft = blankDraft();
          this.toast.show(`${rule.id} added`);
        },
        error: (e: unknown) => this.problem.set(toProblem(e)),
      });
  }
}

function blankDraft() {
  return {
    name: '',
    field: 'gtin',
    kind: 'missing' as 'missing' | 'in',
    values: '',
    severity: 'blocker' as Severity,
    estimate: '' as '' | 'similar_average' | 'fixed',
    estimateValue: '',
    modules: { EPR: true, PPWR: false, DPP: false, LCA: false } as Record<ModuleId, boolean>,
  };
}

export function estimateLabel(e: GapRule['estimate']): string {
  if (!e) return 'Needs data';
  return e.method === 'fixed' ? `Fixed: ${e.value ?? ''}` : 'Similar average';
}

export function describe(check: RuleCheck): string {
  switch (check.kind) {
    case 'missing':
      return 'Missing';
    case 'in':
      return `Is ${(check.values ?? []).join(' or ')}`;
    case 'certificate_missing':
      return 'Recycled content without certificate';
    case 'pfas_missing':
      return 'Food contact without declaration';
  }
}
