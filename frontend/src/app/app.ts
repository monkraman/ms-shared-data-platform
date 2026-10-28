import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { APP_CONFIG } from './core/config/client-theme.config';
import { TenantApiService } from './core/services/tenant-api.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

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
  private readonly router = inject(Router);

  /** Hide the global nav on sign-in and admin pages (they have their own layout) */
  readonly showGlobalNav = computed(() => {
    const url = this.router.url;
    return !url.includes('/sign-in') && !url.includes('/admin');
  });

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/sign-in']);
  }
}
