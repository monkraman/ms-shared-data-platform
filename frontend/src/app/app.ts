import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { APP_CONFIG } from './core/config/client-theme.config';
import { TenantApiService } from './core/services/tenant-api.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';
import { QualityApiService } from './core/services/quality-api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly config = APP_CONFIG;
  readonly tenantService = inject(TenantApiService);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly qualityService = inject(QualityApiService);
  private readonly router = inject(Router);

  readonly currentUrl = signal<string>(this.router.url);
  readonly mobileNavOpen = signal<boolean>(false);

  // Dynamic View Switcher: Client View vs Operator View
  readonly activeView = signal<'client' | 'operator'>('client');

  // Active Tenant signals
  readonly activeTenantId = this.tenantService.activeTenantId;
  readonly activeTenantName = computed(() => {
    const list = this.tenantService.tenants();
    const active = list.find((t) => t.id === this.activeTenantId());
    if (active) return active.name;
    return this.activeTenantId() === 'khc-europe'
      ? 'The Kraft Heinz Company'
      : this.activeTenantId();
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

    // Automatically set default view mode based on role
    if (this.authService.isSuperAdmin()) {
      this.activeView.set('operator');
    }

    // Load initial tenant and quality data
    this.tenantService.loadTenants().subscribe();
    this.qualityService.loadIssues().subscribe();
  }

  /** Hide the global shell on sign-in and onboarding pages (they have their own full-bleed standalone layout matching mockups) */
  readonly showGlobalNav = computed(() => {
    const url = this.currentUrl();
    return !url.includes('/sign-in') && !url.includes('/admin') && !url.includes('/onboarding');
  });

  toggleMobileNav(): void {
    this.mobileNavOpen.update(v => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  toggleViewMode(): void {
    this.activeView.update(v => v === 'client' ? 'operator' : 'client');
  }

  setViewMode(mode: 'client' | 'operator'): void {
    this.activeView.set(mode);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/sign-in']);
  }
}
