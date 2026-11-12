import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiClient } from './api-client';
import {
  ActionCreate,
  ActionItem,
  ActionPatch,
  Country,
  DataOverview,
  DataPointDictionary,
  DataSource,
  Declaration,
  DeclarationRow,
  EprResult,
  FieldInfo,
  Gap,
  GapResolve,
  GapRule,
  GapRuleCreate,
  GapStatus,
  HomeSummary,
  Horizon,
  ImportCreate,
  ImportDraft,
  ImportHistoryRow,
  ImportPreview,
  Insights,
  JobStatus,
  Member,
  MemberCreate,
  MembershipIn,
  ModuleInfo,
  Product,
  ProductCreate,
  ProductHistory,
  ProductSummary,
  Regime,
  ScenarioChange,
  ScenarioResult,
  Severity,
  SyncStarted,
  SyncSystem,
  UserCreate,
  UserPatch,
  UserRow,
  ValidationIssue,
  Workspace,
  WorkspaceCreate,
  WorkspacePatch,
  WorkspaceStatus,
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

  // Screen 9 (users and access)
  users = (): Observable<UserRow[]> => this.api.get('/api/v1/admin/users');
  createUser = (body: UserCreate): Observable<UserRow> => this.api.post('/api/v1/admin/users', { body });
  updateUser = (id: string, body: UserPatch): Observable<UserRow> =>
    this.api.patch('/api/v1/admin/users/{user_id}', { path: { user_id: id }, body });
  setMemberships = (id: string, body: MembershipIn[]): Observable<UserRow> =>
    this.api.put('/api/v1/admin/users/{user_id}/memberships', { path: { user_id: id }, body });
  setPassword = (id: string, password: string): Observable<unknown> =>
    this.api.post('/api/v1/admin/users/{user_id}/password', { path: { user_id: id }, body: { password } });
  team = (): Observable<Member[]> => this.api.get('/api/v1/team');
  addMember = (body: MemberCreate): Observable<Member> => this.api.post('/api/v1/team', { body });
  changeRole = (id: string, role: MemberCreate['role']): Observable<Member> =>
    this.api.patch('/api/v1/team/{user_id}', { path: { user_id: id }, body: { role } });
  removeMember = (id: string): Observable<unknown> => this.api.delete('/api/v1/team/{user_id}', { path: { user_id: id } });
  resetMemberPassword = (id: string, password: string): Observable<unknown> =>
    this.api.post('/api/v1/team/{user_id}/password', { path: { user_id: id }, body: { password } });

  // Screen 3
  dataPoints = (): Observable<DataPointDictionary> => this.api.get('/api/v1/admin/data-points');

  // Screen 4
  products = (query: { q?: string } = {}): Observable<ProductSummary[]> => this.api.get('/api/v1/products', { query });
  product = (sku: string): Observable<Product> => this.api.get('/api/v1/products/{sku}', { path: { sku } });
  createProduct = (body: ProductCreate): Observable<Product> => this.api.post('/api/v1/products', { body });
  editProduct = (sku: string, values: Record<string, string | null>): Observable<Product> =>
    this.api.patch('/api/v1/products/{sku}', { path: { sku }, body: { values } });
  editComponent = (sku: string, code: string, values: Record<string, string | null>): Observable<Product> =>
    this.api.patch('/api/v1/products/{sku}/components/{code}', { path: { sku, code }, body: { values } });
  addComponent = (sku: string, values: Record<string, string | null>): Observable<Product> =>
    this.api.post('/api/v1/products/{sku}/components', { path: { sku }, body: { values } });
  removeComponent = (sku: string, code: string): Observable<Product> =>
    this.api.delete('/api/v1/products/{sku}/components/{code}', { path: { sku, code } });
  productHistory = (sku: string): Observable<ProductHistory[]> =>
    this.api.get('/api/v1/products/{sku}/history', { path: { sku } });

  // Data validation
  validation = (): Observable<ValidationIssue[]> => this.api.get('/api/v1/validation');
  applyCorrections = (ids?: string[]): Observable<{ applied: number; skipped: number }> =>
    this.api.post('/api/v1/validation/apply', { body: { ids: ids ?? null } });

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
  /** Fills estimable gaps (all open ones when no ids) with their proposed values. */
  fillEstimates = (gapIds?: string[]): Observable<{ filled: number; skipped: number }> =>
    this.api.post('/api/v1/gaps/estimate', { body: { gap_ids: gapIds ?? null } });

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

  // Screens 12–13 (compliance)
  regimes = (): Observable<Regime[]> => this.api.get('/api/v1/modules/regimes');
  epr = (regime: 'epr_uk' | 'epr_dk' | 'sb54_ca', year?: string): Observable<EprResult> =>
    this.api.get('/api/v1/modules/epr/{regime}', { path: { regime }, query: { year } });
  declarations = (): Observable<DeclarationRow[]> => this.api.get('/api/v1/modules/ppwr/declarations');
  declaration = (sku: string, lang: 'en' | 'da'): Observable<Declaration> =>
    this.api.get('/api/v1/modules/ppwr/declarations/{sku}', { path: { sku }, query: { lang } });

  // Home
  home = (): Observable<HomeSummary> => this.api.get('/api/v1/home');

  // Screen 14 (insights, scenarios, actions)
  insights = (regime: 'epr_uk' | 'epr_dk' | 'sb54_ca', year?: string): Observable<Insights> =>
    this.api.get('/api/v1/modules/epr/{regime}/insights', { path: { regime }, query: { year } });
  scenario = (regime: 'epr_uk' | 'epr_dk' | 'sb54_ca', changes: ScenarioChange[], year?: string): Observable<ScenarioResult> =>
    this.api.post('/api/v1/modules/epr/{regime}/scenario', { path: { regime }, body: { changes, year: year ?? null } });
  actions = (): Observable<ActionItem[]> => this.api.get('/api/v1/actions');
  createAction = (body: ActionCreate): Observable<ActionItem> => this.api.post('/api/v1/actions', { body });
  updateAction = (id: string, body: ActionPatch): Observable<ActionItem> =>
    this.api.patch('/api/v1/actions/{action_id}', { path: { action_id: id }, body });

  // Horizon scanning
  horizon = (): Observable<Horizon> => this.api.get('/api/v1/modules/horizon');
  setLeadTime = (lead_months: number): Observable<Horizon> =>
    this.api.put('/api/v1/modules/horizon/settings', { body: { lead_months } });
}
