import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The EPR, PPWR and DPP data point explorer (flowchart, table, checklist) for platform admins.
 * It is the reference app in `reference-docs-teams/datapoints-epr-ppwr-main`, published as-is
 * at `/datapoints/` by the build (angular.json assets), so edits to that folder ship on deploy.
 */
@Component({
  selector: 'app-data-explorer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<iframe src="/datapoints/index.html" title="Data explorer"></iframe>`,
  styles: `
    :host { display: block; margin: -4px -32px -40px; }
    iframe { display: block; width: 100%; height: calc(100vh - 72px); border: 0; border-top: 1px solid var(--border-2); }
  `,
})
export class DataExplorerComponent {}
