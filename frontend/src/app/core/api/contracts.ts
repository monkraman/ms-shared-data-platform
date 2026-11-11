/**
 * API contracts for screens 2–8: the endpoints and shapes the backend implements next.
 *
 * Until a screen's backend ships, the mock API (`core/api/mock`) answers these endpoints
 * with fixture data. When it ships, the endpoint moves into the OpenAPI schema
 * (`npm run api:generate`), the screen's service switches to the typed `ApiClient`
 * methods, and the mock route is deleted. Components do not change.
 *
 * Field names follow the backend's snake_case JSON.
 */

// --- Reference data ---------------------------------------------------------------

export interface Country {
  code: string;
  name: string;
  eu: boolean;
}

export type ModuleId = 'EPR' | 'PPWR' | 'DPP' | 'LCA';

export interface ModuleInfo {
  id: ModuleId;
  name: string;
}

/** GET /api/v1/reference/fields → Record<key, FieldInfo>: every collected field and its data point. */
export interface FieldInfo {
  label: string;
  dp: string | null;
  level: string;
  type: string;
  allowed: string | null;
}

// --- Screen 2: client workspaces (SuperAdmin) -------------------------------------
// GET    /api/v1/admin/tenants?q=&status=      → Workspace[]
// POST   /api/v1/admin/tenants                 → Workspace           (WorkspaceCreate)
// GET    /api/v1/admin/tenants/{id}            → Workspace
// PATCH  /api/v1/admin/tenants/{id}            → Workspace           (WorkspacePatch)
// GET    /api/v1/reference/countries           → Country[]
// GET    /api/v1/reference/modules             → ModuleInfo[]

export type WorkspaceStatus = 'draft' | 'active' | 'suspended';

export interface LegalEntity {
  name: string;
  country: string;
  registration_number: string;
}

export interface Workspace {
  id: string;
  slug: string;
  name: string;
  sector: string;
  status: WorkspaceStatus;
  brand_color: string;
  countries: string[];
  modules: ModuleId[];
  legal_entities: LegalEntity[];
  user_count: number;
  last_activity_at: string | null;
  created_at: string;
}

export interface WorkspaceCreate {
  name: string;
  slug: string;
  sector: string;
  brand_color: string;
  legal_entities: LegalEntity[];
  countries: string[];
  modules: ModuleId[];
  admin: { full_name: string; email: string };
}

export interface WorkspacePatch {
  status?: WorkspaceStatus;
  countries?: string[];
  modules?: ModuleId[];
}

// --- Screen 3: data point dictionary (SuperAdmin) ---------------------------------
// GET /api/v1/admin/data-points → DataPointDictionary

export type SourceId = 'erp' | 'supplier' | 'plm' | 'man';
export type OutputId = 'rep' | 'fee' | 'doc' | 'lab' | 'evid' | 'dpp';

export interface DataPoint {
  code: string;
  name: string;
  description: string;
  source: SourceId;
  system_field: string | null;
  outputs: OutputId[];
  countries: string[];
  applies_from: string | null;
}

export interface DataPointDictionary {
  data_points: DataPoint[];
  sources: Record<SourceId, string>;
  outputs: Record<OutputId, { name: string; regulation: string }>;
  countries: Country[];
}

// --- Screen 4: products and packaging (Org Admin) ----------------------------------
// GET  /api/v1/products?q=          → ProductSummary[]
// GET  /api/v1/products/{sku}       → Product
// POST /api/v1/products             → Product          (ProductCreate)

export interface FieldValue {
  dp: string | null;
  value: string;
}

export type PackagingLevel = 'Primary' | 'Secondary' | 'Transit';

export interface Component {
  id: string;
  name: string;
  level: PackagingLevel | string;
  units_per_pack: number;
  material: string;
  polymer: string;
  weight_g: number | null;
  weight_source: string;
  recycled_content_pct: number | null;
  recyclability: string;
  supplier_id: string;
  fields: Record<string, FieldValue>;
}

export interface SalesLine {
  id: string;
  period: string;
  channel: string;
  units_placed: number;
  units_exported: number;
}

export interface ProductSummary {
  sku: string;
  name: string;
  brand: string;
  gtin: string;
  component_count: number;
  packaging_g_per_unit: number;
  materials: string[];
  completeness_pct: number;
  open_gaps: number;
}

export interface Product extends ProductSummary {
  fields: Record<string, FieldValue>;
  passport: Record<string, FieldValue>;
  components: Component[];
  sales: SalesLine[];
}

export interface ProductCreate {
  sku: string;
  name: string;
  brand: string;
  gtin: string;
  components: {
    name: string;
    level: PackagingLevel;
    units_per_pack: number;
    material: string;
    polymer: string;
    weight_g: number;
    recycled_content_pct: number;
  }[];
}

// --- Screen 5: import (Org Admin) ----------------------------------------------------
// POST /api/v1/imports                       → ImportDraft     (ImportCreate)
// PUT  /api/v1/imports/{id}/mapping          → ImportPreview   ({ mapping })
// POST /api/v1/imports/{id}/approve          → { job_id }      (202)
// GET  /api/v1/jobs/{job_id}                 → Job

export interface ImportCreate {
  filename: string;
  columns: string[];
  rows: string[][];
}

export interface ImportDraft {
  id: string;
  filename: string;
  columns: string[];
  row_count: number;
  /** column → target field key (or null to skip), suggested from the column names */
  suggested_mapping: Record<string, string | null>;
  targets: { key: string; label: string; dp: string | null; required: boolean }[];
}

export interface ImportIssue {
  row: number;
  column: string;
  message: string;
}

export interface ImportPreview {
  id: string;
  valid_rows: number;
  invalid_rows: number;
  new_products: number;
  updated_products: number;
  issues: ImportIssue[];
}

export interface JobStatus {
  id: string;
  kind: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  progress: number;
  result: Record<string, unknown> | null;
  error: string | null;
}

// --- Screen 6: gap rule library (SuperAdmin) -----------------------------------------
// GET   /api/v1/admin/gap-rules        → GapRule[]
// POST  /api/v1/admin/gap-rules        → GapRule        (GapRuleCreate)
// PATCH /api/v1/admin/gap-rules/{id}   → GapRule        ({ active })

export type Severity = 'blocker' | 'warning';

export type RuleCheck =
  | { kind: 'missing' }
  | { kind: 'in'; values: string[] }
  | { kind: 'certificate_missing' }
  | { kind: 'pfas_missing' };

export interface GapRule {
  id: string;
  name: string;
  data_point: string;
  field: string;
  check: RuleCheck;
  severity: Severity;
  modules: ModuleId[];
  active: boolean;
}

export type GapRuleCreate = Omit<GapRule, 'id' | 'active'>;

// --- Screen 7: gap worklist (Org Admin) -----------------------------------------------
// GET  /api/v1/gaps?status=&severity=   → Gap[]
// POST /api/v1/gaps/{id}/resolve        → Gap          (GapResolve)

export type GapStatus = 'open' | 'requested' | 'resolved';

export interface Gap {
  id: string;
  sku: string;
  product_name: string;
  component_id: string | null;
  component_name: string | null;
  data_point: string;
  field: string;
  field_label: string;
  current_value: string;
  rule_id: string;
  rule_name: string;
  severity: Severity;
  modules: ModuleId[];
  status: GapStatus;
}

export type GapResolve =
  | { action: 'set_value'; value: string }
  | { action: 'request_supplier'; note: string }
  | { action: 'accept_estimate' };

// --- Screen 8: data overview (Org Admin) ------------------------------------------------
// GET /api/v1/data-overview → DataOverview

export interface DataPointCoverage {
  code: string;
  name: string;
  source: SourceId;
  filled: number;
  estimated: number;
  missing: number;
  total: number;
}

export interface DataOverview {
  products: number;
  components: number;
  readiness_pct: number;
  open_blockers: number;
  open_warnings: number;
  by_source: { source: SourceId; name: string; coverage_pct: number }[];
  data_points: DataPointCoverage[];
}
