import { GapRule } from '../contracts';
import { findGaps } from './gap-engine';
import { db } from './mock-db';
import { matchRoute } from './mock-routes';

describe('mock API', () => {
  beforeEach(() => localStorage.clear());

  it('finds gaps with the seeded rules, and a fix removes them', () => {
    const { products, rules } = db();
    const gaps = findGaps(products, rules);
    expect(gaps.length).toBeGreaterThan(0);
    const weight = gaps.find((g) => g.rule_id === 'GR-003')!;
    expect(weight.component_id).toBeTruthy();

    const resolve = matchRoute('POST', `/api/v1/gaps/${encodeURIComponent(weight.id)}/resolve`)!;
    resolve.route.handle({ params: resolve.params, query: {}, body: { action: 'set_value', value: 'Measured' } });
    expect(findGaps(db().products, db().rules).some((g) => g.id === weight.id)).toBe(false);
  });

  it('skips inactive rules', () => {
    const rules: GapRule[] = db().rules.map((r) => ({ ...r, active: false }));
    expect(findGaps(db().products, rules)).toEqual([]);
  });

  it('validates a new workspace like the API will', () => {
    const create = matchRoute('POST', '/api/v1/admin/tenants')!;
    expect(() => create.route.handle({ params: {}, query: {}, body: { name: 'X', slug: 'Bad Slug' } })).toThrow();
  });
});
