import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PackagingLevel, Product, ProductCreate } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { DialogComponent, FormFieldComponent } from '../../shared/ui';

type ComponentDraft = ProductCreate['components'][number];

const blankComponent = (): ComponentDraft => ({
  name: '',
  level: 'Primary',
  units_per_pack: 1,
  material: 'Plastic',
  polymer: '',
  weight_g: 0,
  recycled_content_pct: 0,
});

/** Screen 4: manual entry of a SKU and its packaging BOM. */
@Component({
  selector: 'app-product-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, DialogComponent, FormFieldComponent],
  template: `
    <app-dialog [open]="open()" title="Add product" [width]="820" (closed)="closed.emit()">
      <div class="form-grid">
        <app-form-field label="SKU" for="p-sku" [error]="err('sku')">
          <input id="p-sku" class="mono" [(ngModel)]="draft.sku" (ngModelChange)="draft.sku = $event.toUpperCase()" />
        </app-form-field>
        <app-form-field label="GTIN" for="p-gtin" [error]="err('gtin')">
          <input id="p-gtin" inputmode="numeric" [(ngModel)]="draft.gtin" />
        </app-form-field>
        <app-form-field label="Product name" for="p-name" [error]="err('name')">
          <input id="p-name" [(ngModel)]="draft.name" />
        </app-form-field>
        <app-form-field label="Brand" for="p-brand">
          <input id="p-brand" [(ngModel)]="draft.brand" />
        </app-form-field>
      </div>

      <div class="section-label">Packaging components</div>
      <div class="bom" role="table" aria-label="Packaging components">
        <div class="bom-row head" role="row">
          <span>Component</span><span>Level</span><span>Units</span><span>Material</span><span>Polymer</span>
          <span>Weight (g)</span><span>Recycled %</span><span></span>
        </div>
        @for (c of draft.components; track $index; let i = $index) {
          <div class="bom-row" role="row">
            <input [(ngModel)]="c.name" aria-label="Component name" placeholder="Bottle" />
            <select [(ngModel)]="c.level" aria-label="Packaging level">
              @for (l of levels; track l) { <option [value]="l">{{ l }}</option> }
            </select>
            <input type="number" min="1" [(ngModel)]="c.units_per_pack" aria-label="Units per pack" />
            <select [(ngModel)]="c.material" aria-label="Material">
              @for (m of materials; track m) { <option [value]="m">{{ m }}</option> }
            </select>
            <input [(ngModel)]="c.polymer" aria-label="Polymer" placeholder="PET" />
            <input type="number" min="0" step="0.1" [(ngModel)]="c.weight_g" aria-label="Weight in grams" />
            <input type="number" min="0" max="100" [(ngModel)]="c.recycled_content_pct" aria-label="Recycled content percent" />
            <button type="button" class="btn btn-ghost" (click)="remove(i)" [disabled]="draft.components.length === 1"
                    aria-label="Remove component">&times;</button>
          </div>
        }
      </div>
      <button type="button" class="btn btn-ghost" (click)="draft.components.push(blank())">Add component</button>
      @if (err('components'); as e) { <p class="error-text">{{ e }}</p> }

      <ng-container actions>
        <button type="button" class="btn btn-secondary" (click)="closed.emit()">Cancel</button>
        <button type="button" class="btn btn-primary" [disabled]="saving()" (click)="save()">Add product</button>
      </ng-container>
    </app-dialog>
  `,
  styles: `
    .bom {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 8px;
    }
    .bom-row {
      display: grid;
      grid-template-columns: 2fr 1.2fr 0.7fr 1.3fr 1fr 0.9fr 0.9fr 36px;
      gap: 6px;
      align-items: center;
    }
    .bom-row.head span {
      font-size: 12px;
      font-weight: 600;
      color: var(--muted);
    }
    .bom-row :is(input, select) {
      height: 34px;
      min-width: 0;
      padding: 0 8px;
      border: 1px solid var(--border-2);
      border-radius: 8px;
      font: inherit;
      font-size: 13px;
      background: var(--card);
      color: var(--ink);
    }
    .bom-row .btn {
      width: 34px;
      height: 34px;
      padding: 0;
      font-size: 18px;
    }
  `,
})
export class ProductFormComponent {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly created = output<Product>();

  protected readonly levels: PackagingLevel[] = ['Primary', 'Secondary', 'Transit'];
  protected readonly materials = ['Plastic', 'Paper/board', 'Glass', 'Aluminium', 'Steel', 'Wood', 'Other'];
  protected readonly saving = signal(false);
  protected readonly problem = signal<Problem | null>(null);
  protected draft: ProductCreate = { sku: '', name: '', brand: '', gtin: '', components: [blankComponent()] };
  protected readonly blank = blankComponent;

  protected err(field: string): string | undefined {
    return this.problem()?.fields[field];
  }

  protected remove(i: number): void {
    this.draft.components.splice(i, 1);
  }

  protected save(): void {
    this.saving.set(true);
    this.problem.set(null);
    const body: ProductCreate = {
      ...this.draft,
      components: this.draft.components.map((c) => ({
        ...c,
        units_per_pack: Number(c.units_per_pack) || 1,
        weight_g: Number(c.weight_g) || 0,
        recycled_content_pct: Number(c.recycled_content_pct) || 0,
      })),
    };
    this.api.createProduct(body).subscribe({
      next: (p) => {
        this.saving.set(false);
        this.draft = { sku: '', name: '', brand: '', gtin: '', components: [blankComponent()] };
        this.created.emit(p);
      },
      error: (e: unknown) => {
        this.saving.set(false);
        this.problem.set(toProblem(e));
      },
    });
  }
}
