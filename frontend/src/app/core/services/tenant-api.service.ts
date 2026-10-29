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

  readonly activeTenantId = signal<string>('khc-europe');
  readonly tenants = signal<BackendTenantRecord[]>([]);
  readonly loading = signal<boolean>(false);
  readonly error = signal<string | null>(null);

  /**
   * Fetch all active tenants from FastAPI
   */
  loadTenants(): Observable<BackendTenantRecord[]> {
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
