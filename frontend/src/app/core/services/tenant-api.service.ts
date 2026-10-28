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
  active_jurisdictions?: string[];
  created_at?: string;
  source_systems?: Array<{
    system_type: string;
    status: string;
    last_synced_at?: string;
  }>;
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
   * Create or Onboard a new tenant workspace
   */
  createTenantWorkspace(profile: ClientWorkspaceProfile): Observable<any> {
    const payload = {
      id: profile.id,
      name: profile.name,
      sector: profile.sector,
      organisation_size: profile.organisationSize,
      rpd_organisation_id: profile.rpdOrganisationId || null,
      primary_currency: profile.primaryCurrency,
      active_jurisdictions: profile.markets.filter(m => m.selected).map(m => m.regulationCode),
    };

    return this.http.post(`${this.baseUrl}/api/v1/tenants`, payload).pipe(
      tap(() => {
        this.activeTenantId.set(profile.id);
        this.loadTenants().subscribe();
      })
    );
  }

  setActiveTenant(id: string): void {
    this.activeTenantId.set(id);
  }
}
