import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { APP_CONFIG } from './core/config/client-theme.config';
import { TenantApiService } from './core/services/tenant-api.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { QualityApiService } from './core/services/quality-api.service';
import { ToastService } from './core/services/toast.service';
import { SidebarComponent } from './shared/components/sidebar/sidebar.component';
import { ToastOutletComponent } from './shared/ui';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, SidebarComponent, ToastOutletComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly config = APP_CONFIG;
  readonly tenantService = inject(TenantApiService);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly qualityService = inject(QualityApiService);
  readonly toastService = inject(ToastService);
  private readonly router = inject(Router);

  // Start from the browser's path: router.url is '/' until the first navigation ends.
  readonly currentUrl = signal<string>(inject(DOCUMENT).location.pathname);
  readonly mobileNavOpen = signal<boolean>(false);

  // Active Tenant signals
  readonly activeTenantId = this.tenantService.activeTenantId;
  readonly activeTenant = computed(() => {
    const list = this.tenantService.tenants();
    return list.find((t) => t.id === this.activeTenantId());
  });

  readonly activeTenantName = computed(() => {
    const active = this.activeTenant();
    if (active) return active.name;
    return this.activeTenantId() === 'khc-europe'
      ? 'The Kraft Heinz Company'
      : this.activeTenantId();
  });

  readonly activeTenantLogo = computed(() => {
    return this.activeTenant()?.logo_url || null;
  });

  readonly activeTenantColor = computed(() => {
    return this.activeTenant()?.theme_color || '#111827';
  });

  // Dynamic Quality Issues / Gaps Count from DB
  readonly openGapsCount = computed(() => {
    return this.qualityService.issues().length;
  });

  constructor() {
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects || event.url);
        this.mobileNavOpen.set(false); // Auto-close drawer on navigation
      });

    // Load initial tenant and quality data
    this.tenantService.loadTenants().subscribe();
    this.qualityService.loadIssues().subscribe();
  }

  /** The prototype's shell; sign-in, admin, onboarding and platform screens (/app) bring their own layout. */
  readonly showGlobalNav = computed(() => {
    const url = this.currentUrl();
    const ownLayout = url.startsWith('/app') || url.startsWith('/no-permission');
    return !ownLayout && !url.includes('/sign-in') && !url.includes('/admin') && !url.includes('/onboarding');
  });

  toggleMobileNav(): void {
    this.mobileNavOpen.update(v => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/sign-in']);
  }
}
