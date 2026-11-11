import { Injectable, signal } from '@angular/core';
import { ImportDraft } from '../../core/api/contracts';

/** A sync started elsewhere (Data sources) that waits for review on the Import screen. */
@Injectable({ providedIn: 'root' })
export class ImportHandoff {
  readonly draft = signal<ImportDraft | null>(null);

  take(): ImportDraft | null {
    const d = this.draft();
    this.draft.set(null);
    return d;
  }
}
