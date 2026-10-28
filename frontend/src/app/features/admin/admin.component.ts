import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface Organisation {
  id: string;
  slug: string;
  legalName: string;
  sector: string;
  tier: 'enterprise' | 'pilot' | 'demo' | 'suspended';
  primaryCurrency: string;
  activeJurisdictions: string[];
  productsCount: number;
  qualityIssues: number;
  lastSync: string;
  status: 'healthy' | 'warning' | 'error' | 'inactive';
  members: number;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  resource: string;
  orgSlug: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'critical';
}

type AdminTab = 'organisations' | 'users' | 'ingestion' | 'tariffs' | 'audit';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin.component.html',
  styleUrl: './admin.component.css',
})
export class AdminComponent {
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);

  readonly activeTab = signal<AdminTab>('organisations');

  readonly organisations = signal<Organisation[]>([
    {
      id: 'org-001',
      slug: 'khc-europe',
      legalName: 'Kraft Heinz Europe B.V.',
      sector: 'Food & Beverage',
      tier: 'enterprise',
      primaryCurrency: 'EUR',
      activeJurisdictions: ['GB', 'FR', 'DE', 'ES'],
      productsCount: 2847,
      qualityIssues: 147,
      lastSync: '2 min ago',
      status: 'healthy',
      members: 12,
    },
    {
      id: 'org-002',
      slug: 'aurora-pack',
      legalName: 'Aurora Packaging Group Ltd',
      sector: 'Packaging / Manufacturing',
      tier: 'pilot',
      primaryCurrency: 'GBP',
      activeJurisdictions: ['GB'],
      productsCount: 342,
      qualityIssues: 38,
      lastSync: '1 hr ago',
      status: 'warning',
      members: 4,
    },
    {
      id: 'org-003',
      slug: 'nestle-nordic',
      legalName: 'Nordic FMCG Solutions AB',
      sector: 'Food & Beverage',
      tier: 'demo',
      primaryCurrency: 'EUR',
      activeJurisdictions: ['SE', 'DK', 'NO'],
      productsCount: 89,
      qualityIssues: 5,
      lastSync: '6 hr ago',
      status: 'healthy',
      members: 2,
    },
  ]);

  readonly auditLog = signal<AuditEntry[]>([
    { id: 'a1', actor: 'platform.admin', action: 'org.created', resource: 'Organisation: aurora-pack', orgSlug: 'aurora-pack', timestamp: '2026-10-28 14:31', severity: 'info' },
    { id: 'a2', actor: 'sarah.mitchell@khc.com', action: 'data.imported', resource: 'Batch: Trace One PLM full refresh (2847 SKUs)', orgSlug: 'khc-europe', timestamp: '2026-10-28 12:15', severity: 'info' },
    { id: 'a3', actor: 'system', action: 'quality.issue_detected', resource: '147 issues detected in khc-europe after ingestion', orgSlug: 'khc-europe', timestamp: '2026-10-28 12:16', severity: 'warning' },
    { id: 'a4', actor: 'platform.admin', action: 'tariff.updated', resource: 'UK Defra RPD 2026 H2 fee schedule', orgSlug: 'all', timestamp: '2026-10-27 09:00', severity: 'info' },
    { id: 'a5', actor: 'james.patel@khc.com', action: 'report.generated', resource: 'UK RPD H1 2026 submission pack', orgSlug: 'khc-europe', timestamp: '2026-10-26 16:45', severity: 'info' },
  ]);

  // Summary stats
  readonly totalOrgs = computed(() => this.organisations().length);
  readonly totalProducts = computed(() => this.organisations().reduce((s, o) => s + o.productsCount, 0));
  readonly totalIssues = computed(() => this.organisations().reduce((s, o) => s + o.qualityIssues, 0));
  readonly orgsWithWarning = computed(() => this.organisations().filter(o => o.status === 'warning' || o.status === 'error').length);

  setTab(tab: AdminTab): void {
    this.activeTab.set(tab);
  }

  impersonateOrg(slug: string): void {
    this.router.navigate(['/dashboard']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/sign-in']);
  }

  getTierClass(tier: string): string {
    return `tier-${tier}`;
  }

  getStatusClass(status: string): string {
    return `status-${status}`;
  }
}

