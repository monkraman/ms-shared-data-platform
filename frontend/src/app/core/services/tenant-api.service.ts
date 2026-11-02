import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { ClientWorkspaceProfile } from '../models/tenant.model';

export interface BackendTenantRecord {
  id: string;
  name: string;
  sector: string;
  tier?: string;
  primary_jurisdiction?: string;
  active_jurisdictions?: string[];
  active_products_count?: number;
  open_quality_issues_count?: number;
  source_systems?: string[];
  created_at?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TenantApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;
  private readonly STORAGE_KEY = 'compliance_hub_custom_tenants';

  readonly activeTenantId = signal<string>('khc-europe');
  readonly tenants = signal<BackendTenantRecord[]>(this.getStoredCustomTenants());
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Retrieve any client workspaces saved in local persistence
   */
  getStoredCustomTenants(): BackendTenantRecord[] {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Persist custom workspace to browser localStorage
   */
  saveCustomTenantLocally(tenant: BackendTenantRecord): void {
    try {
      const existing = this.getStoredCustomTenants();
      const updated = existing.filter((t) => t.id !== tenant.id);
      updated.push(tenant);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save tenant to localStorage', e);
    }
  }

  /**
   * Fetch all active tenants from FastAPI and merge with locally persisted workspaces
   */
  loadTenants(): Observable<BackendTenantRecord[]> {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<BackendTenantRecord[]>(`${this.baseUrl}/api/v1/tenants`).pipe(
      tap({
        next: (res) => {
          const localCustom = this.getStoredCustomTenants();
          const map = new Map<string, BackendTenantRecord>();

          // 1. Add server tenants
          res.forEach((t) => map.set(t.id, t));

          // 2. Merge local custom tenants, and re-sync to server if missing
          localCustom.forEach((localT) => {
            if (!map.has(localT.id)) {
              map.set(localT.id, localT);
              this.syncTenantToBackend(localT);
            }
          });

          const merged = Array.from(map.values());
          this.tenants.set(merged);
          this.loading.set(false);
          if (merged.length > 0 && !this.activeTenantId()) {
            this.activeTenantId.set(merged[0].id);
          }
        },
        error: (err) => {
          const localCustom = this.getStoredCustomTenants();
          if (localCustom.length > 0) {
            this.tenants.set(localCustom);
          }
          this.error.set(err.message || 'Failed to connect to backend tenant service');
          this.loading.set(false);
        },
      })
    );
  }

  /**
   * Push a locally provisioned tenant to backend if backend was restarted
   */
  private syncTenantToBackend(t: BackendTenantRecord): void {
    const payload = {
      id: t.id,
      name: t.name,
      sector: t.sector,
      tier: t.tier || 'enterprise',
      active_jurisdictions: t.active_jurisdictions || [t.primary_jurisdiction || 'GB'],
      primary_currency: 'EUR',
      organisation_size: 'L',
    };
    this.http.post(`${this.baseUrl}/api/v1/tenants`, payload).subscribe({
      next: () => console.log(`Auto-synced custom tenant '${t.id}' to backend store.`),
      error: (e) => console.warn(`Could not sync tenant '${t.id}' to backend:`, e),
    });
  }

  /**
   * Create or Onboard a new tenant workspace and optional organization admin
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
    adminEmail?: string;
    adminName?: string;
    adminPassword?: string;
  }): Observable<any> {
    const localRecord: BackendTenantRecord = {
      id: data.id,
      name: data.name,
      sector: data.sector,
      tier: data.tier || 'enterprise',
      primary_jurisdiction: (data.activeJurisdictions && data.activeJurisdictions[0]) || 'GB',
      active_jurisdictions: data.activeJurisdictions || ['GB'],
      active_products_count: 0,
      open_quality_issues_count: 0,
      source_systems: ['Trace One (Devex PLM)', 'Snowflake Analytics', 'CSV Feed'],
      created_at: new Date().toISOString(),
    };
    this.saveCustomTenantLocally(localRecord);

    const payload = {
      id: data.id,
      name: data.name,
      sector: data.sector,
      organisation_size: data.organisationSize || 'L',
      rpd_organisation_id: data.rpdOrganisationId || null,
      primary_currency: data.primaryCurrency || 'EUR',
      active_jurisdictions: data.activeJurisdictions || ['FR'],
      tier: data.tier || 'enterprise',
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

  setActiveTenant(id: string): void {
    this.activeTenantId.set(id);
  }
}
