import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import {
  Country,
  DataOverview,
  DataPointDictionary,
  FieldInfo,
  Gap,
  GapResolve,
  GapRule,
  GapRuleCreate,
  ImportCreate,
  ImportDraft,
  ImportPreview,
  JobStatus,
  ModuleInfo,
  Product,
  ProductCreate,
  ProductSummary,
  Workspace,
  WorkspaceCreate,
  WorkspacePatch,
  WorkspaceStatus,
} from './contracts';

/**
 * One method per endpoint in `contracts.ts` (screens 2–8). Screens call these, never
 * HTTP directly. When an endpoint ships in the backend, replace its `api.call` with the
 * typed `api.get/post/...` and delete its mock route.
 */
@Injectable({ providedIn: 'root' })
export class PlatformApi {
  private readonly api = inject(ApiClient);

  // Reference
  countries = (): Observable<Country[]> => this.api.get('/api/v1/reference/countries');
  modules = (): Observable<ModuleInfo[]> => this.api.get('/api/v1/reference/modules');
  fields = (): Observable<Record<string, FieldInfo>> => this.api.call('GET', '/api/v1/reference/fields');

  // Screen 2 (backend built)
  workspaces = (query: { q?: string; status?: WorkspaceStatus } = {}): Observable<Workspace[]> =>
    this.api.get('/api/v1/admin/tenants', { query });
  createWorkspace = (body: WorkspaceCreate): Observable<Workspace> => this.api.post('/api/v1/admin/tenants', { body });
  updateWorkspace = (id: string, body: WorkspacePatch): Observable<Workspace> =>
    this.api.patch('/api/v1/admin/tenants/{tenant_id}', { path: { tenant_id: id }, body });

  // Screen 3
  dataPoints = (): Observable<DataPointDictionary> => this.api.call('GET', '/api/v1/admin/data-points');

  // Screen 4
  products = (query: { q?: string } = {}): Observable<ProductSummary[]> =>
    this.api.call('GET', '/api/v1/products', { query });
  product = (sku: string): Observable<Product> => this.api.call('GET', '/api/v1/products/{sku}', { path: { sku } });
  createProduct = (body: ProductCreate): Observable<Product> => this.api.call('POST', '/api/v1/products', { body });

  // Screen 5
  startImport = (body: ImportCreate): Observable<ImportDraft> => this.api.call('POST', '/api/v1/imports', { body });
  mapImport = (id: string, mapping: Record<string, string | null>): Observable<ImportPreview> =>
    this.api.call('PUT', '/api/v1/imports/{id}/mapping', { path: { id }, body: { mapping } });
  approveImport = (id: string): Observable<{ job_id: string }> =>
    this.api.call('POST', '/api/v1/imports/{id}/approve', { path: { id } });
  job = (jobId: string): Observable<JobStatus> => this.api.call('GET', '/api/v1/jobs/{job_id}', { path: { job_id: jobId } });

  // Screen 6
  gapRules = (): Observable<GapRule[]> => this.api.call('GET', '/api/v1/admin/gap-rules');
  createGapRule = (body: GapRuleCreate): Observable<GapRule> => this.api.call('POST', '/api/v1/admin/gap-rules', { body });
  updateGapRule = (id: string, body: Partial<GapRule>): Observable<GapRule> =>
    this.api.call('PATCH', '/api/v1/admin/gap-rules/{id}', { path: { id }, body });

  // Screen 7
  gaps = (query: { status?: string; severity?: string } = {}): Observable<Gap[]> =>
    this.api.call('GET', '/api/v1/gaps', { query });
  resolveGap = (id: string, body: GapResolve): Observable<Gap> =>
    this.api.call('POST', '/api/v1/gaps/{id}/resolve', { path: { id }, body });

  // Screen 8
  dataOverview = (): Observable<DataOverview> => this.api.call('GET', '/api/v1/data-overview');
}
