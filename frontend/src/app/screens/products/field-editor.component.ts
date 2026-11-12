import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FieldInfo, FieldValue } from '../../core/api/contracts';
import { FormFieldComponent } from '../../shared/ui';

const SOURCE: Record<string, string> = {
  csv: 'File',
  erp: 'ERP',
  plm: 'PLM',
  manual: 'Edited',
  estimate: 'Estimate',
  correction: 'Corrected',
};

/**
 * Edits a set of catalogue fields: the control follows the field's type (allowed values →
 * a list, Yes/No, dates). Values go into `draft` (key → text); the server validates them and
 * returns errors such as "… Did you mean 26?", offered here as a one-click fix.
 */
@Component({
  selector: 'app-field-editor',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, FormFieldComponent],
  template: `
    <div class="form-grid">
      @for (f of rows(); track f.key) {
        <app-form-field [label]="f.label + (f.dp ? ' · ' + f.dp : '')" [for]="'fe-' + f.key" [class.wide]="f.wide" [error]="errors()[f.key]">
          @if (f.options) {
            <select [id]="'fe-' + f.key" [(ngModel)]="draft()[f.key]">
              <option value="">—</option>
              @for (o of f.options; track o) { <option [value]="o">{{ o }}</option> }
              @if (draft()[f.key] && !f.options.includes(draft()[f.key])) { <option [value]="draft()[f.key]">{{ draft()[f.key] }}</option> }
            </select>
          } @else {
            <input [id]="'fe-' + f.key" [type]="f.type === 'Date' ? 'date' : 'text'" [(ngModel)]="draft()[f.key]"
                   [attr.inputmode]="f.type === 'Number' ? 'decimal' : null" />
          }
          @if (suggestion(f.key); as s) {
            <button type="button" class="fix" (click)="draft()[f.key] = s">Use {{ s }}</button>
          } @else if (source(f.key); as src) {
            <span class="src">{{ src }}</span>
          }
        </app-form-field>
      }
    </div>
  `,
  styles: `
    .fix {
      align-self: flex-start;
      margin-top: 4px;
      padding: 2px 8px;
      border: 1px solid #15966a;
      border-radius: 999px;
      background: #e9f7f0;
      color: #0d6b4b;
      font: inherit;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
    }
    .src {
      margin-top: 2px;
      font-size: 11px;
      color: var(--muted);
    }
  `,
})
export class FieldEditorComponent {
  /** Field keys to show, in order. */
  readonly keys = input.required<string[]>();
  readonly catalogue = input.required<Record<string, FieldInfo>>();
  /** Stored values, for showing where each came from. */
  readonly stored = input<Record<string, FieldValue>>({});
  /** key → text being edited (mutated in place). */
  readonly draft = input.required<Record<string, string>>();
  readonly errors = input<Record<string, string>>({});

  protected readonly rows = computed(() =>
    this.keys().map((key) => {
      const f = this.catalogue()[key] ?? { label: key, dp: null, level: '', type: 'Text', allowed: null };
      const allowed = f.allowed && !f.allowed.includes(':') && !f.allowed.includes('–') ? f.allowed.split(',').map((a) => a.trim()) : null;
      return {
        key,
        label: f.label,
        dp: f.dp,
        type: f.type,
        options: f.type === 'Yes/No' ? ['Yes', 'No'] : allowed,
        wide: f.type === 'Text' && /name|refs|info|split|url|additives/.test(key),
      };
    }),
  );

  protected suggestion(key: string): string | null {
    const m = /Did you mean (.+)\?$/.exec(this.errors()[key] ?? '');
    return m ? m[1] : null;
  }

  protected source(key: string): string | null {
    const s = this.stored()[key]?.source;
    return s ? (SOURCE[s] ?? s) : null;
  }
}
