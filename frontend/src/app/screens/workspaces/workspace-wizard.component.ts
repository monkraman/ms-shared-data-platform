import { ChangeDetectionStrategy, Component, WritableSignal, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LegalEntity, ModuleId, Workspace } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { load } from '../../core/api/resource';
import { DialogComponent, FormFieldComponent } from '../../shared/ui';

const STEPS = ['Organisation', 'Legal entities', 'Countries and modules', 'First admin'] as const;
const MAX_LOGO_BYTES = 300 * 1024;

/**
 * Screen 2: create a workspace in four steps, or edit one (the same steps without the
 * first admin). Validation matches the API's rules.
 */
@Component({
  selector: 'app-workspace-wizard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogComponent, FormFieldComponent],
  template: `
    <app-dialog [open]="open()" [title]="steps()[step()]" (closed)="close()">
      <div class="steps" aria-hidden="true">
        @for (s of steps(); track s; let i = $index) { <span [class.done]="i <= step()"></span> }
      </div>

      @switch (step()) {
        @case (0) {
          <div class="form-grid">
            <app-form-field label="Name" for="ws-name" class="wide" [error]="err('name')">
              <input id="ws-name" [ngModel]="name()" (ngModelChange)="setName($event)" autocomplete="organization" />
            </app-form-field>
            <app-form-field label="Slug" for="ws-slug" [error]="err('slug')">
              <input id="ws-slug" class="mono" [ngModel]="slug()" [disabled]="!!workspace()"
                     (ngModelChange)="slug.set($event); slugEdited = true" />
            </app-form-field>
            <app-form-field label="Sector" for="ws-sector">
              <select id="ws-sector" [ngModel]="sector()" (ngModelChange)="sector.set($event)">
                @for (s of sectors; track s) { <option [value]="s">{{ s }}</option> }
              </select>
            </app-form-field>
            <app-form-field label="Brand colour" for="ws-color" [error]="err('brand_color')">
              <input id="ws-color" type="color" [ngModel]="color()" (ngModelChange)="color.set($event)" />
            </app-form-field>
            <app-form-field label="Logo" for="ws-logo" class="wide" [error]="logoError() ?? err('logo_url')">
              <div class="logo-row">
                @if (logo()) {
                  <img class="logo-preview" [src]="logo()" alt="" />
                }
                <input id="ws-logo" type="url" placeholder="https://"
                       [ngModel]="logo().startsWith('data:') ? '' : logo()" (ngModelChange)="setLogo($event)" />
                <label class="btn btn-secondary upload">
                  Upload
                  <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" (change)="upload($event)" hidden />
                </label>
                @if (logo()) {
                  <button type="button" class="btn btn-ghost" (click)="setLogo('')">Remove</button>
                }
              </div>
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
        @if (step() < steps().length - 1) {
          <button type="button" class="btn btn-primary" [disabled]="!canContinue()" (click)="step.set(step() + 1)">Continue</button>
        } @else {
          <button type="button" class="btn btn-primary" [disabled]="saving() || !canContinue()" (click)="submit()">
            {{ workspace() ? 'Save' : 'Create workspace' }}
          </button>
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
    .logo-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo-row input[type='url'] {
      flex: 1;
      min-width: 0;
    }
    .logo-preview {
      width: 36px;
      height: 36px;
      object-fit: contain;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: #fff;
    }
    .upload {
      cursor: pointer;
    }
  `,
})
export class WorkspaceWizardComponent {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  /** Set to edit this workspace instead of creating one. */
  readonly workspace = input<Workspace | null>(null);
  readonly closed = output<void>();
  readonly created = output<Workspace>();
  readonly updated = output<Workspace>();

  protected readonly steps = computed<string[]>(() => (this.workspace() ? STEPS.slice(0, 3) : [...STEPS]));
  protected readonly sectors = ['Food', 'Beverages', 'Personal care', 'Household', 'Retail', 'Other'];
  protected readonly countries = load(() => this.api.countries());
  private readonly modules = load(() => this.api.modules());

  protected readonly step = signal(0);
  protected readonly name = signal('');
  protected readonly slug = signal('');
  protected slugEdited = false;
  protected readonly sector = signal('Food');
  protected readonly color = signal('#1b3c6d');
  protected readonly logo = signal('');
  protected readonly logoError = signal<string | null>(null);
  protected readonly entities = signal<LegalEntity[]>([{ name: '', country: 'DK', registration_number: '' }]);
  protected readonly picked = signal(new Set<string>());
  protected readonly mods = signal(new Set<string>());
  protected readonly adminName = signal('');
  protected readonly adminEmail = signal('');
  protected readonly saving = signal(false);
  private readonly problem = signal<Problem | null>(null);

  constructor() {
    // Opening in edit mode fills the steps from the workspace.
    effect(() => {
      const ws = this.workspace();
      if (!this.open() || !ws) return;
      this.step.set(0);
      this.name.set(ws.name);
      this.slug.set(ws.slug);
      this.slugEdited = true;
      this.sector.set(ws.sector);
      this.color.set(ws.brand_color);
      this.logo.set(ws.logo_url ?? '');
      this.entities.set(
        ws.legal_entities.length
          ? ws.legal_entities.map((e) => ({ ...e }))
          : [{ name: '', country: 'DK', registration_number: '' }],
      );
      this.picked.set(new Set(ws.countries));
      this.mods.set(new Set(ws.modules));
      this.problem.set(null);
    });
  }

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

  protected setLogo(value: string): void {
    this.logoError.set(null);
    this.logo.set(value.trim());
  }

  /** Reads a small image into the workspace as a data URI (object storage comes later). */
  protected upload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > MAX_LOGO_BYTES) {
      this.logoError.set('Use an image under 300 KB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => this.setLogo(String(reader.result));
    reader.readAsDataURL(file);
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
    const common = {
      name: this.name(),
      sector: this.sector(),
      brand_color: this.color(),
      logo_url: this.logo() || null,
      legal_entities: this.entities().filter((e) => e.name.trim()),
      countries: [...this.picked()],
      modules: [...this.mods()].filter((m) => this.availableModules().some((a) => a.id === m)) as ModuleId[],
    };
    const editing = this.workspace();
    const request = editing
      ? this.api.updateWorkspace(editing.id, common)
      : this.api.createWorkspace({
          ...common,
          slug: this.slug(),
          admin: { full_name: this.adminName(), email: this.adminEmail() },
        });
    request.subscribe({
        next: (ws) => {
          this.saving.set(false);
          if (editing) this.updated.emit(ws);
          else this.created.emit(ws);
          this.reset();
        },
        error: (e: unknown) => {
          const problem = toProblem(e);
          this.saving.set(false);
          this.problem.set(problem);
          // Go back to the step that has the error.
          const field = Object.keys(problem.fields)[0];
          const at = { name: 0, slug: 0, brand_color: 0, logo_url: 0, legal_entities: 1, countries: 2, modules: 2, email: 3 }[
            field ?? ''
          ];
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
    this.color.set('#1b3c6d');
    this.logo.set('');
    this.logoError.set(null);
    this.entities.set([{ name: '', country: 'DK', registration_number: '' }]);
    this.picked.set(new Set());
    this.mods.set(new Set());
    this.adminName.set('');
    this.adminEmail.set('');
    this.problem.set(null);
  }
}
