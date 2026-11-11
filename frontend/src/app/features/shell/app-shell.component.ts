import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { NAV } from '../../core/navigation/nav-items';
import { SessionService } from '../../core/session/session.service';
import { ToastOutletComponent, initialsOf } from '../../shared/ui';

export { initialsOf };

/** Layout for platform screens: grouped sidebar, top bar with product search, and the page. */
@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ToastOutletComponent],
  host: { class: 'platform' },
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.css',
})
export class AppShellComponent {
  protected readonly session = inject(SessionService);
  private readonly router = inject(Router);

  protected readonly menuOpen = signal(false);
  protected readonly nav = computed(() =>
    NAV.map((g) => ({ ...g, items: g.items.filter((i) => this.session.can(i.permission)) })).filter(
      (g) => g.items.length,
    ),
  );
  /** The active workspace's branding (logo, colour) from the session. */
  protected readonly tenant = computed(() => this.session.me()?.active_tenant ?? null);
  protected readonly name = computed(() => this.session.me()?.user.full_name ?? '');
  protected readonly initials = computed(() => initialsOf(this.name()));
  protected readonly role = computed(() => (this.session.me()?.user.is_platform_admin ? 'Platform admin' : 'Org admin'));
  protected readonly canSwitch = computed(() => this.session.memberships().length > 1);
  protected readonly canSearch = computed(() => this.session.can('products.read'));

  constructor() {
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.menuOpen.set(false));
  }

  protected search(q: string): void {
    void this.router.navigate(['/app/products'], { queryParams: q.trim() ? { q: q.trim() } : {} });
  }

  protected async signOut(): Promise<void> {
    await this.session.signOut();
    await this.router.navigate(['/sign-in'], { queryParams: { reason: 'signed-out' } });
  }
}
