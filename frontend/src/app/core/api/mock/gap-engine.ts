import { Gap, GapRule, Product } from '../contracts';
import { FIELDS } from './mock-db';

/**
 * Runs the active gap rules over every product and component value, the way the backend's
 * rule engine (screen 6/7) will. Pure function: same products and rules → same gaps.
 */
export function findGaps(products: Product[], rules: GapRule[]): Omit<Gap, 'status'>[] {
  const gaps: Omit<Gap, 'status'>[] = [];
  for (const rule of rules.filter((r) => r.active)) {
    for (const p of products) {
      // Component fields are checked on each component; product and passport fields once.
      const scopes = isComponentField(rule.field)
        ? p.components.map((c) => ({ component: c, fields: c.fields }))
        : [{ component: null, fields: { ...p.fields, ...p.passport } }];
      for (const { component, fields } of scopes) {
        // An absent field only counts for "missing" rules.
        if (!(rule.field in fields) && rule.check.kind !== 'missing') continue;
        const value = fields[rule.field]?.value ?? '';
        if (!fails(rule, value, fields)) continue;
        gaps.push({
          id: `${rule.id}:${component?.id ?? p.sku}`,
          sku: p.sku,
          product_name: p.name,
          component_id: component?.id ?? null,
          component_name: component?.name ?? null,
          data_point: rule.data_point,
          field: rule.field,
          field_label: FIELDS[rule.field]?.label ?? rule.field,
          current_value: value,
          rule_id: rule.id,
          rule_name: rule.name,
          severity: rule.severity,
          modules: rule.modules,
        });
      }
    }
  }
  return gaps;
}

function isComponentField(field: string): boolean {
  return FIELDS[field]?.level === 'Component';
}

function fails(rule: GapRule, value: string, fields: Product['fields']): boolean {
  const v = value.trim();
  switch (rule.check.kind) {
    case 'missing':
      return v === '';
    case 'in':
      return rule.check.values.includes(v);
    case 'certificate_missing':
      return Number(fields['recycled_content_pct']?.value ?? 0) > 0 && (v === '' || v === 'n/a');
    case 'pfas_missing':
      return fields['food_contact']?.value === 'Yes' && (v === '' || v === 'n/a');
  }
}
