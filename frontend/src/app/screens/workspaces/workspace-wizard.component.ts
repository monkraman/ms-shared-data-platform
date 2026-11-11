import { ChangeDetectionStrategy, Component, WritableSignal, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LegalEntity, ModuleId, Workspace } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { DialogComponent, FormFieldComponent } from '../../shared/ui';

const STEPS = ['Organisation', 'Legal entities', 'Countries and modules', 'First admin'] as const;

/** Screen 2: create a workspace in four steps. Validation matches the API's rules. */
@Component({
  selector: 'app-workspace-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogComponent, FormFieldComponent],
  template: `
    <app-dialog [open]="open()" [title]="steps[step()]" (closed)="close()">
      <div class="steps" aria-hidden="true">
        @for (s of steps; track s; let i = $index) { <span [class.done]="i <= step()"></span> }
      </div>

      @switch (step()) {
        @case (0) {
          <div class="form-grid">
            <app-form-field label="Name" for="ws-name" class="wide" [error]="err('name')">
              <input id="ws-name" [ngModel]="name()" (ngModelChange)="setName($event)" autocomplete="organization" />
            </app-form-field>
            <app-form-field label="Slug" for="ws-slug" [error]="err('slug')">
              <input id="ws-slug" class="mono" [ngModel]="slug()" (ngModelChange)="slug.set($event); slugEdited = true" />
            </app-form-field>
            <app-form-field label="Sector" for="ws-sector">
              <select id="ws-sector" [ngModel]="sector()" (ngModelChange)="sector.set($event)">
                @for (s of sectors; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </app-form-field>
            <app-form-field label="Brand colour" for="ws-color">
              <input id="ws-color" type="color" [ngModel]="color()" (ngModelChange)="color.set($event)" />
            </app-form-field>
          </div>
        }
        @case (1) {
          @for (le of entities(); track $index; let i = $index) {
            <div class="form-grid entity">
              <app-form-field label="Legal name" [for]="'le-name-' + i" class="wide">
                <input [id]="'le-name-' + i" [(ngModel)]="le.name" />
              </app-form-field>
              <app-form-field label="Country" [for]="'le-country-' + i">
                <select [id]="'le-country-' + i" [(ngModel)]="le.country">
                  @for (c of countries.value() ?? []; track c.code) { <option [value]="c.code">{{ c.name }}</option> }
                </select>
              </app-form-field>
              <app-form-field label="Registration number" [for]="'le-reg-' + i">
                <input [id]="'le-reg-' + i" [(ngModel)]="le.registration_number" />
              </app-form-field>
            </div>
          }
          <button type="button" class="btn btn-ghost" (click)="addEntity()">Add legal entity</button>
          @if (err('legal_entities'); as e) { <p class="error-text">{{ e }}</p> }
        }
        @case (2) {
          <div class="section-label">Countries</div>
          <div class="choice-grid">
            @for (c of countries.value() ?? []; track c.code) {
              <label class="choice">
                <input type="checkbox" [checked]="picked().has(c.code)" (change)="toggle(picked, c.code)" />
                {{ c.name }}
              </label>
            }
          </div>
          @if (err('countries'); as e) { <p class="error-text">{{ e }}</p> }
          <div class="section-label">Modules</div>
          <div class="choice-grid">
            @for (m of availableModules(); track m.id) {
              <label class="choice">
                <input type="checkbox" [checked]="mods().has(m.id)" (change)="toggle(mods, m.id)" />
                {{ m.id }}
              </label>
            }
          </div>
          @if (err('modules'); as e) { <p class="error-text">{{ e }}</p> }
        }
        @case (3) {
          <div class="form-grid">
            <app-form-field label="Full name" for="adm-name">
              <input id="adm-name" [ngModel]="adminName()" (ngModelChange)="adminName.set($event)" autocomplete="name" />
            </app-form-field>
            <app-form-field label="Work email" for="adm-email" [error]="err('email')">
              <input id="adm-email" type="email" [ngModel]="adminEmail()" (ngModelChange)="adminEmail.set($event)" autocomplete="email" />
            </app-form-field>
          </div>
        }
      }

      <ng-container actions>
        @if (step() > 0) {
          <button type="button" class="btn btn-secondary" (click)="step.set(step() - 1)">Back</button>
        }
        @if (step() < steps.length - 1) {
          <button type="button" class="btn btn-primary" [disabled]="!canContinue()" (click)="step.set(step() + 1)">Continue</button>
        } @else {
          <button type="button" class="btn btn-primary" [disabled]="saving() || !canContinue()" (click)="submit()">Create workspace</button>
        }
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .entity {
      padding-bottom: 14px;
      margin-bottom: 14px;
      border-bottom: 1px solid var(--border);
    }
    input[type='color'] {
      padding: 2px 4px;
      height: 36px;
      width: 64px;
    }
  `,
})
export class WorkspaceWizardComponent {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly created = output<Workspace>();

  protected readonly steps = STEPS;
  protected readonly sectors = ['Food', 'Beverages', 'Personal care', 'Household', 'Retail', 'Other'];
  protected readonly countries = load(() => this.api.countries());
  private readonly modules = load(() => this.api.modules());

  protected readonly step = signal(0);
  protected readonly name = signal('');
  protected readonly slug = signal('');
  protected slugEdited = false;
  protected readonly sector = signal('Food');
  protected readonly color = signal('#1b3c6d');
  protected readonly entities = signal<LegalEntity[]>([{ name: '', country: 'DK', registration_number: '' }]);
  protected readonly picked = signal(new Set<string>());
  protected readonly mods = signal(new Set<string>());
  protected readonly adminName = signal('');
  protected readonly adminEmail = signal('');
  protected readonly saving = signal(false);
  private readonly problem = signal<Problem | null>(null);

  /** PPWR and DPP are EU rules: offered only when an EU country is chosen. */
  protected readonly availableModules = computed(() => {
    const eu = (this.countries.value() ?? []).some((c) => c.eu && this.picked().has(c.code));
    return (this.modules.value() ?? []).filter((m) => eu || !['PPWR', 'DPP'].includes(m.id));
  });

  protected readonly canContinue = computed(() => {
    switch (this.step()) {
      case 0:
        return !!this.name().trim() && /^[a-z0-9-]{3,40}$/.test(this.slug());
      case 1:
        return this.entities().some((e) => e.name.trim());
      case 2:
        return this.picked().size > 0 && this.mods().size > 0;
      default:
        return !!this.adminName().trim() && /^\S+@\S+\.\S+$/.test(this.adminEmail());
    }
  });

  protected err(field: string): string | undefined {
    return this.problem()?.fields[field];
  }

  protected setName(value: string): void {
    this.name.set(value);
    if (!this.slugEdited) {
      this.slug.set(value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40));
    }
  }

  protected addEntity(): void {
    this.entities.update((list) => [...list, { name: '', country: 'DK', registration_number: '' }]);
  }

  protected toggle(set: WritableSignal<Set<string>>, key: string): void {
    set.update((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  protected submit(): void {
    this.saving.set(true);
    this.problem.set(null);
    this.api
      .createWorkspace({
        name: this.name(),
        slug: this.slug(),
        sector: this.sector(),
        brand_color: this.color(),
        legal_entities: this.entities().filter((e) => e.name.trim()),
        countries: [...this.picked()],
        modules: [...this.mods()].filter((m) => this.availableModules().some((a) => a.id === m)) as ModuleId[],
        admin: { full_name: this.adminName(), email: this.adminEmail() },
      })
      .subscribe({
        next: (ws) => {
          this.saving.set(false);
          this.created.emit(ws);
          this.reset();
        },
        error: (e: unknown) => {
          const problem = toProblem(e);
          this.saving.set(false);
          this.problem.set(problem);
          // Go back to the step that has the error.
          const field = Object.keys(problem.fields)[0];
          const at = { name: 0, slug: 0, legal_entities: 1, countries: 2, modules: 2, email: 3 }[field ?? ''];
          if (at !== undefined) this.step.set(at);
        },
      });
  }

  protected close(): void {
    this.closed.emit();
    this.reset();
  }

  private reset(): void {
    this.step.set(0);
    this.name.set('');
    this.slug.set('');
    this.slugEdited = false;
    this.entities.set([{ name: '', country: 'DK', registration_number: '' }]);
    this.picked.set(new Set());
    this.mods.set(new Set());
    this.adminName.set('');
    this.adminEmail.set('');
    this.problem.set(null);
  }
}
