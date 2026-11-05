import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
}

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  readonly currentToast = signal<ToastMessage | null>(null);
  private timer: any = null;
  private nextId = 1;

  show(message: string, type: 'success' | 'info' | 'warning' | 'error' = 'success', durationMs = 3500): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    const id = this.nextId++;
    this.currentToast.set({ id, message, type });

    this.timer = setTimeout(() => {
      if (this.currentToast()?.id === id) {
        this.currentToast.set(null);
      }
    }, durationMs);
  }

  dismiss(): void {
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.currentToast.set(null);
  }
}
