import { Injectable, signal, effect, inject } from '@angular/core';
import { DOCUMENT } from '@angular/common';

export type AppTheme = 'light' | 'dark';

/**
 * Enterprise ThemeService for Compliance Hub.
 * Manages theme state via Angular Signals with persistent local storage
 * and system preference detection. Default is 'light' theme as preferred by user.
 */
@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly STORAGE_KEY = 'compliance_hub_theme';

  // Default to 'light' per user preference
  readonly theme = signal<AppTheme>(this.getInitialTheme());

  constructor() {
    // Reactive effect: updates DOM attribute whenever theme signal changes
    effect(() => {
      const currentTheme = this.theme();
      this.applyTheme(currentTheme);
    });
  }

  toggleTheme(): void {
    const nextTheme: AppTheme = this.theme() === 'light' ? 'dark' : 'light';
    this.setTheme(nextTheme);
  }

  setTheme(newTheme: AppTheme): void {
    this.theme.set(newTheme);
    try {
      localStorage.setItem(this.STORAGE_KEY, newTheme);
    } catch {
      // Graceful fallback if localStorage is disabled in iframe/sandbox
    }
  }

  private getInitialTheme(): AppTheme {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
      if (saved === 'light' || saved === 'dark') {
        return saved;
      }
    } catch {
      // Fallback
    }
    // Default to 'light'
    return 'light';
  }

  private applyTheme(theme: AppTheme): void {
    const root = this.document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'dark') {
      root.classList.add('dark-theme');
      root.classList.remove('light-theme');
    } else {
      root.classList.add('light-theme');
      root.classList.remove('dark-theme');
    }
  }
}

