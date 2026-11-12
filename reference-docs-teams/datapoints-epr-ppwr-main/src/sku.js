/* SKU data view: load a client's SKU-level data set, see coverage per SKU and data point, run the data checks,
   inspect one SKU, export the platform import file, and turn the data into checklist answers for the flowchart.
   Everything stays in this browser (no server). */
(function () {
  "use strict";
  const X = window.EXPLORER;
  const { DP, SOURCES, esc, toast } = X;
  const FIELDS = (window.SKU_DATA && window.SKU_DATA.fields) || {};
  const SAMPLE = window.SKU_DATA && window.SKU_DATA.sample;
  const DPI = Object.fromEntries(DP.map(d => [d.id, d]));
  const $ = id => document.getElementById(id);
  const STORE = "epr-explorer-skudata-v1";
  const SKU_LEVELS = ["Product", "Passport", "Component", "Sales"];
  const LEVEL_NAME = { Product: "Product", Passport: "Product passport", Component: "Packaging components", Sales: "Sales" };
  const ID_FIELDS = new Set(["product_name", "brand"]);

  // ---------- state ----------
  // DS: { company, market, profile, source, loaded, rows, history }
  //   rows: [sku, level, record_id, dp, field, value, source_system, source_field, load_no]
  //   history: one entry per data load, with what changed against the load before it
  let DS = null;
  let M = null; // model built from DS
  const st = { tab: "cov", q: "", gapsOnly: false, sort: "worst", sku: null, sev: new Set(["error", "warning"]), tag: "", hl: null };
  try { const s = JSON.parse(localStorage.getItem(STORE) || "null"); if (s && Array.isArray(s.rows)) DS = s; } catch (e) { /* ignore */ }
  function persist() {
    try { if (DS) localStorage.setItem(STORE, JSON.stringify(DS)); else localStorage.removeItem(STORE); return true; }
    catch (e) { toast("This data set is too large to keep in the browser: it stays loaded until you close the page."); return false; }
  }

  // ---------- helpers ----------
  const blank = v => v == null || String(v).trim() === "";
  const isNA = v => /^(n\/a|na|none|not applicable)$/i.test(String(v ?? "").trim());
  const num = v => { const n = Number(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return blank(v) || isNaN(n) ? null : n; };
  const fmt = (n, d = 0) => n == null ? "–" : n.toLocaleString("en-GB", { maximumFractionDigits: d, minimumFractionDigits: d });
  const isEUc = c => X.isEU(c);
  function gtinOK(g) {
    const s = String(g ?? "").trim();
    if (!/^\d{8}$|^\d{12,14}$/.test(s)) return false;
    const d = s.split("").map(Number), chk = d.pop();
    const sum = d.reverse().reduce((a, x, i) => a + x * (i % 2 ? 1 : 3), 0);
    return (10 - sum % 10) % 10 === chk;
  }
  // which data points this market needs, and whether only for the DPP
  function need(dpId, market) {
    const d = DPI[dpId];
    if (!d || !d.countries.includes(market)) return null;
    const outs = d.out.filter(o => isEUc(market) || X.OUTPUTS[o].reg === "EPR");
    if (!outs.length) return null;
    return outs.every(o => X.OUTPUTS[o].reg === "DPP") ? "dpp" : outs.every(o => X.OUTPUTS[o].reg !== "EPR") ? "ppwr" : "req";
  }
  const levelOf = f => (FIELDS[f] || {}).level;
  const DOC_FIELDS = new Set(["doc_version", "doc_manufacturer", "doc_signatory", "doc_issue_date", "retention_until"]);

  // ---------- DoC grouping (gap assessment input for iNext; no DoC drafting) ----------
  // One DoC may cover several SKUs only when the packaging type and everything that affects conformity are the same:
  // supplier, materials, structure, colours, inks/coatings/adhesives, food-contact use, reuse. Size, weight and print
  // design may differ. Each component is compared on those attributes only.
  const ATTR = [["level", "packaging_level"], ["material", "material"], ["polymer", "polymer"], ["supplier", "supplier_id"],
    ["colour", "colour"], ["inks, coatings or adhesives", "additives"], ["food-contact use", "food_contact"], ["material split", "material_split"]];
  const norm = v => blank(v) || isNA(v) ? "–" : String(v).trim().toLowerCase().replace(/\s+/g, " ");
  const compKey = r => ATTR.map(([, f]) => norm(r[f])).join(" | ");
  const compLabel = r => `${r.component_name || "component"} (${[r.material, r.polymer].filter(x => !blank(x) && !isNA(x)).join(" ") || "material?"})`;
  function packType(s) {
    const c = [...s.comps.values()].find(r => /^primary$/i.test(r.packaging_level || "")) || [...s.comps.values()][0];
    if (!c) return "No packaging recorded";
    const mat = [c.material, c.polymer].filter(x => !blank(x) && !isNA(x)).join(" ");
    return `${mat || "Unspecified material"} primary pack`;
  }
  function signature(s) {
    return [...s.comps.values()].map(compKey).sort().join(" || ") + " || reusable:" + norm(s.product.reusable);
  }
  function describeDiff(a, b) {
    const out = [];
    if (norm(a.product.reusable) !== norm(b.product.reusable)) out.push("reusable or single-use");
    const ca = [...a.comps.values()], cb = [...b.comps.values()];
    const slot = r => norm(r.packaging_level) + "/" + norm(r.material);
    const used = new Set();
    ca.forEach(r => {
      const i = cb.findIndex((x, j) => !used.has(j) && slot(x) === slot(r));
      if (i < 0) { out.push(`${a.sku} has ${compLabel(r)} that ${b.sku} doesn't`); return; }
      used.add(i);
      const diffs = ATTR.filter(([, f]) => norm(r[f]) !== norm(cb[i][f])).map(([n]) => n);
      if (diffs.length) out.push(`${compLabel(r)}: ${diffs.join(", ")}`);
    });
    cb.forEach((r, j) => { if (!used.has(j)) out.push(`${b.sku} has ${compLabel(r)} that ${a.sku} doesn't`); });
    return out;
  }
  function docGroups(m) {
    const types = new Map();
    m.skus.forEach(s => {
      const t = packType(s);
      if (!types.has(t)) types.set(t, new Map());
      const g = types.get(t), sig = signature(s);
      if (!g.has(sig)) g.set(sig, []);
      g.get(sig).push(s);
    });
    let n = 0;
    const groups = [];
    types.forEach((clusters, type) => {
      const cl = [...clusters.values()];
      cl.forEach((skus, i) => {
        n++;
        const refs = [...new Set(skus.map(s => s.product.doc_reference).filter(x => !blank(x)))];
        const nodoc = skus.filter(s => blank(s.product.doc_reference)).map(s => s.sku);
        const others = cl.filter((_, j) => j !== i).map(o => ({ sku: o[0].sku, diff: describeDiff(skus[0], o[0]) }));
        let rec;
        if (skus.length > 1) rec = refs.length === 1 && !nodoc.length ? `Same packaging: already under one DoC (${refs[0]})` : "Same packaging: one DoC may be considered";
        else rec = "Own DoC";
        groups.push({ id: "G" + String(n).padStart(2, "0"), type, skus: skus.map(s => s.sku), names: skus.map(s => s.name), refs, nodoc, rec, others,
          suppliers: [...new Set(skus.flatMap(s => [...s.comps.values()].map(r => r.supplier_id)).filter(x => !blank(x) && !isNA(x)))] });
      });
    });
    // a DoC reference used by SKUs whose packaging differs
    const byRef = new Map();
    m.skus.forEach(s => { const r = s.product.doc_reference; if (!blank(r)) { if (!byRef.has(r)) byRef.set(r, []); byRef.get(r).push(s); } });
    const shared = [];
    byRef.forEach((list, ref) => {
      const sigs = [...new Set(list.map(signature))];
      if (sigs.length > 1) shared.push({ ref, skus: list.map(s => s.sku), diff: describeDiff(list[0], list.find(s => signature(s) !== signature(list[0]))).join("; ") });
    });
    groups.forEach(g => {
      const x = shared.find(sh => g.refs.includes(sh.ref));
      if (x) { g.rec = `Shares ${x.ref} with SKUs whose packaging differs: split the DoC or add assessment`; g.split = true; }
    });
    return { groups, shared };
  }

  // ---------- model ----------
  function build() {
    if (!DS) { M = null; return; }
    const market = DS.market || "DK";
    const skus = new Map(), company = {}, srcIdx = new Map();
    DS.rows.forEach(r => srcIdx.set(r[2] + "|" + r[4], r));
    const get = sku => {
      if (!skus.has(sku)) skus.set(sku, { sku, name: "", brand: "", product: {}, comps: new Map(), sales: new Map() });
      return skus.get(sku);
    };
    DS.rows.forEach(([sku, level, rid, dp, field, value]) => {
      const lv = levelOf(field) || level;
      if (lv === "Company" || lv === "Market") { company[field] = value; return; }
      if (!sku || sku === "(all)") return;
      const s = get(sku);
      if (field === "product_name") s.name = value;
      else if (field === "brand") s.brand = value;
      if (lv === "Component") { if (!s.comps.has(rid)) s.comps.set(rid, {}); s.comps.get(rid)[field] = value; }
      else if (lv === "Sales") { if (!s.sales.has(rid)) s.sales.set(rid, {}); s.sales.get(rid)[field] = value; }
      else s.product[field] = value;
    });
    // fields the market needs at SKU level, grouped by data point
    const fieldsBy = {};
    Object.entries(FIELDS).forEach(([f, m]) => {
      if (!m.dp || !SKU_LEVELS.includes(m.level)) return;
      const n = need(m.dp, market);
      if (!n) return;
      (fieldsBy[m.dp] = fieldsBy[m.dp] || { dp: m.dp, level: m.level, need: n, fields: [] }).fields.push(f);
    });
    const cols = Object.values(fieldsBy).sort((a, b) => SKU_LEVELS.indexOf(a.level) - SKU_LEVELS.indexOf(b.level) || a.dp.localeCompare(b.dp, "en", { numeric: true }));
    const list = [...skus.values()];
    list.forEach(s => {
      s.cov = {};
      let filled = 0, total = 0;
      cols.forEach(c => {
        const vals = [];
        c.fields.forEach(f => {
          const lv = FIELDS[f].level;
          if (lv === "Component") s.comps.size ? s.comps.forEach(r => vals.push(r[f])) : vals.push("");
          else if (lv === "Sales") s.sales.size ? s.sales.forEach(r => vals.push(r[f])) : vals.push("");
          else vals.push(s.product[f]);
        });
        const n = vals.filter(x => !blank(x)).length;
        s.cov[c.dp] = n === vals.length ? "full" : n === 0 ? "missing" : "partial";
        filled += n; total += vals.length;
      });
      s.pct = total ? filled / total : 0;
      // packaging per unit and units in the market
      let g = 0, gOK = true;
      const byMat = {};
      s.comps.forEach(r => {
        const w = num(r.weight_g), u = num(r.units_per_pack);
        if (w == null || !u || u < 1) { gOK = false; return; }
        g += w / u;
        const mat = blank(r.material) ? "(unspecified)" : r.material;
        byMat[mat] = (byMat[mat] || 0) + w / u;
      });
      let units = 0;
      s.sales.forEach(r => { units += Math.max((num(r.units_placed) || 0) - (num(r.units_exported) || 0), 0); });
      Object.assign(s, { gPerUnit: s.comps.size ? g : null, gOK: gOK && s.comps.size > 0, units, byMat, kg: units * g / 1000 });
    });
    M = { market, skus: list, by: skus, cols, company, issues: [], srcIdx };
    M.doc = docGroups(M);
    M.issues = checks(M);
    M.issues.forEach(i => {
      const r = srcIdx.get(i.rid + "|" + i.field) || (i.sku === "(company)" ? DS.rows.find(x => x[4] === i.field) : null);
      const d = DPI[i.dp];
      i.src = r && r[6] ? r[6] : d ? SOURCES[d.src].short : "";
    });
    list.forEach(s => {
      s.err = M.issues.filter(i => i.sku === s.sku && i.sev === "error").length;
      s.warn = M.issues.filter(i => i.sku === s.sku && i.sev === "warning").length;
    });
  }

  // ---------- data checks (same labels as the platform where they overlap) ----------
  function checks(m) {
    const out = [];
    const add = (sev, tag, sku, rid, field, value, msg) => out.push({ sev, tag, sku, rid, field, dp: (FIELDS[field] || {}).dp || "", value: value ?? "", msg });
    const allowed = f => {
      const a = (FIELDS[f] || {}).allowed || "";
      if (!["Code", "Yes/No"].includes((FIELDS[f] || {}).type) || !a || /[:–]/.test(a)) return null;
      return a.split(",").map(x => x.trim().toLowerCase()).filter(x => x && x !== "other");
    };
    const typeCheck = (sku, rid, f, v) => {
      if (blank(v) || isNA(v)) return;
      const meta = FIELDS[f] || {};
      if (meta.type === "Number" && num(v) == null) add("error", "Invalid value", sku, rid, f, v, `${meta.label} must be a number.`);
      const al = allowed(f);
      if (al && !al.includes(String(v).trim().toLowerCase())) add("error", "Invalid value", sku, rid, f, v, `${meta.label} "${v}" is not one of: ${meta.allowed}.`);
    };
    let docless = false; // DoC record fields follow the DoC: no separate "empty" findings when there is no DoC yet
    const missing = (sku, rid, f, v) => {
      const meta = FIELDS[f] || {};
      if (!meta.dp) return;
      if (docless && DOC_FIELDS.has(f)) return;
      const n = need(meta.dp, m.market);
      if (n && n !== "dpp" && blank(v)) add("error", "Missing", sku, rid, f, "", `${meta.label} is empty.`);
    };
    const skuFields = Object.keys(FIELDS).filter(f => SKU_LEVELS.includes(FIELDS[f].level));
    m.skus.forEach(s => {
      docless = blank(s.product.doc_reference);
      skuFields.filter(f => ["Product", "Passport"].includes(FIELDS[f].level)).forEach(f => {
        if (!(f in s.product) && !FIELDS[f].dp) return;
        missing(s.sku, s.sku, f, s.product[f]); typeCheck(s.sku, s.sku, f, s.product[f]);
      });
      docless = false;
      // DoC and technical file retention: 5 years after single-use packaging was last placed on the market, 10 if reusable
      if (!blank(s.product.retention_until) && isEUc(m.market)) {
        const until = String(s.product.retention_until).trim();
        const years = [...s.sales.values()].map(r => parseInt(String(r.period || "").slice(0, 4), 10)).filter(y => y > 1900);
        const keep = /^yes$/i.test(s.product.reusable || "") ? 10 : 5;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) add("error", "Invalid value", s.sku, s.sku, "retention_until", until, "Retention date must be YYYY-MM-DD.");
        else if (years.length) {
          const need = `${Math.max(...years) + keep}-12-31`;
          if (until < need) add("error", "Retention", s.sku, s.sku, "retention_until", until, `Kept until ${until}: needs at least ${need} (${keep} years after the last sales year, ${keep === 10 ? "reusable" : "single-use"}).`);
        }
      }
      if (!blank(s.product.gtin) && !gtinOK(s.product.gtin)) add("error", "Invalid value", s.sku, s.sku, "gtin", s.product.gtin, "GTIN check digit is wrong.");
      const esr = num(s.product.empty_space_ratio_pct);
      if (esr != null && (esr < 0 || esr > 100)) add("error", "Invalid value", s.sku, s.sku, "empty_space_ratio_pct", esr, "Empty space ratio must be 0–100.");
      if (!s.comps.size) add("error", "Blocker Gap", s.sku, s.sku, "component_name", "", "No packaging components recorded.");
      s.comps.forEach((r, rid) => {
        skuFields.filter(f => FIELDS[f].level === "Component").forEach(f => { missing(s.sku, rid, f, r[f]); typeCheck(s.sku, rid, f, r[f]); });
        if (blank(r.weight_g)) add("error", "Blocker Gap", s.sku, rid, "weight_g", "", "Weight missing: the fee can't be worked out.");
        if (blank(r.material) || /unspecified/i.test(r.material)) add("error", "Blocker Gap", s.sku, rid, "material", r.material, "Material missing or unspecified.");
        const u = num(r.units_per_pack);
        if (!blank(r.units_per_pack) && (u == null || u < 1 || !Number.isInteger(u))) add("error", "Invalid value", s.sku, rid, "units_per_pack", r.units_per_pack, "Units per pack must be a whole number of at least 1.");
        const rc = num(r.recycled_content_pct);
        if (rc != null && (rc < 0 || rc > 100)) add("error", "Invalid value", s.sku, rid, "recycled_content_pct", rc, "Recycled content must be 0–100.");
        if (rc > 0 && (blank(r.recycled_content_cert) || isNA(r.recycled_content_cert))) add("error", "Unverified PCR", s.sku, rid, "recycled_content_cert", "", `${rc}% recycled content claimed with no certificate.`);
        if (!blank(r.material_split) && !isNA(r.material_split)) {
          const tot = (String(r.material_split).match(/\d+(\.\d+)?/g) || []).reduce((a, x) => a + Number(x), 0);
          if (Math.abs(tot - 100) > 0.5) add("error", "Inconsistent", s.sku, rid, "material_split", r.material_split, `Material split adds up to ${fmt(tot, 1)}, not 100.`);
        }
        if (/^plastic$/i.test(r.material || "") && (blank(r.polymer) || isNA(r.polymer))) add("error", "Missing", s.sku, rid, "polymer", r.polymer, "Plastic component with no polymer.");
        if (/^yes$/i.test(r.food_contact || "") && isEUc(m.market) && !/^glass$/i.test(r.material || "") && (blank(r.pfas_declaration_ref) || isNA(r.pfas_declaration_ref)))
          add("error", "Missing", s.sku, rid, "pfas_declaration_ref", "", "Food-contact component with no PFAS declaration.");
        if (/^estimate$/i.test(r.weight_source || "")) add("warning", "Check", s.sku, rid, "weight_source", r.weight_source, "Weight is an estimate: measure it before submission.");
        if (/^(poor|limited|d|e|red)$/i.test(r.recyclability_result || "")) add("warning", "Check", s.sku, rid, "recyclability_result", r.recyclability_result, "Low recyclability: may raise the fee and the PPWR grade risk.");
      });
      if (!s.sales.size) add("error", "Missing", s.sku, s.sku, "units_placed", "", "No sales recorded for this market.");
      s.sales.forEach((r, rid) => {
        skuFields.filter(f => FIELDS[f].level === "Sales").forEach(f => { missing(s.sku, rid, f, r[f]); typeCheck(s.sku, rid, f, r[f]); });
        const p = num(r.units_placed), e = num(r.units_exported);
        if (p != null && e != null && e > p) add("error", "Inconsistent", s.sku, rid, "units_exported", e, `Exported (${fmt(e)}) is more than placed (${fmt(p)}).`);
      });
    });
    // one DoC covering SKUs whose packaging differs
    m.doc.shared.forEach(x => x.skus.forEach(sku => add("warning", "DoC grouping", sku, sku, "doc_reference", x.ref,
      `${x.ref} also covers ${x.skus.filter(o => o !== sku).join(", ")}, but the packaging differs (${x.diff}). Split the DoC or add assessment.`)));
    // company and registration details (collected once, apply to every SKU)
    if (DS.rows.some(r => ["Company", "Market"].includes(levelOf(r[4])))) {
      Object.entries(FIELDS).filter(([, f]) => ["Company", "Market"].includes(f.level)).forEach(([f]) => {
        if (f === "organisation_size") return; // worked out from turnover and tonnage
        const rid = FIELDS[f].level === "Market" ? m.market + " registration" : "company";
        missing("(company)", rid, f, m.company[f]); typeCheck("(company)", rid, f, m.company[f]);
      });
    }
    // a specific rule on the same value replaces the plain "is empty" finding
    const specific = new Set(out.filter(i => i.tag !== "Missing" || !/ is empty\.$/.test(i.msg)).map(i => i.sku + "|" + i.rid + "|" + i.field));
    return out.filter(i => !(i.tag === "Missing" && / is empty\.$/.test(i.msg) && specific.has(i.sku + "|" + i.rid + "|" + i.field)));
  }

  // ---------- import ----------
  const PLAT = {
    sku: ["sku", "matnr", "item_code", "article_no", "product_id", "sku_id"],
    name: ["name", "product_name", "item_description", "title", "designation"],
    brand: ["brand"],
    material: ["material", "polymer", "substrate", "packaging_type", "material_group"],
    weight: ["packaging_weight_grams", "tare_weight", "weight_g", "net_pkg_mass", "tare_grams"],
    units: ["units_sold", "annual_volume", "sales_units", "quantity", "menge"],
    pcr: ["recycled_content_pct", "pcr_pct", "recycled_content", "pcr_ratio"],
    country: ["jurisdiction", "country", "market", "iso_country", "geo"],
  };
  function platMaterial(v) {
    const s = String(v || "").toLowerCase();
    const poly = ["pet", "hdpe", "ldpe", "pp", "ps", "pvc"].find(p => new RegExp(`\\b${p}\\b`).test(s));
    if (poly) return ["Plastic", poly.toUpperCase()];
    if (/plastic/.test(s)) return ["Plastic", ""];
    if (/glass/.test(s)) return ["Glass", "n/a"];
    if (/steel|tinplate/.test(s)) return ["Steel", "n/a"];
    if (/alu/.test(s)) return ["Aluminium", "n/a"];
    if (/paper|board|carton|cardboard/.test(s)) return ["Paper/board", "n/a"];
    if (/wood/.test(s)) return ["Wood", "n/a"];
    return ["", ""];
  }
  function fromTable(rows, sourceName) {
    if (rows.length < 2) return "That file has no data rows.";
    const h = rows[0].map(x => String(x ?? "").trim().toLowerCase().replace(/\s+/g, "_"));
    const col = names => h.findIndex(x => names.includes(x));
    // 1. long format: one row per value (the SKU x data point map)
    const iS = col(["sku"]), iF = col(["field"]), iV = col(["value"]);
    if (iS >= 0 && iF >= 0 && iV >= 0) {
      const iL = col(["level"]), iR = col(["record_id"]), iD = col(["dp_id"]), iSys = col(["source_system"]), iRef = col(["source_field"]);
      const out = rows.slice(1).map(r => [String(r[iS] ?? "").trim(), iL >= 0 ? r[iL] : "", iR >= 0 ? String(r[iR] ?? "").trim() : "", iD >= 0 ? r[iD] : "",
        String(r[iF] ?? "").trim(), r[iV] == null ? "" : String(r[iV]), iSys >= 0 ? String(r[iSys] ?? "") : "", iRef >= 0 ? String(r[iRef] ?? "") : ""]).filter(r => r[0] && r[4]);
      out.forEach(r => { if (!r[2]) r[2] = r[0]; });
      return { rows: out, source: sourceName + " (SKU x data point map)" };
    }
    // 2. platform SKU catalogue (canonical columns or the accepted synonyms): one row per SKU
    const P = Object.fromEntries(Object.entries(PLAT).map(([k, n]) => [k, col(n)]));
    if (P.sku >= 0 && (P.material >= 0 || P.weight >= 0)) {
      const out = [];
      let market = "";
      rows.slice(1).forEach(r => {
        const sku = String(r[P.sku] ?? "").trim(); if (!sku) return;
        const val = k => P[k] >= 0 ? (r[P[k]] == null ? "" : String(r[P[k]]).trim()) : "";
        if (!market && val("country")) market = val("country").toUpperCase().slice(0, 2);
        const [mat, poly] = platMaterial(val("material"));
        const c = sku + "-01", sl = sku + "-S1";
        // keep the file's own column name as the source field, for traceability
        const col_ = k => P[k] >= 0 ? `column ${rows[0][P[k]]}` : "";
        const sys = "Platform catalogue";
        out.push([sku, "Product", sku, "", "product_name", val("name"), sys, col_("name")], [sku, "Product", sku, "", "brand", val("brand"), sys, col_("brand")],
          [sku, "Component", c, "DP03", "component_name", "Packaging (whole pack, from catalogue)", sys, "added on import"],
          [sku, "Component", c, "DP06", "material", mat, sys, col_("material")], [sku, "Component", c, "DP07", "polymer", poly, sys, col_("material")],
          [sku, "Component", c, "DP05", "units_per_pack", "1", sys, "added on import"], [sku, "Component", c, "DP09", "weight_g", val("weight"), sys, col_("weight")],
          [sku, "Component", c, "DP13", "recycled_content_pct", val("pcr"), sys, col_("pcr")],
          [sku, "Sales", sl, "DP22", "units_placed", val("units"), sys, col_("units")]);
      });
      return { rows: out, market, source: sourceName + " (platform SKU catalogue: one row per SKU, so component and sales detail will show as gaps)" };
    }
    if (h.some(x => x.startsWith("has_it"))) return "This is a checklist file: import it in the Checklist view instead.";
    return "Couldn't recognise the columns. Use the SKU collection workbook, the SKU x data point map (sku, field, value) or a platform SKU catalogue (sku, material, packaging_weight_grams…).";
  }
  // the per-SKU collection workbook: one sheet per SKU, sections of data point rows
  function fromWorkbook(wb, XL) {
    const skip = /^(sku index|sku x data point map|platform fields|read me)$/i;
    const map = wb.SheetNames.find(n => /sku x data point map/i.test(n));
    const out = [];
    let company = "", collection = false;
    wb.SheetNames.forEach(name => {
      if (skip.test(name)) return;
      const rows = XL.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "", raw: true });
      const isCo = /company/i.test(name);
      let level = isCo ? "Company" : "Product", mode = null, rids = [];
      const sku = isCo ? "(all)" : name.trim();
      const title = String((rows[0] || [])[0] || "");
      if (!isCo && title.includes(" · ")) out.push([sku, "Product", sku, "", "product_name", title.split(" · ").slice(1).join(" · ")]);
      rows.forEach((r, ri) => {
        const a = String(r[0] ?? "").trim();
        const at = c => `${name}!${XL.utils.encode_cell({ r: ri, c })}`;
        const sysOf = () => String(r[4] ?? "").trim(); // the collector's "Gets it from" answer
        if (!isCo && a === "Brand") out.push([sku, "Product", sku, "", "brand", String(r[2] ?? "")]);
        if (/^\d\.\s|^(company|denmark registration)$/i.test(a)) {
          level = /passport/i.test(a) ? "Passport" : /component/i.test(a) ? "Component" : /sales/i.test(a) ? "Sales" : /registration/i.test(a) ? "Market" : isCo ? "Company" : "Product";
          return;
        }
        if (a === "ID") {
          collection = true;
          if (String(r[6]).trim() === "Value") { mode = "single"; rids = []; }
          else { mode = "matrix"; rids = []; for (let i = 6; i < r.length && r[i] !== "" && !/^note$/i.test(String(r[i])); i++) rids.push(String(r[i]).split("\n")[0].trim()); }
          return;
        }
        if (!/^DP\d+/.test(a) || !mode) return;
        const field = String(r[2] ?? "").trim();
        if (mode === "single") {
          const v = r[6] == null ? "" : String(r[6]);
          out.push([sku, level, isCo ? "C" : sku, a, field, v, sysOf(), at(6)]);
          if (field === "legal_name") company = v;
        } else rids.forEach((rid, i) => out.push([sku, level, rid, a, field, r[6 + i] == null ? "" : String(r[6 + i]), sysOf(), at(6 + i)]));
      });
    });
    if (collection && out.length) return { rows: out, company, source: "SKU collection workbook" };
    // otherwise read the first table-like sheet (or the map sheet)
    const sh = wb.Sheets[map || wb.SheetNames[0]];
    return fromTable(XL.utils.sheet_to_json(sh, { header: 1, defval: "", raw: false }), "Excel");
  }
  // the system and field a value came from: the file's own answer, else the client profile's mapping for that data point
  // generic source names in a file (ERP, PLM, Supplier, Manual) are shown with the profile's system names (e.g. Snowflake, Trace One)
  const GEN_KEY = { erp: "erp", plm: "plm", supplier: "supplier", manual: "man", man: "man" };
  function stampSource(rows) {
    rows.forEach(r => {
      while (r.length < 8) r.push("");
      const m = FIELDS[r[4]] || {}, d = DPI[m.dp || r[3]];
      if (!d) return;
      const given = String(r[6]).trim(), k = GEN_KEY[given.toLowerCase()];
      r[6] = !given ? SOURCES[d.src].short : k ? SOURCES[k].short : given;
      const ref = String(r[7]).trim();
      // a workbook cell reference keeps the system field as well, so both the system and the collection cell are traceable
      r[7] = !ref ? d.field : ref.includes("!") ? `${k && k !== d.src ? SOURCES[k].name : d.field} · collected in ${ref}` : ref;
    });
    return rows;
  }
  function setData(res, fileName) {
    if (typeof res === "string") { toast(res); return; }
    const market = (res.market || (DS && DS.market) || "DK").toUpperCase();
    const company = res.company || (res.rows.find(r => r[4] === "legal_name") || [])[5] || fileName.replace(/\.[^.]+$/, "");
    const rows = stampSource(res.rows.map(r => r.slice(0, 8)));
    // load history: compare with the data already loaded
    const history = DS && DS.history ? DS.history.slice() : [];
    const n = (history.length ? history[0].n : 0) + 1;
    // company and registration values are one per client, whatever record id the file uses
    const key = r => ["Company", "Market"].includes(levelOf(r[4])) ? `(company)|${levelOf(r[4])}|${r[4]}` : `${r[0]}|${r[2]}|${r[4]}`;
    const prev = new Map((DS ? DS.rows : []).map(r => [key(r), r[5]]));
    const next = new Map(rows.map(r => [key(r), r[5]]));
    const changes = [];
    let added = 0, changed = 0, removed = 0;
    next.forEach((v, k) => {
      if (!prev.has(k)) { added++; if (prev.size) changes.push(["Added", ...k.split("|"), "", v]); }
      else if (String(prev.get(k) ?? "") !== String(v ?? "")) { changed++; changes.push(["Changed", ...k.split("|"), prev.get(k), v]); }
    });
    prev.forEach((v, k) => { if (!next.has(k)) { removed++; changes.push(["Removed", ...k.split("|"), v, ""]); } });
    rows.forEach(r => { r[8] = n; });
    DS = { company, market, profile: X.profile(), source: `${res.source} · ${fileName}`, loaded: X.stamp(), rows, history };
    build();
    history.unshift({ n, at: new Date().toISOString().slice(0, 16).replace("T", " "), file: fileName, source: res.source, profile: X.PROFILES[X.profile()].short,
      skus: M.skus.length, values: rows.length, err: M.issues.filter(i => i.sev === "error").length, warn: M.issues.filter(i => i.sev === "warning").length,
      first: !prev.size, added, changed, removed, changes: changes.slice(0, 300), more: Math.max(0, changes.length - 300) });
    DS.history = history.slice(0, 30);
    persist(); st.sku = M.skus[0] ? M.skus[0].sku : null; st.tab = "cov";
    toast(`Load #${n}: ${M.skus.length} SKUs · ${rows.length} values · ${M.issues.length} issues${prev.size ? ` · ${changed} changed, ${added} added, ${removed} removed since load #${n - 1}` : ""}.`);
    X.rerender();
  }
  async function importFile(file) {
    const name = file.name;
    try {
      if (/\.(xlsx|xlsm|xls)$/i.test(name)) {
        toast("Reading workbook…");
        await X.loadScript(X.LIBS.xlsx);
        const buf = await file.arrayBuffer();
        const wb = window.XLSX.read(buf, { type: "array" });
        setData(fromWorkbook(wb, window.XLSX), name);
      } else {
        const text = await file.text();
        setData(fromTable(X.parseCSV(text), "CSV"), name);
      }
    } catch (e) { toast("Couldn't read that file."); }
  }

  // ---------- exports ----------
  const PLAT_MAT = { PP: "PP (Polypropylene)", PET: "PET (Polyethylene terephthalate)", HDPE: "HDPE", LDPE: "LDPE", Steel: "Steel / Tinplate", Glass: "Glass", "Paper/board": "Paper / Board", Aluminium: "Aluminium" };
  function platformRows() {
    return M.skus.map(s => {
      const c = [...s.comps.values()][0] || {};
      const mat = /^plastic$/i.test(c.material || "") ? (PLAT_MAT[c.polymer] || "Plastic") : (PLAT_MAT[c.material] || (blank(c.material) ? "Unspecified" : c.material));
      const anyBlankW = [...s.comps.values()].some(r => blank(r.weight_g));
      return [s.sku, s.name, s.brand, mat, anyBlankW || !s.comps.size ? "" : Math.round(s.gPerUnit * 10) / 10, c.recycled_content_pct ?? "", s.units, M.market];
    });
  }
  const base = kind => `${X.slug(DS.company || "client")}_${M.market}_${kind}_${X.stamp()}`;
  function csv(name, rows) { X.download(new Blob([X.toCSV(rows)], { type: "text/csv;charset=utf-8" }), name); }
  function exportPlatform() {
    csv(base("platform-sku-import") + ".csv", [["sku", "name", "brand", "material", "packaging_weight_grams", "recycled_content_pct", "units_sold", "jurisdiction"], ...platformRows()]);
    toast(`Platform import file downloaded: ${M.skus.length} SKUs. Blank weights will show as Blocker Gap on the platform.`);
  }
  const issueHead = ["Severity", "Check", "SKU", "Record", "Data point", "Field", "Value", "Problem", "Source system"];
  const issueRow = i => [i.sev === "error" ? "Error" : "Warning", i.tag, i.sku, i.rid, i.dp, i.field, i.value, i.msg, i.src || ""];
  const loadOf = n => (DS.history || []).find(h => h.n === n);
  const MAP_HEAD = ["sku", "level", "record_id", "dp_id", "field", "value", "source_system", "source_field", "load_no", "loaded_on", "loaded_from"];
  const mapRow = r => { const h = loadOf(r[8]); return [...r.slice(0, 9), h ? h.at : "", h ? h.file : ""]; };
  function exportMap() {
    csv(base("sku-datapoint-map") + ".csv", [MAP_HEAD, ...DS.rows.map(mapRow)]);
    toast(`${DS.rows.length} values downloaded, each with its source and load.`);
  }
  const DOC_HEAD = ["Group", "Packaging type", "SKUs", "Products", "Current DoC references", "SKUs with no DoC", "Assessment", "Differs from other SKUs of this type", "Suppliers (heavy-metal evidence per supplier)"];
  const docRow = g => [g.id, g.type, g.skus.join("; "), g.names.join("; "), g.refs.join("; "), g.nodoc.join("; "), g.rec,
    g.others.map(o => `${o.sku}: ${o.diff.join("; ")}`).join(" | "), g.suppliers.join("; ")];
  const HIST_HEAD = ["Load", "Loaded at", "File", "Source", "Profile", "SKUs", "Values", "Errors", "Warnings", "Added", "Changed", "Removed"];
  const histRow = h => [h.n, h.at, h.file, h.source, h.profile, h.skus, h.values, h.err, h.warn, h.first ? "first load" : h.added, h.first ? "" : h.changed, h.first ? "" : h.removed];
  const COV_WORD = { full: "Complete", partial: "Partly", missing: "Missing" };
  async function exportCoverage() {
    toast("Preparing Excel file…");
    try {
      await X.loadScript(X.LIBS.xlsx);
      const XL = window.XLSX, wb = XL.utils.book_new();
      const head = ["SKU", "Product", "Brand", "% filled", "Errors", "Warnings", "g per unit", "Units in market", "Packaging kg", ...M.cols.map(c => `${c.dp} ${DPI[c.dp].name}`)];
      const rows = M.skus.map(s => [s.sku, s.name, s.brand, Math.round(s.pct * 100) / 100, s.err, s.warn, s.gOK ? Math.round(s.gPerUnit * 10) / 10 : "", s.units, s.gOK ? Math.round(s.kg) : "", ...M.cols.map(c => COV_WORD[s.cov[c.dp]])]);
      const s1 = XL.utils.aoa_to_sheet([head, ...rows]);
      s1["!cols"] = [16, 36, 16, 9, 8, 9, 10, 14, 13, ...M.cols.map(() => 14)].map(w => ({ wch: w }));
      XL.utils.book_append_sheet(wb, s1, "Coverage by SKU");
      const s2 = XL.utils.aoa_to_sheet([issueHead, ...M.issues.map(issueRow)]);
      s2["!cols"] = [9, 14, 16, 18, 8, 24, 20, 60].map(w => ({ wch: w }));
      XL.utils.book_append_sheet(wb, s2, "Data checks");
      const s3 = XL.utils.aoa_to_sheet([["sku", "name", "brand", "material", "packaging_weight_grams", "recycled_content_pct", "units_sold", "jurisdiction"], ...platformRows()]);
      XL.utils.book_append_sheet(wb, s3, "Platform import");
      const s5 = XL.utils.aoa_to_sheet([DOC_HEAD, ...M.doc.groups.map(docRow)]);
      s5["!cols"] = [7, 30, 30, 40, 24, 18, 40, 70, 40].map(w => ({ wch: w }));
      XL.utils.book_append_sheet(wb, s5, "DoC grouping (iNext)");
      const s6 = XL.utils.aoa_to_sheet([MAP_HEAD, ...DS.rows.map(mapRow)]);
      s6["!cols"] = [14, 10, 18, 7, 24, 30, 14, 44, 7, 16, 28].map(w => ({ wch: w }));
      XL.utils.book_append_sheet(wb, s6, "Values and sources");
      const s7 = XL.utils.aoa_to_sheet([HIST_HEAD, ...(DS.history || []).map(histRow)]);
      XL.utils.book_append_sheet(wb, s7, "Load history");
      const s8 = XL.utils.aoa_to_sheet([["Load", "Change", "SKU", "Record", "Field", "Old value", "New value"], ...(DS.history || []).flatMap(h => h.changes.map(c => [h.n, ...c]))]);
      XL.utils.book_append_sheet(wb, s8, "Changes");
      const s4 = XL.utils.aoa_to_sheet([["Client", DS.company], ["Market", M.market], ["Source", DS.source], ["Loaded", DS.loaded], ["Exported", X.stamp()],
        ["Note", "Coverage counts a value as filled when it is not empty; n/a counts as filled. Checks are a first pass and do not replace the platform's validation. DoC grouping is gap assessment input for iNext's DoC work: it compares recorded packaging attributes only, and the technical file must justify any group with representative, risk-specific evidence."]]);
      s4["!cols"] = [{ wch: 12 }, { wch: 100 }];
      XL.utils.book_append_sheet(wb, s4, "About");
      XL.writeFile(wb, base("sku-coverage") + ".xlsx");
      toast("Excel downloaded.");
    } catch (e) { toast("Couldn't create the Excel file here. Use the CSV downloads instead."); }
  }

  // ---------- checklist from SKU data ----------
  function checklistFrom(skuId) {
    const list = skuId ? [M.by.get(skuId)] : M.skus;
    const answers = {};
    // SKU-level data points: worst case across the chosen SKUs
    M.cols.forEach(c => {
      const sts = list.map(s => s.cov[c.dp]);
      const status = sts.every(x => x === "full") ? "have" : sts.every(x => x === "missing") ? "missing" : "get";
      answers[c.dp] = { status, note: skuId ? `From SKU data: ${skuId}` : `From SKU data: ${sts.filter(x => x === "full").length}/${sts.length} SKUs complete` };
    });
    // company and registration data points
    const co = {};
    Object.entries(FIELDS).forEach(([f, m]) => {
      if (!m.dp || !["Company", "Market"].includes(m.level) || !need(m.dp, M.market) || answers[m.dp]) return;
      (co[m.dp] = co[m.dp] || []).push(M.company[f]);
    });
    Object.entries(co).forEach(([dp, vals]) => {
      const n = vals.filter(x => !blank(x)).length;
      answers[dp] = { status: n === vals.length ? "have" : n ? "get" : "missing", note: "From company data" };
    });
    return answers;
  }
  function applyToFlow(skuId) {
    if (X.answerCount() && !window.confirm("Replace the current checklist answers with answers worked out from the SKU data? Download the checklist first if you want to keep it.")) return;
    const ans = checklistFrom(skuId);
    X.applyChecklist(`${DS.company}${skuId ? " · " + skuId : " · all SKUs"}`, ans, M.market, true);
    toast(`Flowchart now shows ${skuId || "all SKUs"}: ${Object.values(ans).filter(a => a.status === "have").length} complete, ${Object.values(ans).filter(a => a.status !== "have").length} with gaps.`);
  }

  // ---------- render ----------
  const covCls = { full: "cv-full", partial: "cv-part", missing: "cv-miss" };
  const sevMark = s => s === "error" ? `<span class="sev err">Error</span>` : `<span class="sev warn">Warning</span>`;
  function tiles() {
    const comps = M.skus.reduce((a, s) => a + s.comps.size, 0), lines = M.skus.reduce((a, s) => a + s.sales.size, 0);
    const avg = M.skus.length ? M.skus.reduce((a, s) => a + s.pct, 0) / M.skus.length : 0;
    const err = M.issues.filter(i => i.sev === "error").length, warn = M.issues.length - err;
    const kg = M.skus.reduce((a, s) => a + (s.gOK ? s.kg : 0), 0), part = M.skus.filter(s => !s.gOK).length;
    const t = (n, l, cls = "", tip = "") => `<div class="tile ${cls}"${tip ? ` title="${esc(tip)}"` : ""}><b>${n}</b><span>${l}</span></div>`;
    return `<div class="tiles">${t(M.skus.length, "SKUs")}${t(comps, "Components")}${t(lines, "Sales lines")}
      ${t(Math.round(avg * 100) + "%", "Filled")}${t(err, "Errors", err ? "bad" : "good")}${t(warn, "Warnings", warn ? "warn" : "")}
      ${t(fmt(kg / 1000, 1) + " t", "Packaging", part ? "warn" : "", part ? `${part} SKU${part > 1 ? "s" : ""} not counted: missing weights` : "")}</div>`;
  }
  function coverage() {
    const q = st.q.trim().toLowerCase();
    let list = M.skus.filter(s => !q || (s.sku + " " + s.name + " " + s.brand).toLowerCase().includes(q));
    if (st.gapsOnly) list = list.filter(s => s.pct < 1 || s.err);
    list = list.slice().sort(st.sort === "worst" ? (a, b) => a.pct - b.pct || b.err - a.err : (a, b) => a.sku.localeCompare(b.sku));
    const groups = SKU_LEVELS.map(l => ({ l, n: M.cols.filter(c => c.level === l).length })).filter(g => g.n);
    const needTag = c => c.need === "dpp" ? " dpp" : c.need === "ppwr" ? " ppwr" : "";
    return `<div class="skutools">
        <input type="search" class="search" id="sku-q" placeholder="Search SKU, product or brand" value="${esc(st.q)}" aria-label="Search SKUs">
        <label class="check"><input type="checkbox" id="sku-gaps" ${st.gapsOnly ? "checked" : ""}><span>Gaps only</span></label>
        <label class="sel"><select id="sku-sort" aria-label="Sort"><option value="worst" ${st.sort === "worst" ? "selected" : ""}>Least complete first</option><option value="sku" ${st.sort === "sku" ? "selected" : ""}>SKU</option></select></label>
        <span class="legend"><span><i class="cv-full"></i>Complete</span><span><i class="cv-part"></i>Partly</span><span><i class="cv-miss"></i>Missing</span></span>
      </div>
      <div class="covwrap"><table class="cov">
        <thead><tr><th rowspan="2" class="stick">SKU</th><th rowspan="2">Filled</th><th rowspan="2">Issues</th>${groups.map(g => `<th colspan="${g.n}" class="grp">${LEVEL_NAME[g.l]}</th>`).join("")}</tr>
        <tr>${M.cols.map(c => `<th class="dpcol${needTag(c)}" title="${esc(c.dp + " " + DPI[c.dp].name)}${c.need === "dpp" ? " (DPP, date TBC)" : c.need === "ppwr" ? " (PPWR)" : ""}"><span>${c.dp}</span></th>`).join("")}</tr></thead>
        <tbody>${list.map(s => `<tr>
          <th class="stick"><button type="button" class="link" data-sku-open="${esc(s.sku)}">${esc(s.sku)}</button><small>${esc(s.name)}</small></th>
          <td class="pct"><span class="bar2 mini"><span style="width:${Math.round(s.pct * 100)}%;background:var(--st-have)"></span></span>${Math.round(s.pct * 100)}%</td>
          <td class="iss">${s.err ? `<span class="sev err">${s.err}</span>` : ""}${s.warn ? `<span class="sev warn">${s.warn}</span>` : ""}${!s.err && !s.warn ? `<span class="okm">✓</span>` : ""}</td>
          ${M.cols.map(c => `<td><button type="button" class="cvc ${covCls[s.cov[c.dp]]}" data-sku-open="${esc(s.sku)}" data-sku-dp="${c.dp}" title="${esc(`${s.sku} · ${c.dp} ${DPI[c.dp].name}: ${COV_WORD[s.cov[c.dp]]}`)}" aria-label="${esc(`${s.sku} ${c.dp} ${COV_WORD[s.cov[c.dp]]}`)}"></button></td>`).join("")}
        </tr>`).join("")}</tbody>
      </table></div>
      ${list.length ? "" : `<p class="note">No SKUs match</p>`}`;
  }
  function issues() {
    const q = st.q.trim().toLowerCase();
    const tags = {};
    M.issues.forEach(i => { tags[i.tag] = (tags[i.tag] || 0) + 1; });
    let list = M.issues.filter(i => st.sev.has(i.sev) && (!st.tag || i.tag === st.tag) && (!q || (i.sku + " " + i.rid + " " + i.field + " " + i.msg).toLowerCase().includes(q)));
    const LIM = 400;
    const bySys = {};
    list.forEach(i => { const k = i.src || "Not mapped"; bySys[k] = (bySys[k] || 0) + 1; });
    return `<div class="skutools">
        <input type="search" class="search" id="sku-q" placeholder="Search SKU, field or problem" value="${esc(st.q)}" aria-label="Search issues">
        <label class="check"><input type="checkbox" data-sku-sev="error" ${st.sev.has("error") ? "checked" : ""}><span>Errors</span></label>
        <label class="check"><input type="checkbox" data-sku-sev="warning" ${st.sev.has("warning") ? "checked" : ""}><span>Warnings</span></label>
        <span class="tagbar"><button type="button" class="tagb${!st.tag ? " on" : ""}" data-sku-tag="">All <b>${M.issues.length}</b></button>${Object.entries(tags).map(([t, n]) =>
          `<button type="button" class="tagb${st.tag === t ? " on" : ""}" data-sku-tag="${esc(t)}">${esc(t)} <b>${n}</b></button>`).join("")}</span>
      </div>
      <div class="covwrap"><table class="isst"><thead><tr><th>Severity</th><th>Check</th><th>SKU</th><th>Record</th><th>Data point</th><th>Field</th><th>Value</th><th>Problem</th><th>Source</th></tr></thead>
      <tbody>${list.slice(0, LIM).map(i => `<tr><td>${sevMark(i.sev)}</td><td>${esc(i.tag)}</td><td>${i.sku === "(company)" ? "Company / registration" : `<button type="button" class="link" data-sku-open="${esc(i.sku)}" data-sku-dp="${esc(i.dp)}">${esc(i.sku)}</button>`}</td>
        <td class="mono">${esc(i.rid)}</td><td class="mono">${esc(i.dp)}</td><td class="mono">${esc(i.field)}</td><td>${esc(i.value)}</td><td>${esc(i.msg)}</td><td>${esc(i.src || "")}</td></tr>`).join("")}</tbody></table></div>
      ${list.length > LIM ? `<p class="note">+${list.length - LIM} more in the Excel export</p>` : list.length ? "" : `<p class="note">No issues match</p>`}`;
  }
  function detail() {
    const s = M.by.get(st.sku) || M.skus[0];
    if (!s) return `<p class="note">No SKUs loaded.</p>`;
    st.sku = s.sku;
    const idx = M.skus.indexOf(s);
    const iss = M.issues.filter(i => i.sku === s.sku);
    const bad = (rid, f) => iss.find(i => i.rid === rid && i.field === f);
    // where each value came from: system and field, and which load brought it in
    const srcRow = (rid, f) => M.srcIdx.get(rid + "|" + f);
    const srcText = (rid, f) => {
      const r = srcRow(rid, f); if (!r) return "";
      const h = loadOf(r[8]);
      return `Source: ${r[6] || "?"}${r[7] ? " · " + r[7] : ""}${h ? ` · load #${h.n}, ${h.at} (${h.file})` : ""}`;
    };
    const val = (rid, f, v) => {
      const b = bad(rid, f), hl = st.hl && (FIELDS[f] || {}).dp === st.hl;
      const tip = [b ? b.msg : "", srcText(rid, f)].filter(Boolean).join("\n");
      return `<td class="${blank(v) ? "vblank" : ""}${b ? (b.sev === "error" ? " verr" : " vwarn") : ""}${hl ? " hl" : ""}" title="${esc(tip)}">${blank(v) ? "–" : esc(v)}</td>`;
    };
    const rowsFor = lv => Object.entries(FIELDS).filter(([f, m]) => m.level === lv && m.dp && need(m.dp, M.market));
    // source column: the systems the loaded values came from (falls back to the usual source)
    const lead = (f, m, rids) => {
      const rs = rids.map(r => srcRow(r, f)).filter(Boolean);
      const sys = [...new Set(rs.map(r => r[6]).filter(Boolean))].join(", ") || SOURCES[DPI[m.dp].src].short;
      const ref = rs.length === 1 || new Set(rs.map(r => r[7])).size === 1 ? (rs[0] || [])[7] || "" : "several fields";
      return `<td class="mono">${m.dp}</td><td title="${esc(f)}">${esc(DPI[m.dp].name)}</td><td title="${esc(ref)}">${esc(sys)}</td>`;
    };
    const single = (lv, title) => {
      const rs = rowsFor(lv); if (!rs.length) return "";
      return `<h3>${title}</h3><div class="covwrap"><table class="dt"><thead><tr><th>ID</th><th>Data point</th><th>Source</th><th>Value</th></tr></thead>
        <tbody>${rs.map(([f, m]) => `<tr>${lead(f, m, [s.sku])}${val(s.sku, f, s.product[f])}</tr>`).join("")}</tbody></table></div>`;
    };
    const matrix = (lv, title, recs) => {
      const rs = rowsFor(lv).filter(([f]) => !["component_name"].includes(f) || lv !== "Component");
      const ids = [...recs.keys()];
      if (!ids.length) return `<h3>${title}</h3><p class="note">None recorded.</p>`;
      const headName = rid => lv === "Component" ? (recs.get(rid).component_name || "") : (recs.get(rid).channel || "channel?");
      return `<h3>${title} (${ids.length})</h3><div class="covwrap"><table class="dt"><thead><tr><th>ID</th><th>Data point</th><th>Source</th>${ids.map(r => `<th class="mono">${esc(r)}<small>${esc(headName(r))}</small></th>`).join("")}</tr></thead>
        <tbody>${rs.map(([f, m]) => `<tr>${lead(f, m, ids)}${ids.map(r => val(r, f, recs.get(r)[f])).join("")}</tr>`).join("")}
        ${lv === "Component" ? `<tr class="calc"><td></td><td colspan="2">Grams per sales unit (weight ÷ units per pack)</td>${ids.map(r => { const w = num(recs.get(r).weight_g), u = num(recs.get(r).units_per_pack); return `<td>${w != null && u >= 1 ? fmt(w / u, 2) : "–"}</td>`; }).join("")}</tr>` : ""}
        ${lv === "Sales" ? `<tr class="calc"><td></td><td colspan="2">Net units (placed − exported)</td>${ids.map(r => `<td>${fmt(Math.max((num(recs.get(r).units_placed) || 0) - (num(recs.get(r).units_exported) || 0), 0))}</td>`).join("")}</tr>` : ""}
        </tbody></table></div>`;
    };
    return `<div class="skutools">
        <button type="button" class="iconbtn" data-sku-step="-1" ${idx <= 0 ? "disabled" : ""} aria-label="Previous SKU">‹</button>
        <select id="sku-pick" aria-label="SKU">${M.skus.map(x => `<option value="${esc(x.sku)}" ${x === s ? "selected" : ""}>${esc(x.sku)} · ${esc(x.name)}</option>`).join("")}</select>
        <button type="button" class="iconbtn" data-sku-step="1" ${idx >= M.skus.length - 1 ? "disabled" : ""} aria-label="Next SKU">›</button>
        <button type="button" class="iconbtn" data-sku-flow="${esc(s.sku)}">Show in flowchart</button>
        ${st.hl ? `<span class="chip">Highlighting ${esc(st.hl)}<button type="button" data-sku-hl="" aria-label="Stop highlighting">×</button></span>` : ""}
      </div>
      <div class="skusum">
        <div><b>${esc(s.name || s.sku)}</b><span class="mono">${esc(s.sku)}</span></div>
        <div><b>${Math.round(s.pct * 100)}%</b><span>Filled</span></div>
        <div><b>${s.gOK ? fmt(s.gPerUnit, 1) + " g" : "–"}</b><span>Per unit</span></div>
        <div><b>${fmt(s.units)}</b><span>Units</span></div>
        <div><b>${s.gOK ? fmt(s.kg) + " kg" : "–"}</b><span>Packaging</span></div>
        <div><b class="${s.err ? "t-bad" : ""}">${s.err}</b><span>Errors</span></div>
        <div><b>${s.warn}</b><span>Warnings</span></div>
      </div>
      ${iss.length ? `<details class="skuiss" ${s.err ? "open" : ""}><summary>Issues (${iss.length})</summary><ul>${iss.map(i => `<li>${sevMark(i.sev)} <span class="mono">${esc(i.rid)}</span> · ${esc(i.msg)}</li>`).join("")}</ul></details>` : `<p class="note okline">✓ No issues</p>`}
      <div class="dtgrid">
        <div>${single("Product", "Product")}${single("Passport", "Product passport")}</div>
        <div>${matrix("Component", "Packaging components", s.comps)}${matrix("Sales", "Sales lines", s.sales)}</div>
      </div>`;
  }
  function docView() {
    const types = new Map();
    M.doc.groups.forEach(g => { if (!types.has(g.type)) types.set(g.type, []); types.get(g.type).push(g); });
    const badge = g => g.split ? `<span class="sev err">Split or assess</span>` : /already/.test(g.rec) ? `<span class="sev ok">Grouped</span>` : /may be considered/.test(g.rec) ? `<span class="sev warn">Could share</span>` : `<span class="sev">Own DoC</span>`;
    return `${M.doc.shared.length ? `<div class="skuiss"><b class="t-bad">Shared DoC, different packaging</b><ul>${M.doc.shared.map(x => `<li><span class="mono">${esc(x.ref)}</span> · ${x.skus.map(esc).join(", ")} · ${esc(x.diff)}</li>`).join("")}</ul></div>` : ""}
      <div class="docgrid">${[...types.entries()].map(([type, gs]) => `<section class="doccard">
        <header><b>${esc(type)}</b></header>
        ${gs.map(g => `<div class="docg">
          <div class="docg-h">${badge(g)} <span class="mono">${g.id}</span> ${g.skus.map(sk => `<button type="button" class="link mono" data-sku-open="${esc(sk)}" data-sku-dp="DP41">${esc(sk)}</button>`).join(" ")}</div>
          <p class="mono">${g.refs.map(esc).join(", ")}${g.nodoc.length ? `<span class="t-bad">${g.refs.length ? " · " : ""}No DoC</span>` : ""}</p>
          ${g.others.length ? `<details><summary>Differences</summary><ul>${g.others.map(o => `<li><b class="mono">${esc(o.sku)}</b>: ${o.diff.map(esc).join("; ") || "no recorded difference"}</li>`).join("")}</ul></details>` : ""}
        </div>`).join("")}</section>`).join("")}</div>`;
  }
  function historyView() {
    const H = DS.history || [];
    if (!H.length) return `<p class="note">No loads yet</p>`;
    return `<div class="covwrap"><table class="isst"><thead><tr>${HIST_HEAD.map(h => `<th>${h}</th>`).join("")}</tr></thead>
      <tbody>${H.map(h => `<tr>${histRow(h).map((c, i) => `<td class="${i === 0 || i >= 5 ? "mono" : ""}">${esc(c)}</td>`).join("")}</tr>
        ${h.changes.length ? `<tr><td></td><td colspan="${HIST_HEAD.length - 1}"><details><summary>Changes (${h.changes.length + h.more})</summary>
          <table class="dt"><thead><tr><th>Change</th><th>SKU</th><th>Record</th><th>Field</th><th>Old</th><th>New</th></tr></thead><tbody>${h.changes.map(c => `<tr>${c.map((x, i) => `<td class="${i > 0 && i < 4 ? "mono" : ""}">${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table>
          ${h.more ? `<p class="note">+${h.more} more</p>` : ""}</details></td></tr>` : ""}`).join("")}</tbody></table></div>`;
  }
  function render() {
    syncMenu();
    const el = $("skuview");
    if (!DS) {
      el.innerHTML = `<div class="clhead"><b class="h">SKU data</b>
        <div class="clactions">${SAMPLE ? `<button type="button" class="iconbtn" id="sku-sample">Load sample</button>` : ""}
        <button type="button" class="iconbtn" id="sku-import">Import</button><input type="file" id="sku-file" accept=".xlsx,.xlsm,.xls,.csv,text/csv" hidden></div></div>`;
      return;
    }
    if (!M) build();
    const tab = (k, l, n) => `<button type="button" role="tab" aria-selected="${st.tab === k}" data-sku-tab="${k}">${l}${n != null ? ` <b>${n}</b>` : ""}</button>`;
    el.innerHTML = `<div class="clhead">
        <div class="clhead-row"><div><b class="h">${esc(DS.company)} · ${esc(M.market)}</b></div>
          <div class="clactions">
            <select id="sku-flow-pick" aria-label="SKU for the flowchart"><option value="">All SKUs</option>${M.skus.map(s => `<option value="${esc(s.sku)}">${esc(s.sku)}</option>`).join("")}</select>
            <button type="button" class="iconbtn" id="sku-flow">Show in flowchart</button>
            <button type="button" class="iconbtn" id="sku-import">Import</button><input type="file" id="sku-file" accept=".xlsx,.xlsm,.xls,.csv,text/csv" hidden>
            <button type="button" class="link" id="sku-clear">Remove</button>
          </div></div>
        ${tiles()}
      </div>
      <div class="skutabs" role="tablist">${tab("cov", "Coverage by SKU")}${tab("iss", "Data checks", M.issues.length)}${tab("sku", "SKU detail")}${tab("doc", "DoC grouping", M.doc.groups.length)}${tab("hist", "Load history", (DS.history || []).length)}</div>
      <div class="skupanel">${{ cov: coverage, iss: issues, sku: detail, doc: docView, hist: historyView }[st.tab]()}</div>`;
  }
  function rerender(keepFocus) {
    const a = document.activeElement, id = a && a.id, pos = a && a.selectionStart;
    render();
    if (keepFocus && id && $(id)) { $(id).focus(); try { $(id).setSelectionRange(pos, pos); } catch (e) { /* ignore */ } }
  }

  // ---------- events ----------
  const root = $("skuview");
  root.addEventListener("click", e => {
    const t = e.target.closest("button, [data-sku-open]");
    if (!t) return;
    if (t.id === "sku-sample") { setData({ rows: SAMPLE.rows.map(r => r.slice()), company: SAMPLE.company, market: SAMPLE.market, source: SAMPLE.source }, "sample (fictional)"); return; }
    if (t.id === "sku-import") { $("sku-file").click(); return; }
    if (t.id === "sku-clear") { if (window.confirm("Remove the SKU data from this browser?")) { DS = null; M = null; persist(); render(); } return; }
    if (t.id === "sku-flow") return applyToFlow($("sku-flow-pick").value);
    if (t.dataset.skuFlow) return applyToFlow(t.dataset.skuFlow);
    if (t.dataset.skuTab) { st.tab = t.dataset.skuTab; render(); return; }
    if (t.dataset.skuTag != null && t.matches("[data-sku-tag]")) { st.tag = t.dataset.skuTag; render(); return; }
    if (t.dataset.skuStep) { const i = M.skus.findIndex(s => s.sku === st.sku) + Number(t.dataset.skuStep); if (M.skus[i]) { st.sku = M.skus[i].sku; render(); } return; }
    if (t.matches("[data-sku-hl]")) { st.hl = null; render(); return; }
    if (t.dataset.skuOpen) { st.sku = t.dataset.skuOpen; st.hl = t.dataset.skuDp || null; st.tab = "sku"; render(); root.scrollTop = 0; }
  });
  root.addEventListener("change", e => {
    const t = e.target;
    if (t.id === "sku-file") { const f = t.files[0]; if (f) importFile(f); t.value = ""; return; }
    if (t.id === "sku-gaps") { st.gapsOnly = t.checked; render(); return; }
    if (t.id === "sku-sort") { st.sort = t.value; render(); return; }
    if (t.id === "sku-pick") { st.sku = t.value; st.hl = null; render(); return; }
    if (t.dataset.skuSev) { t.checked ? st.sev.add(t.dataset.skuSev) : st.sev.delete(t.dataset.skuSev); render(); }
  });
  root.addEventListener("input", e => { if (e.target.id === "sku-q") { st.q = e.target.value; rerender(true); } });
  // keep the filter sidebar's own change handler from treating these inputs as filters
  root.addEventListener("change", e => e.stopPropagation());

  // SKU downloads live in the top Export menu, shown once data is loaded
  function syncMenu() { document.querySelectorAll(".sku-exp").forEach(e => { e.hidden = !DS; }); }
  [["exp-sku-xlsx", exportCoverage], ["exp-sku-plat", exportPlatform], ["exp-sku-map", exportMap]].forEach(([id, fn]) =>
    $(id).addEventListener("click", () => { $("export-menu").hidden = true; $("export-btn").setAttribute("aria-expanded", "false"); if (DS) { if (!M) build(); fn(); } }));

  if (DS) build();
  syncMenu();
  window.SKU_VIEW = { render };
})();
