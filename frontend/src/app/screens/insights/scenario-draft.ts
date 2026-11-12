import { Injectable, signal } from '@angular/core';
import { ScenarioChange } from '../../core/api/contracts';

export type EprId = 'epr_uk' | 'epr_dk' | 'sb54_ca';

export interface DraftChange extends ScenarioChange {
  name: string;
  product_name: string;
}

/** The regime and the unsaved scenario, shared by Hotspots ("What if") and Scenarios. */
@Injectable({ providedIn: 'root' })
export class ScenarioDraft {
  readonly regime = signal<EprId>('epr_uk');
  readonly changes = signal<DraftChange[]>([]);
}
