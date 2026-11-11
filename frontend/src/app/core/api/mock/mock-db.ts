import {
  Component,
  DataPointDictionary,
  FieldInfo,
  FieldValue,
  Gap,
  GapRule,
  Product,
  SalesLine,
} from '../contracts';
import dataPointsFixture from './fixtures/data-points.json';
import fieldsFixture from './fixtures/fields.json';
import productsFixture from './fixtures/products.json';

/**
 * In-browser data for the mock API. Seeded from fixtures (generated from the reference
 * data set by `scripts/make-mock-fixtures.js`) and kept in localStorage so changes made
 * in a demo survive a reload. `resetMockDb()` starts over.
 */

type RawValue = { dp: string | null; value: string };
interface RawProduct {
  sku: string;
  fields: Record<string, RawValue>;
  passport: Record<string, RawValue>;
  components: { id: string; fields: Record<string, RawValue> }[];
  sales: { id: string; fields: Record<string, RawValue> }[];
}


export const FIELDS = fieldsFixture as Record<string, FieldInfo>;
export const DICTIONARY = dataPointsFixture as unknown as DataPointDictionary;

export interface MockState {
  products: Product[];
  rules: GapRule[];
  /** gap id → status and resolution, layered over the computed gaps */
  gapStatus: Record<string, Pick<Gap, 'status'>>;
}

const KEY = 'ch.mockdb.v1';

const num = (v: string | undefined): number | null => {
  const n = Number(v);
  return v === undefined || v === '' || Number.isNaN(n) ? null : n;
};

function toComponent(raw: { id: string; fields: Record<string, RawValue> }): Component {
  const f = (k: string) => raw.fields[k]?.value ?? '';
  return {
    id: raw.id,
    name: f('component_name'),
    level: f('packaging_level'),
    units_per_pack: num(f('units_per_pack')) ?? 1,
    material: f('material'),
    polymer: f('polymer'),
    weight_g: num(f('weight_g')),
    weight_source: f('weight_source'),
    recycled_content_pct: num(f('recycled_content_pct')),
    recyclability: f('recyclability_result'),
    supplier_id: f('supplier_id'),
    fields: raw.fields,
  };
}

function toSales(raw: { id: string; fields: Record<string, RawValue> }): SalesLine {
  const f = (k: string) => raw.fields[k]?.value ?? '';
  return {
    id: raw.id,
    period: f('period'),
    channel: f('channel'),
    units_placed: num(f('units_placed')) ?? 0,
    units_exported: num(f('units_exported')) ?? 0,
  };
}

export function toProduct(raw: RawProduct): Product {
  const components = raw.components.map(toComponent);
  const product: Product = {
    sku: raw.sku,
    name: raw.fields['product_name']?.value ?? raw.sku,
    brand: raw.fields['brand']?.value ?? '',
    gtin: raw.fields['gtin']?.value ?? '',
    fields: raw.fields,
    passport: raw.passport,
    components,
    sales: raw.sales.map(toSales),
    component_count: components.length,
    packaging_g_per_unit: 0,
    materials: [],
    completeness_pct: 0,
    open_gaps: 0,
  };
  return withTotals(product);
}

/** Recomputes the summary numbers after a product changes. */
export function withTotals(p: Product): Product {
  const perUnit = p.components.reduce((sum, c) => sum + (c.weight_g ?? 0) / (c.units_per_pack || 1), 0);
  const values: FieldValue[] = [
    ...Object.values(p.fields),
    ...Object.values(p.passport),
    ...p.components.flatMap((c) => Object.values(c.fields)),
  ].filter((v) => v.dp);
  const filled = values.filter((v) => v.value.trim() !== '').length;
  return {
    ...p,
    component_count: p.components.length,
    packaging_g_per_unit: Math.round(perUnit * 10) / 10,
    materials: [...new Set(p.components.map((c) => c.material).filter(Boolean))],
    completeness_pct: values.length ? Math.round((filled / values.length) * 100) : 0,
  };
}

function seed(): MockState {
  return {
    products: (productsFixture as { products: RawProduct[] }).products.map(toProduct),
    rules: [
      rule('GR-001', 'Value missing', 'DP54', 'registry_id', { kind: 'missing' }, 'blocker', ['DPP']),
      rule('GR-002', 'Passport host not decided', 'DP53', 'passport_host', { kind: 'in', values: ['Not decided'] }, 'warning', ['DPP']),
      rule('GR-003', 'Weight taken from specification', 'DP44', 'weight_source', { kind: 'in', values: ['Spec', 'Estimated'] }, 'warning', ['EPR', 'PPWR']),
      rule('GR-004', 'Limited recyclability', 'DP12', 'recyclability_result', { kind: 'in', values: ['Limited', 'Poor', 'Not recyclable'] }, 'warning', ['PPWR', 'EPR']),
      rule('GR-005', 'Recycled content without certificate', 'DP14', 'recycled_content_cert', { kind: 'certificate_missing' }, 'blocker', ['PPWR']),
      rule('GR-006', 'Food contact without PFAS declaration', 'DP17', 'pfas_declaration_ref', { kind: 'pfas_missing' }, 'blocker', ['PPWR']),
      rule('GR-007', 'Harmonised label not in place', 'DP39', 'harmonised_label_status', { kind: 'in', values: ['Planned', 'Not started'] }, 'warning', ['PPWR']),
      rule('GR-008', 'Component weight missing', 'DP09', 'weight_g', { kind: 'missing' }, 'blocker', ['EPR', 'PPWR']),
      rule('GR-009', 'GTIN missing', 'DP02', 'gtin', { kind: 'missing' }, 'blocker', ['EPR', 'PPWR', 'DPP']),
    ],
    gapStatus: {},
  };
}

function rule(
  id: string,
  name: string,
  data_point: string,
  field: string,
  check: GapRule['check'],
  severity: GapRule['severity'],
  modules: GapRule['modules'],
): GapRule {
  return { id, name, data_point, field, check, severity, modules, active: true };
}

let state: MockState | null = null;

export function db(): MockState {
  if (state) return state;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved) return (state = JSON.parse(saved) as MockState);
  } catch {
    // Fall back to the seed.
  }
  return (state = seed());
}

export function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(db()));
  } catch {
    // Storage blocked or full: changes last until reload.
  }
}

export function resetMockDb(): void {
  state = seed();
  save();
}
