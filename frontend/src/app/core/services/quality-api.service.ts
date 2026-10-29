import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { TenantApiService } from './tenant-api.service';
import { AuthService } from './auth.service';

export interface DataQualityIssue {
  id: string;
  tenant_id: string;
  rule_code: string;
  rule_title: string;
  severity: 'blocker' | 'warning' | 'info';
  entity_type: string;
  entity_id: string;
  field_name: string;
  current_value: string;
  description: string;
  suggested_source_action: string;
  source_spec_reference: string;
  status: 'open' | 'pending_source_update' | 'resolved' | 'suppressed';
  assigned_to?: string;
}

export interface SourceWorklistExport {
  export_timestamp: string;
  tenant_id: string;
  total_open_items: number;
  tickets: Array<{
    ticket_id: string;
    target_system: string;
    spec_id: string;
    action_required: string;
    sku: string;
    severity: string;
  }>;
}

@Injectable({
  providedIn: 'root',
})
export class QualityApiService {
  private readonly http = inject(HttpClient);
  private readonly tenantService = inject(TenantApiService);
  private readonly authService = inject(AuthService);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;

  readonly issues = signal<DataQualityIssue[]>([]);
  readonly selectedIssue = signal<DataQualityIssue | null>(null);
  readonly loading = signal<boolean>(false);
  readonly worklistExport = signal<SourceWorklistExport | null>(null);

  private getHeaders(): HttpHeaders {
    let headers = new HttpHeaders({
      'X-Tenant-ID': this.tenantService.activeTenantId(),
    });
    const token = this.authService.getToken();
    if (token) {
      headers = headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }

  loadIssues(): Observable<DataQualityIssue[]> {
    this.loading.set(true);
    return this.http
      .get<DataQualityIssue[]>(`${this.baseUrl}/api/v1/quality/issues`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (res) => {
            this.issues.set(res);
            if (res.length > 0 && !this.selectedIssue()) {
              this.selectedIssue.set(res[0]);
            }
            this.loading.set(false);
          },
          error: () => this.loading.set(false),
        })
      );
  }

  selectIssue(issue: DataQualityIssue): void {
    this.selectedIssue.set(issue);
  }

  proposeCorrection(issueId: string, proposedVal: string, justification: string): Observable<DataQualityIssue> {
    return this.http
      .post<DataQualityIssue>(
        `${this.baseUrl}/api/v1/quality/propose-correction`,
        {
          issue_id: issueId,
          proposed_value: proposedVal,
          justification: justification,
          proposer_email: 'compliance@monkspaces.com',
        },
        { headers: this.getHeaders() }
      )
      .pipe(
        tap({
          next: () => this.loadIssues().subscribe(),
        })
      );
  }

  exportSourceWorklist(): Observable<SourceWorklistExport> {
    return this.http
      .get<SourceWorklistExport>(`${this.baseUrl}/api/v1/quality/source-worklist/export`, {
        headers: this.getHeaders(),
      })
      .pipe(
        tap({
          next: (res) => this.worklistExport.set(res),
        })
      );
  }
}
