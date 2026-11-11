/**
 * Names for the API's data shapes, used by the screens. Every type comes from the
 * OpenAPI schema generated from the backend (`npm run api:generate`), so a backend change
 * shows up here as a type error. A new screen agrees its endpoints first, then adds its
 * names here once the backend publishes them.
 */

import type { components } from './schema';

type Schemas = components['schemas'];

// --- Reference data (built: GET /api/v1/reference/countries, /reference/modules) ------

export type Country = Schemas['Country'];
export type ModuleId = Schemas['ModuleInfo']['id'];
export type ModuleInfo = Schemas['ModuleInfo'];

/** GET /api/v1/reference/fields → Record<key, FieldInfo>: every collected field and its data point. */
export type FieldInfo = Schemas['FieldInfo'];

// --- Screen 2: client workspaces (SuperAdmin) — built, types from the OpenAPI schema ---
// GET    /api/v1/admin/tenants?q=&status=      → Workspace[]
// POST   /api/v1/admin/tenants                 → Workspace           (WorkspaceCreate)
// GET    /api/v1/admin/tenants/{id}            → Workspace
// PATCH  /api/v1/admin/tenants/{id}            → Workspace           (WorkspacePatch)

export type Workspace = Schemas['Workspace'];
export type WorkspaceStatus = Workspace['status'];
export type LegalEntity = Schemas['LegalEntityIn'];
export type WorkspaceCreate = Schemas['WorkspaceCreate'];
export type WorkspacePatch = Schemas['WorkspacePatch'];

// --- Screen 9 (first part): users — built, GET/POST /api/v1/auth/users -----------------

export type UserRow = Schemas['UserProfile'];
export type UserRole = UserRow['role'];
export type UserCreate = Schemas['UserCreateRequest'];

// --- Screen 3: data point dictionary — built, GET /api/v1/admin/data-points -------------

export type SourceId = Schemas['DataPointOut']['source'];
export type OutputId = Schemas['DataPointOut']['outputs'][number];
export type DataPoint = Schemas['DataPointOut'];
export type DataPointDictionary = Schemas['DataPointDictionary'];

// --- Screen 4: products — built, GET /products, GET /products/{sku}, POST /products -----

export type FieldValue = Schemas['FieldValue'];
export type PackagingLevel = Schemas['ComponentIn']['level'];
export type Component = Schemas['ComponentOut'];
export type SalesLine = Schemas['SalesLineOut'];
export type ProductSummary = Schemas['ProductSummary'];
export type Product = Schemas['ProductOut'];
export type ProductCreate = Schemas['ProductCreate'];

// --- Screen 5: import — built, POST /imports, POST /imports/sync, PUT …/mapping, POST …/approve

export type ImportCreate = Schemas['ImportCreate'];
export type ImportDraft = Schemas['ImportDraft'];
export type ImportIssue = Schemas['ImportIssue'];
export type ImportPreview = Schemas['ImportPreview'];
export type SyncSystem = Schemas['SyncRequest']['system'];
export type ImportHistoryRow = Schemas['ImportHistoryRow'];
export type JobStatus = Pick<Schemas['JobOut'], 'id' | 'kind' | 'status' | 'progress' | 'result' | 'error'>;

// --- Screen 6: gap rules — built, GET/POST /admin/gap-rules, PATCH /admin/gap-rules/{id} --

export type Severity = Schemas['GapRuleOut']['severity'];
export type RuleCheck = Schemas['RuleCheck'];
export type GapRule = Schemas['GapRuleOut'];
export type GapRuleCreate = Schemas['GapRuleCreate'];

// --- Screen 7: gaps — built, GET /gaps, POST /gaps/{id}/resolve ---------------------------

export type GapStatus = Schemas['GapOut']['status'];
export type Gap = Schemas['GapOut'];
export type GapResolve = Schemas['GapResolve'];

// --- Screen 8: data overview — built, GET /data-overview -------------------------------

export type DataPointCoverage = Schemas['DataPointCoverage'];
export type DataOverview = Schemas['DataOverview'];

// --- Screen 18 (first part): data sources — built, GET/POST /data-sources, PATCH, POST …/sync

export type DataSource = Schemas['DataSourceOut'];
export type SyncStarted = Schemas['SyncStarted'];

// --- Screens 12–13 (first part): compliance — built, GET /modules/regimes, /modules/epr/{regime},
// /modules/ppwr/declarations, /modules/ppwr/declarations/{sku}?lang=

export type Regime = Schemas['Regime'];
export type EprRegime = Schemas['EprResult']['regime'];
export type EprResult = Schemas['EprResult'];
export type DeclarationRow = Schemas['DeclarationRow'];
export type Declaration = Schemas['Declaration'];
export type RequirementStatus = Schemas['Requirement']['status'];

// --- Screen 14 (first part): insights — built, GET /modules/epr/{regime}/insights,
// POST /modules/epr/{regime}/scenario, GET/POST /actions, PATCH /actions/{id}

export type Insights = Schemas['Insights'];
export type Recommendation = Schemas['Recommendation'];
export type ScenarioChange = Schemas['ScenarioChange'];
export type ScenarioResult = Schemas['ScenarioResult'];
export type ActionItem = Schemas['ActionOut'];
export type ActionCreate = Schemas['ActionCreate'];
export type ActionPatch = Schemas['ActionPatch'];
