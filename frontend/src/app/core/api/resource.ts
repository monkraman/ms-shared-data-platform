import { Signal, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { Problem, toProblem } from './problem';

/**
 * Loading, data and error for one request, as signals: every screen's
 * loading / empty / error states come from this.
 *
 *   readonly products = load(() => this.api.products({ q: this.q() }));
 *   products.reload();
 */
export interface Loaded<T> {
  readonly value: Signal<T | undefined>;
  readonly loading: Signal<boolean>;
  readonly error: Signal<Problem | null>;
  reload(): void;
  set(value: T): void;
}

export function load<T>(request: () => Observable<T>): Loaded<T> {
  const value = signal<T | undefined>(undefined);
  const loading = signal(true);
  const error = signal<Problem | null>(null);
  let seq = 0;

  const reload = () => {
    const mine = ++seq;
    loading.set(true);
    error.set(null);
    request().subscribe({
      next: (v) => {
        if (mine !== seq) return;
        value.set(v);
        loading.set(false);
      },
      error: (e: unknown) => {
        if (mine !== seq) return;
        error.set(toProblem(e));
        loading.set(false);
      },
    });
  };
  reload();
  return { value: value.asReadonly(), loading: loading.asReadonly(), error: error.asReadonly(), reload, set: (v) => value.set(v) };
}
