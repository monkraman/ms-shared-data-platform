import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The EPR, PPWR and DPP data point explorer (flowchart, table, checklist, SKU data): Platform →
 * Data explorer for platform admins, and the Data point map tab of Data collection for clients.
 * It is the reference app in `reference-docs-teams/datapoints-epr-ppwr-main`, published as-is
 * at `/datapoints/` (copied into public/ by scripts/copy-datapoints.js), so its edits ship on deploy.
 */
@Component({
  selector: 'app-data-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<iframe src="/datapoints/index.html" title="Data explorer"></iframe>`,
  styles: `
    :host { display: block; margin: 0 -32px -40px; }
    iframe { display: block; width: 100%; height: calc(100vh - 128px); border: 0; border-top: 1px solid var(--border-2); }
  `,
})
export class DataExplorerComponent {}
