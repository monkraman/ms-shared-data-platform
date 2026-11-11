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
  SyncSystem,
  DataSource,
  SyncStarted,
  ImportHistoryRow,
  GapStatus,
  Severity,
  UserCreate,
  UserRow,
} from './contracts';

/**
 * One method per endpoint the screens use. Screens call these, never HTTP directly; each
 * goes through the typed `ApiClient`, so paths, parameters and bodies are checked against
 * the backend's OpenAPI schema.
 */
@Injectable({ providedIn: 'root' })
export class PlatformApi {
  private readonly api = inject(ApiClient);

  // Reference
  countries = (): Observable<Country[]> => this.api.get('/api/v1/reference/countries');
  modules = (): Observable<ModuleInfo[]> => this.api.get('/api/v1/reference/modules');
  fields = (): Observable<Record<string, FieldInfo>> => this.api.get('/api/v1/reference/fields');

  // Screen 2 (backend built)
  workspaces = (query: { q?: string; status?: WorkspaceStatus } = {}): Observable<Workspace[]> =>
    this.api.get('/api/v1/admin/tenants', { query });
  createWorkspace = (body: WorkspaceCreate): Observable<Workspace> => this.api.post('/api/v1/admin/tenants', { body });
  updateWorkspace = (id: string, body: WorkspacePatch): Observable<Workspace> =>
    this.api.patch('/api/v1/admin/tenants/{tenant_id}', { path: { tenant_id: id }, body });

  // Screen 9 (users; backend built)
  users = (): Observable<UserRow[]> => this.api.get('/api/v1/auth/users');
  createUser = (body: UserCreate): Observable<UserRow> => this.api.post('/api/v1/auth/users', { body });

  // Screen 3
  dataPoints = (): Observable<DataPointDictionary> => this.api.get('/api/v1/admin/data-points');

  // Screen 4
  products = (query: { q?: string } = {}): Observable<ProductSummary[]> => this.api.get('/api/v1/products', { query });
  product = (sku: string): Observable<Product> => this.api.get('/api/v1/products/{sku}', { path: { sku } });
  createProduct = (body: ProductCreate): Observable<Product> => this.api.post('/api/v1/products', { body });

  // Screen 5
  startImport = (body: ImportCreate): Observable<ImportDraft> => this.api.post('/api/v1/imports', { body });
  /** Simulated ERP or PLM sync: same draft → mapping → approve steps as a file. */
  syncImport = (system: SyncSystem): Observable<ImportDraft> =>
    this.api.post('/api/v1/imports/sync', { body: { system } });
  mapImport = (id: string, mapping: Record<string, string | null>): Observable<ImportPreview> =>
    this.api.put('/api/v1/imports/{batch_id}/mapping', { path: { batch_id: id }, body: { mapping } });
  approveImport = (id: string): Observable<{ job_id: string }> =>
    this.api.post('/api/v1/imports/{batch_id}/approve', { path: { batch_id: id } });
  importHistory = (): Observable<ImportHistoryRow[]> => this.api.get('/api/v1/imports');
  job = (jobId: string): Observable<JobStatus> => this.api.get('/api/v1/jobs/{job_id}', { path: { job_id: jobId } });

  // Screen 6
  gapRules = (): Observable<GapRule[]> => this.api.get('/api/v1/admin/gap-rules');
  createGapRule = (body: GapRuleCreate): Observable<GapRule> => this.api.post('/api/v1/admin/gap-rules', { body });
  updateGapRule = (id: string, body: { active?: boolean }): Observable<GapRule> =>
    this.api.patch('/api/v1/admin/gap-rules/{rule_id}', { path: { rule_id: id }, body });

  // Screen 7
  gaps = (query: { status?: GapStatus; severity?: Severity } = {}): Observable<Gap[]> =>
    this.api.get('/api/v1/gaps', { query });
  resolveGap = (id: string, body: GapResolve): Observable<Gap> =>
    this.api.post('/api/v1/gaps/{gap_id}/resolve', { path: { gap_id: id }, body });

  // Screen 8
  dataOverview = (): Observable<DataOverview> => this.api.get('/api/v1/data-overview');

  // Screen 18 (data sources)
  dataSources = (): Observable<DataSource[]> => this.api.get('/api/v1/data-sources');
  connectSource = (system: SyncSystem): Observable<DataSource> =>
    this.api.post('/api/v1/data-sources', { body: { system } });
  setAutoApprove = (id: string, auto_approve: boolean): Observable<DataSource> =>
    this.api.patch('/api/v1/data-sources/{source_id}', { path: { source_id: id }, body: { auto_approve } });
  syncSource = (id: string): Observable<SyncStarted> =>
    this.api.post('/api/v1/data-sources/{source_id}/sync', { path: { source_id: id } });
}
