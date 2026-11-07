import { Component, inject, input, output, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { TenantApiService } from '../../../core/services/tenant-api.service';
import { QualityApiService } from '../../../core/services/quality-api.service';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './sidebar.component.html',
  styleUrl: './sidebar.component.css',
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  readonly tenantService = inject(TenantApiService);
  readonly qualityService = inject(QualityApiService);
  private readonly router = inject(Router);

  readonly mobileOpen = input<boolean>(false);
  readonly closeNav = output<void>();

  // Desktop Collapsible state (can be toggled by user)
  readonly isCollapsed = signal<boolean>(false);

  // Active Tenant details
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

  readonly activeModules = computed<string[]>(() => {
    const active = this.activeTenant();
    if (active?.active_modules && active.active_modules.length > 0) {
      return active.active_modules;
    }
    // Default fallback to all core modules
    return ['epr', 'ppwr', 'dpp', 'lca'];
  });

  readonly openGapsCount = computed(() => {
    return this.qualityService.issues().filter((i) => i.status !== 'resolved').length;
  });

  readonly currentUser = this.authService.currentUser;
  readonly isSuperAdmin = this.authService.isSuperAdmin;

  isModuleActive(moduleKey: string): boolean {
    return this.activeModules().includes(moduleKey.toLowerCase());
  }

  toggleCollapse(): void {
    this.isCollapsed.update((v) => !v);
  }

  handleLinkClick(): void {
    this.closeNav.emit();
  }

  logout(): void {
    this.authService.logout();
    this.closeNav.emit();
    this.router.navigate(['/sign-in']);
  }
}
