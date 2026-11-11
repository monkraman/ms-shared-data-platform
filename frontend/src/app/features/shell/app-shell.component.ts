import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { NAV_ITEMS } from '../../core/navigation/nav-items';
import { SessionService } from '../../core/session/session.service';
import { ToastOutletComponent } from '../../shared/ui';

/** Layout for platform screens: sidebar (workspace, navigation, user) and the page. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastOutletComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly nav = computed(() => NAV_ITEMS.filter((item) => this.session.can(item.permission)));
  protected readonly initials = computed(() => initialsOf(this.session.me()?.user.full_name ?? ''));

  constructor() {
    // Close the mobile menu after navigating.
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected signOut(): void {
    this.session.clear();
    void this.router.navigate(['/sign-in']);
  }
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?';
}
