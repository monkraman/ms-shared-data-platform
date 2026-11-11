import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DataPoint, OutputId, SourceId } from '../../core/api/contracts';
import { PlatformApi } from '../../core/api/platform-api';
import { load } from '../../core/api/resource';
import {
  ChipTone,
  Column,
  DataTableComponent,
  DrawerComponent,
  EmptyStateComponent,
  ErrorStateComponent,
  PageHeaderComponent,
  StatusChipComponent,
} from '../../shared/ui';

export const SOURCE_TONE: Record<SourceId, ChipTone> = { erp: 'blue', plm: 'green', supplier: 'amber', man: 'neutral' };

/** Screen 3: the data point dictionary every module and rule refers to. */
@Component({
  selector: 'app-data-points',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    DataTableComponent,
    StatusChipComponent,
    DrawerComponent,
    EmptyStateComponent,
    ErrorStateComponent,
  ],
  template: `
    <app-page-header title="Data points" />

    @if (dict.value(); as d) {
      <div class="toolbar">
        <input type="search" placeholder="Search" aria-label="Search data points" [ngModel]="q()" (ngModelChange)="q.set($event)" />
        <select aria-label="Source" [ngModel]="source()" (ngModelChange)="source.set($event)">
          <option value="">All sources</option>
          @for (s of sourceIds(); track s) { <option [value]="s">{{ d.sources[s] }}</option> }
        </select>
        <select aria-label="Used for" [ngModel]="output()" (ngModelChange)="output.set($event)">
          <option value="">All outputs</option>
          @for (o of outputIds(); track o) { <option [value]="o">{{ d.outputs[o].name }}</option> }
        </select>
        <select aria-label="Country" [ngModel]="country()" (ngModelChange)="country.set($event)">
          <option value="">All countries</option>
          @for (c of d.countries; track c.code) { <option [value]="c.code">{{ c.name }}</option> }
        </select>
        <span class="spacer"></span>
        <span class="muted">{{ rows().length }} of {{ d.data_points.length }}</span>
      </div>
    }

    @if (dict.error(); as problem) {
      <app-error-state [problem]="problem" (retry)="dict.reload()" />
    } @else if (!dict.loading() && !rows().length) {
      <app-empty-state title="No data points match" />
    } @else {
      <app-data-table [columns]="columns" [rows]="rows()" [loading]="dict.loading()" [clickable]="true"
                      [trackBy]="byCode" (rowClick)="selected.set($event)">
        <ng-template #cell let-row let-key="key" let-value="value">
          @switch (key) {
            @case ('code') { <span class="mono">{{ row.code }}</span> }
            @case ('name') { <b>{{ row.name }}</b> }
            @case ('source') {
              <app-status-chip [tone]="tone(row.source)">{{ sourceName(row.source) }}</app-status-chip>
            }
            @case ('outputs') {
              <span class="chips">
                @for (o of row.outputs; track o) { <app-status-chip>{{ regulation(o) }}</app-status-chip> }
              </span>
            }
            @default { {{ value }} }
          }
        </ng-template>
      </app-data-table>
    }

    <app-drawer [open]="!!selected()" [title]="selected() ? selected()!.code + ' · ' + selected()!.name : ''" (closed)="selected.set(null)">
      @if (selected(); as dp) {
        <p>{{ dp.description }}</p>
        <dl class="facts">
          <dt>Source</dt>
          <dd><app-status-chip [tone]="tone(dp.source)">{{ sourceName(dp.source) }}</app-status-chip></dd>
          <dt>System field</dt>
          <dd class="mono">{{ dp.system_field || '—' }}</dd>
          <dt>Countries</dt>
          <dd>{{ dp.countries.join(', ') }}</dd>
          <dt>Applies from</dt>
          <dd>{{ dp.applies_from || '—' }}</dd>
        </dl>
        <div class="section-label">Used for</div>
        @for (o of dp.outputs; track o) {
          <div class="out"><span>{{ outputName(o) }}</span><app-status-chip>{{ regulation(o) }}</app-status-chip></div>
        }
      }
    </app-drawer>
  `,
  styles: `
    .out {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px solid var(--border);
    }
  `,
})
export class DataPointsComponent {
  private readonly api = inject(PlatformApi);

  protected readonly dict = load(() => this.api.dataPoints());
  protected readonly q = signal('');
  protected readonly source = signal('');
  protected readonly output = signal('');
  protected readonly country = signal('');
  protected readonly selected = signal<DataPoint | null>(null);

  protected readonly sourceIds = computed(() => Object.keys(this.dict.value()?.sources ?? {}) as SourceId[]);
  protected readonly outputIds = computed(() => Object.keys(this.dict.value()?.outputs ?? {}) as OutputId[]);

  protected readonly rows = computed(() => {
    const q = this.q().toLowerCase();
    return (this.dict.value()?.data_points ?? []).filter(
      (dp) =>
        (!q || dp.code.toLowerCase().includes(q) || dp.name.toLowerCase().includes(q) || dp.description.toLowerCase().includes(q)) &&
        (!this.source() || dp.source === this.source()) &&
        (!this.output() || dp.outputs.includes(this.output() as OutputId)) &&
        (!this.country() || dp.countries.includes(this.country())),
    );
  });

  protected readonly columns: Column<DataPoint>[] = [
    { key: 'code', label: 'Code' },
    { key: 'name', label: 'Name' },
    { key: 'source', label: 'Source' },
    { key: 'outputs', label: 'Used for' },
    { key: 'countries', label: 'Countries', value: (d) => (d.countries.length >= 7 ? 'All' : d.countries.join(', ')) },
  ];

  protected readonly byCode = (d: DataPoint) => d.code;
  protected tone = (s: SourceId) => SOURCE_TONE[s];
  protected sourceName = (s: SourceId) => this.dict.value()?.sources[s] ?? s;
  protected outputName = (o: OutputId) => this.dict.value()?.outputs[o]?.name ?? o;
  protected regulation = (o: OutputId) => {
    const out = this.dict.value()?.outputs[o];
    return out ? `${out.regulation} · ${shortOutput(out.name)}` : o;
  };
}

function shortOutput(name: string): string {
  return name.replace(/^National EPR |^EPR |^PPWR |^EU /, '').replace(/ and .*$/, '').replace(/ \/ .*$/, '');
}
