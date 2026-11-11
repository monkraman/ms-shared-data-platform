import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { ClientWorkspaceProfile } from '../models/tenant.model';

export interface BackendTenantRecord {
  id: string;
  name: string;
  sector: string;
  tier?: string;
  primary_jurisdiction?: string;
  active_jurisdictions?: string[];
  active_modules?: string[];
  active_products_count?: number;
  open_quality_issues_count?: number;
  source_systems?: string[];
  logo_url?: string;
  theme_color?: string;
  created_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TenantApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;

  private getInitialTenantId(): string {
    try {
      // The signed-in profile (SessionService) names the user's own workspace.
      const profileRaw = sessionStorage.getItem('ch.profile');
      const slug = profileRaw ? JSON.parse(profileRaw)?.organisation_slug : null;
      if (slug) {
        return slug;
      }
      const saved = localStorage.getItem('compliance_hub_active_tenant');
      if (saved) {
        return saved;
      }
    } catch {
      // Ignore
    }
    return 'khc-europe';
  }

  readonly activeTenantId = signal<string>(this.getInitialTenantId());
  readonly tenants = signal<BackendTenantRecord[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  constructor() {
    // Purge any legacy browser localStorage cache so PostgreSQL is the single source of truth
    try {
      localStorage.removeItem('compliance_hub_custom_tenants');
    } catch {
      // Ignore in non-browser environments
    }
  }

  /**
   * Fetch all active tenants from FastAPI PostgreSQL database
   */
  loadTenants(force = false): Observable<BackendTenantRecord[]> {
    if (!force && this.tenants().length > 0) {
      return of(this.tenants());
    }
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<BackendTenantRecord[]>(`${this.baseUrl}/api/v1/tenants`).pipe(
      tap({
        next: (res) => {
          this.tenants.set(res);
          this.loading.set(false);
          if (res.length > 0 && !this.activeTenantId()) {
            this.activeTenantId.set(res[0].id);
          }
        },
        error: (err) => {
          this.error.set(err.message || 'Failed to connect to backend tenant service');
          this.loading.set(false);
        },
      })
    );
  }

  /**
   * Create or Onboard a new tenant workspace directly in the PostgreSQL database
   */
  createTenantWorkspace(data: {
    id: string;
    name: string;
    sector: string;
    organisationSize?: 'L' | 'S';
    rpdOrganisationId?: string | null;
    primaryCurrency?: string;
    activeJurisdictions?: string[];
    tier?: string;
    logoUrl?: string;
    themeColor?: string;
    adminEmail?: string;
    adminName?: string;
    adminPassword?: string;
  }): Observable<any> {
    const payload = {
      id: data.id,
      name: data.name,
      sector: data.sector,
      organisation_size: data.organisationSize || 'L',
      rpd_organisation_id: data.rpdOrganisationId || null,
      primary_currency: data.primaryCurrency || 'EUR',
      active_jurisdictions: data.activeJurisdictions || ['FR'],
      tier: data.tier || 'enterprise',
      logo_url: data.logoUrl || null,
      theme_color: data.themeColor || '#111827',
      admin_email: data.adminEmail || null,
      admin_name: data.adminName || null,
      admin_password: data.adminPassword || 'password123',
    };

    return this.http.post(`${this.baseUrl}/api/v1/tenants`, payload).pipe(
      tap(() => {
        this.activeTenantId.set(data.id);
        this.loadTenants().subscribe();
      })
    );
  }

  /**
   * Update active compliance and intelligence modules (EPR, PPWR, DPP, LCA) for a tenant workspace
   */
  updateTenantModules(tenantId: string, modules: string[]): Observable<BackendTenantRecord> {
    return this.http.patch<BackendTenantRecord>(`${this.baseUrl}/api/v1/tenants/${tenantId}/modules`, {
      active_modules: modules,
    }).pipe(
      tap((updated) => {
        this.tenants.update((list) =>
          list.map((t) => (t.id === tenantId ? { ...t, active_modules: updated.active_modules } : t))
        );
      })
    );
  }

  /**
   * Update tenant branding, logo, name, or modules
   */
  updateTenantWorkspace(tenantId: string, data: Partial<BackendTenantRecord>): Observable<BackendTenantRecord> {
    return this.http.patch<BackendTenantRecord>(`${this.baseUrl}/api/v1/tenants/${tenantId}`, data).pipe(
      tap((updated) => {
        this.tenants.update((list) =>
          list.map((t) => (t.id === tenantId ? { ...t, ...updated } : t))
        );
      })
    );
  }

  setActiveTenant(id: string): void {
    this.activeTenantId.set(id);
    try {
      localStorage.setItem('compliance_hub_active_tenant', id);
    } catch {
      // Ignore
    }
  }
}
