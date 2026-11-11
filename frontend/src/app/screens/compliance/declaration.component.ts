import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Declaration } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { Problem, toProblem } from '../../core/api/problem';
import { ErrorStateComponent } from '../../shared/ui';

/**
 * PPWR EU Declaration of Conformity for one product, in Danish or English. Print / PDF uses
 * the browser's print dialog; Email opens the user's mail program with the declaration
 * summarised (attach the PDF there) until the platform sends email itself.
 */
@Component({
  selector: 'app-declaration',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, ErrorStateComponent],
  template: `
    <div class="bar no-print">
      <a routerLink="/app/compliance" class="back">← Compliance</a>
      <div class="actions">
        <div class="segmented" role="group" aria-label="Language">
          <button type="button" [class.on]="lang() === 'da'" (click)="lang.set('da')">Dansk</button>
          <button type="button" [class.on]="lang() === 'en'" (click)="lang.set('en')">English</button>
        </div>
        <a class="btn btn-secondary" [href]="mailto()">Email</a>
        <button type="button" class="btn btn-primary" (click)="print()">Print / PDF</button>
      </div>
    </div>

    @if (problem(); as p) {
      <app-error-state [problem]="p" (retry)="fetch()" />
    } @else if (doc(); as d) {
      @if (d.status === 'draft') {
        <div class="draft no-print" role="note">
          <b>{{ d.status_label }}</b>
          @for (r of d.requirements; track r.key) {
            @if (r.status === 'missing') { <span class="pill">{{ r.label }}</span> }
          }
          @for (f of d.missing_fields; track f) { <span class="pill">{{ f }}</span> }
        </div>
      }

      <article class="paper">
        <header class="doc-head">
          <div>
            <h1>{{ d.text['title'] }}</h1>
            <p class="subtitle">{{ d.text['subtitle'] }}</p>
          </div>
          <div class="ref">
            <span>{{ d.text['reference'] }}</span><b>{{ d.reference || '—' }}</b>
            <span>{{ d.text['version'] }}</span><b>{{ d.version || '—' }}</b>
          </div>
        </header>

        <section>
          <h2>1. {{ d.text['product'] }}</h2>
          <dl class="facts">
            <dt>{{ d.product_name }}</dt><dd></dd>
            <dt>{{ d.text['sku'] }}</dt><dd>{{ d.sku }}</dd>
            <dt>{{ d.text['gtin'] }}</dt><dd>{{ d.gtin || '—' }}</dd>
          </dl>
        </section>

        <section>
          <h2>2. {{ d.text['manufacturer'] }}</h2>
          <p class="strong">{{ d.manufacturer || '—' }}</p>
          <p>{{ d.text['responsibility'] }}</p>
        </section>

        <section>
          <h2>3. {{ d.text['object'] }}</h2>
          <table>
            <thead>
              <tr>
                <th>{{ d.text['component'] }}</th><th>{{ d.text['level'] }}</th><th>{{ d.text['material'] }}</th>
                <th class="n">{{ d.text['weight'] }}</th><th class="n">{{ d.text['recycled'] }}</th><th>{{ d.text['recyclability'] }}</th>
              </tr>
            </thead>
            <tbody>
              @for (c of d.components; track $index) {
                <tr>
                  <td>{{ c.name }}</td><td>{{ c.level }}</td><td>{{ c.material || '—' }}</td>
                  <td class="n">{{ c.weight_g || '—' }}</td><td class="n">{{ c.recycled_content_pct || '—' }}</td><td>{{ c.recyclability || '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </section>

        <section>
          <h2>4. {{ d.text['conformity'] }}</h2>
          @for (r of d.requirements; track r.key) {
            <div class="req">
              <span class="mark" [class]="r.status" aria-hidden="true">{{ r.status === 'ok' ? '✓' : r.status === 'warning' ? '!' : '×' }}</span>
              <div>
                <b>{{ r.label }}</b>
                @if (r.evidence.length) { <p class="evidence">{{ r.evidence.join(' · ') }}</p> }
              </div>
            </div>
          }
        </section>

        <section>
          <h2>5. {{ d.text['technical'] }}</h2>
          <p>{{ d.technical_file_refs.join(' · ') || '—' }}</p>
        </section>

        <footer class="sign">
          <div><span>{{ d.text['signed'] }}</span><b>{{ d.manufacturer || '—' }}</b></div>
          <div><span>&nbsp;</span><b>{{ d.signatory || '—' }}</b></div>
          <div><span>{{ d.text['date'] }}</span><b>{{ d.issue_date || '—' }}</b></div>
          <div><span>{{ d.text['retention'] }}</span><b>{{ d.retention_until || '—' }}</b></div>
        </footer>
      </article>
    } @else {
      <div class="paper muted">…</div>
    }
  `,
  styles: `
    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    .back {
      color: var(--muted);
      text-decoration: none;
      font-weight: 600;
    }
    .actions {
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
    }
    .draft {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin: 0 auto 16px;
      max-width: 820px;
      padding: 10px 14px;
      border-radius: 10px;
      background: #fff7e6;
      border: 1px solid #f2d39a;
      color: #6b4a00;
      font-size: 13px;
    }
    .pill {
      padding: 2px 8px;
      border-radius: 999px;
      background: #fff;
      border: 1px solid #f2d39a;
    }
    .paper {
      max-width: 820px;
      margin: 0 auto;
      padding: 48px 56px;
      background: #fff;
      color: #111;
      border: 1px solid var(--border);
      border-radius: 6px;
      box-shadow: 0 10px 30px rgb(15 23 42 / 0.08);
      font-size: 13.5px;
      line-height: 1.55;
    }
    .doc-head {
      display: flex;
      justify-content: space-between;
      gap: 24px;
      padding-bottom: 20px;
      border-bottom: 2px solid #111;
    }
    h1 {
      margin: 0;
      font-size: 24px;
      letter-spacing: -0.01em;
    }
    .subtitle {
      margin: 4px 0 0;
      color: #555;
    }
    .ref {
      display: grid;
      grid-template-columns: auto auto;
      gap: 2px 12px;
      font-size: 12px;
      white-space: nowrap;
      align-content: start;
    }
    .ref span {
      color: #666;
    }
    section {
      padding: 18px 0 4px;
    }
    h2 {
      margin: 0 0 8px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #333;
    }
    p {
      margin: 0 0 6px;
    }
    .strong {
      font-weight: 700;
    }
    .facts {
      display: grid;
      grid-template-columns: 140px 1fr;
      gap: 2px 12px;
      margin: 0;
    }
    .facts dt:first-child {
      grid-column: 1 / -1;
      font-weight: 700;
      font-size: 15px;
    }
    .facts dt {
      color: #666;
    }
    .facts dd {
      margin: 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12.5px;
    }
    th,
    td {
      text-align: left;
      padding: 6px 8px;
      border-bottom: 1px solid #e5e5e5;
    }
    th {
      color: #555;
      font-weight: 600;
    }
    .n {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }
    .req {
      display: flex;
      gap: 12px;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .mark {
      flex: none;
      display: grid;
      place-items: center;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      font-weight: 700;
      font-size: 12px;
      color: #fff;
    }
    .mark.ok {
      background: #15966a;
    }
    .mark.warning {
      background: #e0a100;
    }
    .mark.missing {
      background: #c0211f;
    }
    .evidence {
      color: #555;
      font-size: 12px;
      margin: 2px 0 0;
    }
    .sign {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-top: 28px;
      padding-top: 16px;
      border-top: 1px solid #111;
    }
    .sign div {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .sign span {
      font-size: 11px;
      color: #666;
    }
    @media (max-width: 700px) {
      .paper {
        padding: 24px 18px;
      }
      .doc-head {
        flex-direction: column;
      }
      .sign {
        grid-template-columns: 1fr 1fr;
      }
      table {
        display: block;
        overflow-x: auto;
      }
    }
  `,
})
export class DeclarationComponent {
  private readonly api = inject(PlatformApi);

  /** Route parameter (component input binding). */
  readonly sku = input.required<string>();
  protected readonly lang = signal<'da' | 'en'>('da');
  protected readonly doc = signal<Declaration | null>(null);
  protected readonly problem = signal<Problem | null>(null);

  protected readonly mailto = computed(() => {
    const d = this.doc();
    if (!d) return 'mailto:';
    const subject = `${d.text['title']}: ${d.product_name} (${d.reference || d.sku})`;
    const body = [
      d.text['title'],
      d.text['subtitle'],
      '',
      `${d.product_name} · ${d.text['sku']} ${d.sku} · ${d.text['gtin']} ${d.gtin || '—'}`,
      `${d.text['manufacturer']}: ${d.manufacturer}`,
      `${d.text['reference']}: ${d.reference || '—'} (${d.text['version']} ${d.version || '—'})`,
      `${d.text['date']}: ${d.issue_date || '—'}`,
      '',
      ...d.requirements.map((r) => `- ${r.label}: ${r.status === 'ok' ? '✓' : r.status}`),
    ].join('\n');
    return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  constructor() {
    effect(() => {
      this.sku();
      this.lang();
      this.fetch();
    });
  }

  protected fetch(): void {
    this.problem.set(null);
    this.api.declaration(this.sku(), this.lang()).subscribe({
      next: (d) => this.doc.set(d),
      error: (e: unknown) => this.problem.set(toProblem(e)),
    });
  }

  protected print(): void {
    window.print();
  }
}
