// Builds the backend's reference data from the team's data set
// (reference-docs-teams/datapoints-epr-ppwr-main/src: data.js and skudata.js).
//   node backend/scripts/make_reference_data.js
// Data points are copied into the database by migration 0005; a changed dictionary needs a
// new migration to update existing databases.
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '../..');
const src = path.join(root, 'reference-docs-teams/datapoints-epr-ppwr-main/src');
const out = path.resolve(__dirname, '../app/catalog/reference');

global.window = {};
require(path.join(src, 'data.js'));
require(path.join(src, 'skudata.js'));
const D = window.EPR_DATA;
const S = window.SKU_DATA;

const dataPoints = D.DP.map((dp) => ({
  code: dp.id,
  name: dp.name,
  description: dp.desc,
  source: dp.src,
  system_field: dp.field || null,
  outputs: dp.out || [],
  countries: dp.countries || [],
  applies_from: dp.from || null,
}));

const reference = {
  sources: Object.fromEntries(Object.entries(D.SOURCES).map(([k, v]) => [k, v.name])),
  outputs: Object.fromEntries(Object.entries(D.OUTPUTS).map(([k, v]) => [k, { name: v.name, regulation: v.reg }])),
  countries: D.COUNTRIES.map((c) => ({ code: c.code, name: c.name, eu: c.eu })),
};

const skus = {};
for (const [sku, level, rowId, dp, field, value] of S.sample.rows) {
  if (sku === '(all)') continue;
  const p = (skus[sku] ??= { sku, fields: {}, components: {}, sales: {}, passport: {} });
  const v = { dp: dp || null, value };
  if (level === 'Product') p.fields[field] = v;
  else if (level === 'Passport') p.passport[field] = v;
  else if (level === 'Component') (p.components[rowId] ??= { id: rowId, fields: {} }).fields[field] = v;
  else if (level === 'Sales') (p.sales[rowId] ??= { id: rowId, fields: {} }).fields[field] = v;
}
const products = Object.values(skus).map((p) => ({
  ...p,
  components: Object.values(p.components),
  sales: Object.values(p.sales),
}));

// Fields the platform adds to the team's set: the country a sales line was sold in, which
// decides the SKU's markets and which EPR regime counts the line.
const PLATFORM_FIELDS = {
  market: { label: 'Market', dp: 'DP22', level: 'Sales', type: 'Code', allowed: 'UK, DE, FR, ES, IT, DK, NL, US-CA' },
};

const fields = Object.fromEntries(
  Object.entries({ ...S.fields, ...PLATFORM_FIELDS }).map(([k, f]) => [
    k,
    { label: f.label, dp: f.dp || null, level: f.level, type: f.type, allowed: f.allowed || null },
  ]),
);

fs.mkdirSync(out, { recursive: true });
const write = (name, data) => fs.writeFileSync(path.join(out, name), JSON.stringify(data, null, 1) + '\n');
write('data-points.json', { data_points: dataPoints, ...reference });
write('sample-products.json', { company: S.sample.company, market: S.sample.market, products });
write('fields.json', fields);
console.log(`${dataPoints.length} data points, ${products.length} products, ${Object.keys(fields).length} fields`);
