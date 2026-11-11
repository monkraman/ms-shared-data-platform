import {
  DataOverview,
  DataPointCoverage,
  Gap,
  GapResolve,
  GapRule,
  GapRuleCreate,
  ImportCreate,
  ImportDraft,
  ImportPreview,
  Product,
  ProductCreate,
  SourceId,
  Workspace,
  WorkspaceCreate,
  WorkspacePatch,
} from '../contracts';
import { findGaps } from './gap-engine';
import { DICTIONARY, FIELDS, MODULES, db, save, toProduct, withTotals } from './mock-db';
import { mockMe } from './session-mock';

/** Thrown by handlers; becomes a problem-details error response like the real API's. */
export class MockError {
  constructor(
    readonly status: number,
    readonly detail: string,
    readonly errors: { loc: string[]; msg: string }[] = [],
  ) {}
}

export interface MockRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

interface Route {
  method: string;
  path: string;
  handle: (req: MockRequest) => unknown;
}

const routes: Route[] = [];
const on = (method: string, path: string, handle: Route['handle']) => routes.push({ method, path, handle });

export function matchRoute(method: string, url: string): { route: Route; params: Record<string, string> } | null {
  const path = new URL(url, 'http://x').pathname;
  for (const route of routes) {
    if (route.method !== method) continue;
    const names: string[] = [];
    const pattern = new RegExp(
      '^' + route.path.replace(/\{(\w+)\}/g, (_, n: string) => (names.push(n), '([^/]+)')) + '$',
    );
    const m = pattern.exec(path);
    if (m) return { route, params: Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

const notFound = (what: string) => new MockError(404, `${what} not found.`);
const invalid = (field: string, msg: string) => new MockError(422, 'The request has invalid fields.', [{ loc: ['body', field], msg }]);

// --- Session (until screen 1 ships) ---------------------------------------------------

on('GET', '/api/v1/auth/me', () => {
  const me = mockMe();
  if (!me) throw new MockError(401, 'Sign in to continue.');
  return me;
});

// --- Reference ----------------------------------------------------------------------

on('GET', '/api/v1/reference/countries', () => DICTIONARY.countries);
on('GET', '/api/v1/reference/modules', () => MODULES);
on('GET', '/api/v1/reference/fields', () => FIELDS);

// --- Screen 2: workspaces -----------------------------------------------------------

on('GET', '/api/v1/admin/tenants', ({ query }) => {
  const q = (query['q'] ?? '').toLowerCase();
  return db().workspaces.filter(
    (w) => (!q || w.name.toLowerCase().includes(q) || w.slug.includes(q)) && (!query['status'] || w.status === query['status']),
  );
});

on('GET', '/api/v1/admin/tenants/{id}', ({ params }) => workspace(params['id']));

on('POST', '/api/v1/admin/tenants', ({ body }) => {
  const b = body as WorkspaceCreate;
  if (!b.name?.trim()) throw invalid('name', 'Enter a name');
  if (!/^[a-z0-9-]{3,40}$/.test(b.slug ?? '')) throw invalid('slug', 'Use 3–40 lowercase letters, numbers or hyphens');
  if (db().workspaces.some((w) => w.slug === b.slug)) throw invalid('slug', 'Already in use');
  if (!b.legal_entities?.length) throw invalid('legal_entities', 'Add at least one legal entity');
  if (!b.countries?.length) throw invalid('countries', 'Choose at least one country');
  if (!b.modules?.length) throw invalid('modules', 'Choose at least one module');
  if (!/^\S+@\S+\.\S+$/.test(b.admin?.email ?? '')) throw invalid('email', 'Enter a valid email');
  const ws: Workspace = {
    id: `ws-${b.slug}`,
    slug: b.slug,
    name: b.name.trim(),
    sector: b.sector,
    status: 'active',
    brand_color: b.brand_color,
    countries: b.countries,
    modules: b.modules,
    legal_entities: b.legal_entities,
    user_count: 1,
    last_activity_at: null,
    created_at: new Date().toISOString(),
  };
  db().workspaces.unshift(ws);
  save();
  return ws;
});

on('PATCH', '/api/v1/admin/tenants/{id}', ({ params, body }) => {
  const ws = workspace(params['id']);
  Object.assign(ws, body as WorkspacePatch);
  save();
  return ws;
});

function workspace(id: string): Workspace {
  const ws = db().workspaces.find((w) => w.id === id);
  if (!ws) throw notFound('Workspace');
  return ws;
}

// --- Screen 3: data points ----------------------------------------------------------

on('GET', '/api/v1/admin/data-points', () => DICTIONARY);

// --- Screen 4: products -------------------------------------------------------------

on('GET', '/api/v1/products', ({ query }) => {
  const q = (query['q'] ?? '').toLowerCase();
  const gaps = openGaps();
  return db()
    .products.filter((p) => !q || [p.sku, p.name, p.brand, p.gtin].some((v) => v.toLowerCase().includes(q)))
    .map(({ fields, passport, components, sales, ...summary }) => ({
      ...summary,
      open_gaps: gaps.filter((g) => g.sku === summary.sku).length,
    }));
});

on('GET', '/api/v1/products/{sku}', ({ params }) => {
  const p = db().products.find((x) => x.sku === params['sku']);
  if (!p) throw notFound('Product');
  return { ...p, open_gaps: openGaps().filter((g) => g.sku === p.sku).length };
});

on('POST', '/api/v1/products', ({ body }) => {
  const b = body as ProductCreate;
  if (!/^[A-Z0-9-]{3,30}$/.test(b.sku ?? '')) throw invalid('sku', 'Use 3–30 capital letters, numbers or hyphens');
  if (db().products.some((p) => p.sku === b.sku)) throw invalid('sku', 'Already exists');
  if (!b.name?.trim()) throw invalid('name', 'Enter a name');
  if (b.gtin && !/^\d{8,14}$/.test(b.gtin)) throw invalid('gtin', 'Use 8–14 digits');
  if (!b.components?.length) throw invalid('components', 'Add at least one component');
  const v = (dp: string | null, value: string | number) => ({ dp, value: String(value) });
  const product = toProduct({
    sku: b.sku,
    fields: { product_name: v(null, b.name), brand: v(null, b.brand), gtin: v('DP02', b.gtin) },
    passport: {},
    components: b.components.map((c, i) => ({
      id: `${b.sku}-${String(i + 1).padStart(2, '0')}`,
      fields: {
        component_name: v('DP03', c.name),
        packaging_level: v('DP04', c.level),
        units_per_pack: v('DP05', c.units_per_pack),
        material: v('DP06', c.material),
        polymer: v('DP07', c.polymer || 'n/a'),
        weight_g: v('DP09', c.weight_g),
        weight_source: v('DP44', 'Manual'),
        recycled_content_pct: v('DP13', c.recycled_content_pct),
      },
    })),
    sales: [],
  });
  db().products.unshift(product);
  save();
  return product;
});

// --- Screen 5: imports ---------------------------------------------------------------

const imports = new Map<string, ImportCreate & { mapping: Record<string, string | null> }>();
const TARGETS = [
  { key: 'sku', label: 'SKU', dp: 'DP01', required: true },
  { key: 'product_name', label: 'Product name', dp: null, required: true },
  { key: 'brand', label: 'Brand', dp: null, required: false },
  { key: 'gtin', label: 'GTIN', dp: 'DP02', required: false },
  { key: 'component_name', label: 'Component', dp: 'DP03', required: true },
  { key: 'packaging_level', label: 'Packaging level', dp: 'DP04', required: true },
  { key: 'units_per_pack', label: 'Units per pack', dp: 'DP05', required: false },
  { key: 'material', label: 'Material', dp: 'DP06', required: true },
  { key: 'polymer', label: 'Polymer', dp: 'DP07', required: false },
  { key: 'weight_g', label: 'Weight (g)', dp: 'DP09', required: true },
  { key: 'recycled_content_pct', label: 'Recycled content (%)', dp: 'DP13', required: false },
];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

on('POST', '/api/v1/imports', ({ body }) => {
  const b = body as ImportCreate;
  if (!b.columns?.length || !b.rows?.length) throw invalid('file', 'The file has no rows');
  const id = `imp-${Date.now().toString(36)}`;
  const mapping = Object.fromEntries(
    b.columns.map((col) => {
      const t = TARGETS.find((x) => norm(x.key) === norm(col) || norm(x.label) === norm(col));
      return [col, t?.key ?? null];
    }),
  );
  imports.set(id, { ...b, mapping });
  const draft: ImportDraft = {
    id,
    filename: b.filename,
    columns: b.columns,
    row_count: b.rows.length,
    suggested_mapping: mapping,
    targets: TARGETS,
  };
  return draft;
});

on('PUT', '/api/v1/imports/{id}/mapping', ({ params, body }) => {
  const imp = imports.get(params['id']);
  if (!imp) throw notFound('Import');
  imp.mapping = (body as { mapping: Record<string, string | null> }).mapping;
  return preview(params['id']);
});

on('POST', '/api/v1/imports/{id}/approve', ({ params }) => {
  const imp = imports.get(params['id']);
  if (!imp) throw notFound('Import');
  const result = preview(params['id']);
  const rows = parsedRows(imp).filter((r) => r.ok);
  const bySku = new Map<string, typeof rows>();
  rows.forEach((r) => bySku.set(r.values['sku'], [...(bySku.get(r.values['sku']) ?? []), r]));
  for (const [sku, lines] of bySku) {
    const first = lines[0].values;
    const v = (dp: string | null, value: string) => ({ dp, value });
    const product = toProduct({
      sku,
      fields: { product_name: v(null, first['product_name']), brand: v(null, first['brand'] ?? ''), gtin: v('DP02', first['gtin'] ?? '') },
      passport: {},
      components: lines.map((l, i) => ({
        id: `${sku}-${String(i + 1).padStart(2, '0')}`,
        fields: {
          component_name: v('DP03', l.values['component_name']),
          packaging_level: v('DP04', l.values['packaging_level']),
          units_per_pack: v('DP05', l.values['units_per_pack'] || '1'),
          material: v('DP06', l.values['material']),
          polymer: v('DP07', l.values['polymer'] || 'n/a'),
          weight_g: v('DP09', l.values['weight_g']),
          weight_source: v('DP44', 'Imported'),
          recycled_content_pct: v('DP13', l.values['recycled_content_pct'] || '0'),
        },
      })),
      sales: [],
    });
    const at = db().products.findIndex((p) => p.sku === sku);
    if (at >= 0) db().products[at] = product;
    else db().products.unshift(product);
  }
  save();
  return startJob('ingestion.import', { ...result, imported_products: bySku.size });
});

function parsedRows(imp: ImportCreate & { mapping: Record<string, string | null> }) {
  return imp.rows.map((row, i) => {
    const values: Record<string, string> = {};
    imp.columns.forEach((col, c) => {
      const key = imp.mapping[col];
      if (key) values[key] = (row[c] ?? '').trim();
    });
    const issues: { row: number; column: string; message: string }[] = [];
    for (const t of TARGETS.filter((x) => x.required)) {
      if (!values[t.key]) issues.push({ row: i + 2, column: t.label, message: 'Missing' });
    }
    for (const key of ['weight_g', 'units_per_pack', 'recycled_content_pct']) {
      if (values[key] && Number.isNaN(Number(values[key]))) {
        issues.push({ row: i + 2, column: TARGETS.find((t) => t.key === key)!.label, message: 'Not a number' });
      }
    }
    return { values, issues, ok: issues.length === 0 };
  });
}

function preview(id: string): ImportPreview {
  const imp = imports.get(id)!;
  const rows = parsedRows(imp);
  const skus = new Set(rows.filter((r) => r.ok).map((r) => r.values['sku']));
  const existing = new Set(db().products.map((p) => p.sku));
  return {
    id,
    valid_rows: rows.filter((r) => r.ok).length,
    invalid_rows: rows.filter((r) => !r.ok).length,
    new_products: [...skus].filter((s) => !existing.has(s)).length,
    updated_products: [...skus].filter((s) => existing.has(s)).length,
    issues: rows.flatMap((r) => r.issues).slice(0, 50),
  };
}

// --- Jobs (mocked ones only; real jobs go to the backend) --------------------------------

const jobs = new Map<string, { started: number; kind: string; result: Record<string, unknown> }>();
const JOB_MS = 2400;

function startJob(kind: string, result: Record<string, unknown>) {
  const id = `mock-job-${Date.now().toString(36)}`;
  jobs.set(id, { started: Date.now(), kind, result });
  return { job_id: id };
}

on('GET', '/api/v1/jobs/{job_id}', ({ params }) => {
  const job = jobs.get(params['job_id']);
  if (!job) return undefined; // Not a mock job: let the real backend answer.
  const progress = Math.min(100, Math.round(((Date.now() - job.started) / JOB_MS) * 100));
  return {
    id: params['job_id'],
    kind: job.kind,
    status: progress >= 100 ? 'succeeded' : 'running',
    progress,
    result: progress >= 100 ? job.result : null,
    error: null,
  };
});

// --- Screen 6: gap rules --------------------------------------------------------------

on('GET', '/api/v1/admin/gap-rules', () => db().rules);

on('POST', '/api/v1/admin/gap-rules', ({ body }) => {
  const b = body as GapRuleCreate;
  if (!b.name?.trim()) throw invalid('name', 'Enter a name');
  if (!b.field || !FIELDS[b.field]) throw invalid('field', 'Choose a field');
  const next = Math.max(0, ...db().rules.map((r) => Number(r.id.slice(3)))) + 1;
  const rule: GapRule = { ...b, id: `GR-${String(next).padStart(3, '0')}`, active: true };
  db().rules.push(rule);
  save();
  return rule;
});

on('PATCH', '/api/v1/admin/gap-rules/{id}', ({ params, body }) => {
  const rule = db().rules.find((r) => r.id === params['id']);
  if (!rule) throw notFound('Rule');
  Object.assign(rule, body as Partial<GapRule>);
  save();
  return rule;
});

// --- Screen 7: gaps ------------------------------------------------------------------

function allGaps(): Gap[] {
  const status = db().gapStatus;
  return findGaps(db().products, db().rules).map((g) => ({ ...g, status: status[g.id]?.status ?? 'open' }));
}

function openGaps(): Gap[] {
  return allGaps().filter((g) => g.status !== 'resolved');
}

on('GET', '/api/v1/gaps', ({ query }) =>
  allGaps().filter(
    (g) => (!query['status'] || g.status === query['status']) && (!query['severity'] || g.severity === query['severity']),
  ),
);

on('POST', '/api/v1/gaps/{id}/resolve', ({ params, body }) => {
  const gap = allGaps().find((g) => g.id === params['id']);
  if (!gap) throw notFound('Gap');
  const b = body as GapResolve;
  if (b.action === 'set_value') {
    if (!b.value?.trim()) throw invalid('value', 'Enter a value');
    const product = db().products.find((p) => p.sku === gap.sku)!;
    const target = gap.component_id
      ? product.components.find((c) => c.id === gap.component_id)!.fields
      : gap.field in product.passport
        ? product.passport
        : product.fields;
    target[gap.field] = { dp: gap.data_point, value: b.value.trim() };
    const index = db().products.indexOf(product);
    db().products[index] = withTotals(
      gap.component_id
        ? { ...product, components: product.components.map((c) => (c.id === gap.component_id ? refreshComponent(c) : c)) }
        : product,
    );
    db().gapStatus[gap.id] = { status: 'resolved' };
  } else {
    db().gapStatus[gap.id] = { status: b.action === 'request_supplier' ? 'requested' : 'resolved' };
  }
  save();
  return { ...gap, status: db().gapStatus[gap.id].status };
});

function refreshComponent(c: Product['components'][number]): Product['components'][number] {
  const f = (k: string) => c.fields[k]?.value ?? '';
  return {
    ...c,
    weight_g: f('weight_g') ? Number(f('weight_g')) : null,
    weight_source: f('weight_source'),
    recyclability: f('recyclability_result'),
  };
}

// --- Screen 8: data overview ----------------------------------------------------------

on('GET', '/api/v1/data-overview', (): DataOverview => {
  const products = db().products;
  const values = products.flatMap((p) => [
    ...Object.values(p.fields),
    ...Object.values(p.passport),
    ...p.components.flatMap((c) => Object.entries(c.fields).map(([k, v]) => ({ ...v, estimated: k === 'weight_g' && ['Spec', 'Estimated'].includes(c.fields['weight_source']?.value) }))),
  ]);
  const coverage: DataPointCoverage[] = DICTIONARY.data_points.map((dp) => {
    const mine = values.filter((v) => v.dp === dp.code);
    const filled = mine.filter((v) => v.value.trim() !== '');
    const estimated = filled.filter((v) => 'estimated' in v && v.estimated).length;
    return {
      code: dp.code,
      name: dp.name,
      source: dp.source,
      filled: filled.length - estimated,
      estimated,
      missing: mine.length - filled.length,
      total: mine.length,
    };
  });
  const sources = Object.keys(DICTIONARY.sources) as SourceId[];
  const gaps = openGaps();
  const tracked = coverage.filter((c) => c.total > 0);
  const pct = (list: DataPointCoverage[]) => {
    const total = list.reduce((s, c) => s + c.total, 0);
    return total ? Math.round((list.reduce((s, c) => s + c.filled, 0) / total) * 100) : 0;
  };
  return {
    products: products.length,
    components: products.reduce((s, p) => s + p.components.length, 0),
    readiness_pct: pct(tracked),
    open_blockers: gaps.filter((g) => g.severity === 'blocker').length,
    open_warnings: gaps.filter((g) => g.severity === 'warning').length,
    by_source: sources.map((s) => ({
      source: s,
      name: DICTIONARY.sources[s],
      coverage_pct: pct(tracked.filter((c) => c.source === s)),
    })),
    data_points: coverage,
  };
});
