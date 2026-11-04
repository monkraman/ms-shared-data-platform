/* EPR, PPWR and DPP Data Explorer: filters, client checklist, flowchart (pan/zoom), table and detail drawer. */
(function () {
  "use strict";
  const { DP, SOURCES, OUTPUTS, OUT_LABEL, COUNTRIES, DPP_NOTE } = window.EPR_DATA;
  const EU = COUNTRIES.filter(c => c.eu).map(c => c.code);
  const ALL_CODES = COUNTRIES.map(c => c.code);
  const OUT_ORDER = ["rep", "fee", "evid", "doc", "lab", "dpp"];
  const REGS = [
    { key: "EPR", name: "National EPR" },
    { key: "PPWR", name: "EU PPWR", eu: true },
    { key: "DPP", name: "EU Digital Product Passport", eu: true },
  ];
  const TIMING = [
    { key: "now", name: "EPR: in force now" },
    { key: "2026", name: "PPWR: from 12 Aug 2026" },
    { key: "2028", name: "PPWR: from 12 Aug 2028" },
    { key: "2030", name: "PPWR: from 2030" },
    { key: "dpp", name: "DPP: date set by delegated act" },
  ];
  const SCOPE = [
    { key: "common", name: "Needed in every country" },
    { key: "specific", name: "Country-specific" },
  ];
  // checklist answers: does the client hold this data point?
  const STATUS = [
    { key: "have", name: "We have it", short: "Have", mark: "✓", color: "--st-have" },
    { key: "get", name: "We can get it", short: "Can get", mark: "◐", color: "--st-get" },
    { key: "missing", name: "Not available", short: "Not available", mark: "✕", color: "--st-missing" },
    { key: "none", name: "Not answered", short: "Not answered", mark: "?", color: "--muted" },
  ];
  const ST = Object.fromEntries(STATUS.map(s => [s.key, s]));
  // flowchart columns: the four sources, plus a gap column for data the client does not have
  const COLS = { ...SOURCES, gap: { name: "Not available yet", short: "Gap", color: "--st-missing", bg: "--st-missing-bg" } };
  const COL_ORDER = ["erp", "supplier", "plm", "man", "gap"];

  // ---------- state ----------
  const defaults = () => ({
    countries: new Set(["DK"]), regs: new Set(REGS.map(r => r.key)),
    srcs: new Set(COL_ORDER), outs: new Set(Object.keys(OUTPUTS)),
    timing: new Set(TIMING.map(t => t.key)), scope: new Set(SCOPE.map(s => s.key)),
    useCl: true, cstat: new Set(STATUS.map(s => s.key)), q: "",
  });
  let F = defaults();
  const ui = { view: "flow", sel: null, drawerMin: false, hover: null, focusOut: null, filtersOpen: window.innerWidth > 1000 };
  const view = { s: 1, tx: 0, ty: 0, auto: true };

  // v3 key: checklist mode, checklist status and the gap column are new
  const STORE = "epr-explorer-filters-v3";
  const CL_STORE = "epr-explorer-checklist-v1";
  const SETS = ["countries", "regs", "srcs", "outs", "timing", "scope", "cstat"];
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved) {
      const d = defaults();
      SETS.forEach(k => { if (Array.isArray(saved[k])) d[k] = new Set(saved[k]); });
      if (typeof saved.useCl === "boolean") d.useCl = saved.useCl;
      F = d;
    }
  } catch (e) { /* storage unavailable: use defaults */ }
  function save() {
    try {
      const o = { useCl: F.useCl };
      SETS.forEach(k => { o[k] = [...F[k]]; });
      localStorage.setItem(STORE, JSON.stringify(o));
    } catch (e) { /* ignore */ }
  }
  let CL = { client: "", answers: {} };
  try {
    const c = JSON.parse(localStorage.getItem(CL_STORE) || "null");
    if (c && typeof c === "object") CL = { client: c.client || "", answers: c.answers || {} };
  } catch (e) { /* ignore */ }
  function saveCL() { try { localStorage.setItem(CL_STORE, JSON.stringify(CL)); } catch (e) { /* ignore */ } }

  // ---------- helpers ----------
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const v = name => `var(${name})`;
  const isEU = c => EU.includes(c);
  const regOf = o => OUTPUTS[o].reg;
  const isPPWR = o => regOf(o) === "PPWR";
  const isDPP = o => regOf(o) === "DPP";
  const euOnly = o => regOf(o) !== "EPR";
  const bucket = from => !from ? "2026" : from.includes("2028") ? "2028" : from.includes("2030") ? "2030" : "2026";
  const timingOf = (dp, o) => isDPP(o) ? "dpp" : isPPWR(o) ? bucket(dp.from) : "now";
  const selCountries = () => ALL_CODES.filter(c => F.countries.has(c));
  const countryName = c => COUNTRIES.find(x => x.code === c).name;
  const outsIn = (dp, c) => dp.out.filter(o => !(euOnly(o) && !isEU(c)));
  function appliesFrom(dp, outs) {
    const parts = [];
    if (outs.some(isPPWR)) parts.push("PPWR " + (dp.from || "12 Aug 2026"));
    if (outs.some(isDPP)) parts.push("DPP " + (dp.dppFrom || "TBC"));
    return parts.join(" · ");
  }

  // checklist
  const ans = id => CL.answers[id] || {};
  const statusOf = dp => ans(dp.id).status || "none";
  // where the client gets it: their answer, else the default source; not available goes to the gap column
  function colOf(dp) {
    if (!F.useCl) return dp.src;
    const a = ans(dp.id);
    if (a.status === "missing") return "gap";
    return a.src || dp.src;
  }
  function setAnswer(id, patch) {
    const a = { ...ans(id), ...patch };
    if (a.status === "none") delete a.status;
    if (!a.status && !a.src && !a.note) delete CL.answers[id]; else CL.answers[id] = a;
    saveCL();
  }

  function outsFor(dp) {
    const cs = dp.countries.filter(c => F.countries.has(c));
    if (!cs.length) return [];
    const euHere = cs.some(isEU);
    return dp.out.filter(o => {
      if (euOnly(o) && !euHere) return false;
      if (!F.regs.has(regOf(o))) return false;
      if (!F.outs.has(o)) return false;
      return F.timing.has(timingOf(dp, o));
    });
  }
  const scopeOf = dp => dp.countries.length === ALL_CODES.length ? "common" : "specific";
  const matchesQ = dp => { const q = F.q.trim().toLowerCase(); return !q || (dp.id + " " + dp.name + " " + dp.desc + " " + dp.field).toLowerCase().includes(q); };
  // data points that apply to the selected countries and regulations (the checklist works on this list)
  function applicable() { return DP.filter(dp => F.scope.has(scopeOf(dp)) && outsFor(dp).length > 0 && matchesQ(dp)); }
  // what the flowchart and table show: also filtered by column and checklist status
  function visible() {
    return applicable().filter(dp => F.srcs.has(colOf(dp)) && (!F.useCl || F.cstat.has(statusOf(dp))));
  }
  function outLabel(o) {
    const cs = selCountries();
    if (cs.length === 1) return OUT_LABEL[o][cs[0]] || OUT_LABEL[o]._;
    if (OUT_LABEL[o]._) return OUT_LABEL[o]._;
    return `${cs.length} countries: each country's own report or fee`;
  }
  function clCounts(list) {
    const n = { have: 0, get: 0, missing: 0, none: 0 };
    list.forEach(d => { n[statusOf(d)]++; });
    return n;
  }

  // ---------- filters panel ----------
  function group(id, title, items, isOn, open = true) {
    const on = items.filter(i => isOn(i)).length;
    return `<details class="fgroup" data-group="${id}" ${open ? "open" : ""}>
      <summary><span><span class="chev">›</span>${esc(title)}</span><span class="n">${on}/${items.length}</span></summary>
      <div class="fbody">
        ${items.length > 1 ? `<div class="fquick"><button type="button" class="link" data-all="${id}">Select all</button><button type="button" class="link" data-none="${id}">Clear</button></div>` : ""}
        ${items.map(i => `<label class="check${i.disabled ? " disabled" : ""}" title="${esc(i.title || "")}">
          <input type="checkbox" data-f="${id}" value="${esc(i.key)}" ${isOn(i) ? "checked" : ""} ${i.disabled ? "disabled" : ""}>
          ${i.color ? `<span class="dot" style="background:${v(i.color)}"></span>` : ""}<span>${esc(i.name)}</span>${i.cnt != null ? `<span class="cnt">${i.cnt}</span>` : ""}
        </label>`).join("")}
      </div></details>`;
  }
  function countFor(pred) { return DP.filter(pred).length; }
  function renderFilters() {
    const openState = {};
    document.querySelectorAll(".fgroup").forEach(g => { openState[g.dataset.group] = g.open; });
    const op = k => openState[k] ?? true;
    const anyEU = selCountries().some(isEU);
    const app = applicable();
    const cc = clCounts(app);
    $("filter-groups").innerHTML = [
      group("countries", "Country", COUNTRIES.map(c => ({ key: c.code, name: `${c.name} (${c.code})`, cnt: countFor(d => d.countries.includes(c.code)) })), i => F.countries.has(i.key), op("countries")),
      group("reg", "Regulation", REGS.map(r => ({ ...r, disabled: r.eu && !anyEU,
        title: r.eu && !anyEU ? `${r.key} is EU law; tick an EU country to use it` : "",
        cnt: countFor(d => d.out.some(o => regOf(o) === r.key)) })), i => F.regs.has(i.key), op("reg")),
      group("cl", "Client checklist", [{ key: "use", name: "Flowchart follows the checklist", title: "Place each data point where the client gets it, and mark what they have" }], () => F.useCl, op("cl")),
      group("cstat", "Checklist answer", STATUS.map(s => ({ key: s.key, name: s.name, color: s.color, cnt: cc[s.key], disabled: !F.useCl })), i => F.cstat.has(i.key), op("cstat")),
      group("srcs", "Comes from", COL_ORDER.map(k => ({ key: k, name: COLS[k].name, color: COLS[k].color,
        cnt: app.filter(d => colOf(d) === k).length, disabled: k === "gap" && !F.useCl })), i => F.srcs.has(i.key), op("srcs")),
      group("outs", "Goes into", OUT_ORDER.map(k => ({ key: k, name: OUTPUTS[k].name, color: OUTPUTS[k].color })), i => F.outs.has(i.key), op("outs")),
      group("timing", "When it applies", TIMING, i => F.timing.has(i.key), op("timing")),
      group("scope", "Scope", SCOPE, i => F.scope.has(i.key), op("scope")),
    ].join("");
  }
  function setGroup(id, on) {
    if (id === "countries") F.countries = on ? new Set(ALL_CODES) : new Set();
    if (id === "reg") F.regs = on ? new Set(REGS.map(r => r.key)) : new Set();
    if (id === "cl") F.useCl = on;
    if (id === "cstat") F.cstat = on ? new Set(STATUS.map(s => s.key)) : new Set();
    if (id === "srcs") F.srcs = on ? new Set(COL_ORDER) : new Set();
    if (id === "outs") F.outs = on ? new Set(Object.keys(OUTPUTS)) : new Set();
    if (id === "timing") F.timing = on ? new Set(TIMING.map(t => t.key)) : new Set();
    if (id === "scope") F.scope = on ? new Set(SCOPE.map(s => s.key)) : new Set();
  }
  function toggle(id, key, on) {
    if (id === "cl") { F.useCl = on; return; }
    const map = { countries: F.countries, reg: F.regs, cstat: F.cstat, srcs: F.srcs, outs: F.outs, timing: F.timing, scope: F.scope };
    on ? map[id].add(key) : map[id].delete(key);
  }

  // ---------- chips ----------
  function renderChips(list) {
    const chips = [];
    selCountries().forEach(c => chips.push({ g: "countries", k: c, t: countryName(c) }));
    REGS.filter(r => !F.regs.has(r.key)).forEach(r => chips.push({ g: "reg", k: r.key, t: "Hidden: " + r.name, off: true }));
    if (F.useCl) STATUS.filter(s => !F.cstat.has(s.key)).forEach(s => chips.push({ g: "cstat", k: s.key, t: "Hidden: " + s.name, off: true }));
    COL_ORDER.filter(k => !F.srcs.has(k) && (k !== "gap" || F.useCl)).forEach(k => chips.push({ g: "srcs", k, t: "Hidden: " + COLS[k].short, off: true }));
    Object.keys(OUTPUTS).filter(k => !F.outs.has(k)).forEach(k => chips.push({ g: "outs", k, t: "Hidden: " + OUTPUTS[k].name, off: true }));
    TIMING.filter(t => !F.timing.has(t.key)).forEach(t => chips.push({ g: "timing", k: t.key, t: "Hidden: " + t.name, off: true }));
    SCOPE.filter(s => !F.scope.has(s.key)).forEach(s => chips.push({ g: "scope", k: s.key, t: "Hidden: " + s.name, off: true }));
    const links = list.reduce((n, d) => n + outsFor(d).length, 0);
    const cc = clCounts(applicable());
    const prog = F.useCl ? `<span class="clsum" title="Checklist answers for the selected countries">${CL.client ? `<b>${esc(CL.client)}</b> · ` : ""}${STATUS.map(s =>
      `<span style="color:${v(s.color)}">${s.mark} ${cc[s.key]}</span>`).join(" ")}</span>` : "";
    $("chips").innerHTML = (chips.length ? chips.map(c => `<span class="chip">${esc(c.t)}<button type="button" data-chip-g="${c.g}" data-chip-k="${esc(c.k)}" data-chip-off="${c.off ? 1 : 0}" aria-label="${c.off ? "Show again" : "Remove"} ${esc(c.t)}">×</button></span>`).join("")
      : `<span class="note">No country selected. Tick one or more countries in the filters.</span>`)
      + prog + `<span class="count">${list.length} data points · ${links} links</span>`;
  }

  // ---------- flowchart layout: source columns on the left, outputs on the right ----------
  const L = { COLW: 228, CGAP: 26, WG: 150, OUTW: 270, HEAD: 40, BH: 30, PITCH: 40, OUTH: 92, OUTGAP: 22, PAD: 20 };
  let layout = null;
  function buildLayout(list) {
    const keys = COL_ORDER.filter(k => list.some(d => colOf(d) === k));
    const cols = keys.map((k, i) => ({ k, i, x: L.PAD + i * (L.COLW + L.CGAP) }));
    const leftW = keys.length ? keys.length * L.COLW + (keys.length - 1) * L.CGAP : 0;
    const outX = L.PAD + leftW + (keys.length ? L.WG : 0);
    const W = outX + L.OUTW + L.PAD;
    const maxN = Math.max(1, ...cols.map(c => list.filter(d => colOf(d) === c.k).length));
    const outs = OUT_ORDER.filter(o => list.some(d => outsFor(d).includes(o)));
    const colH = L.HEAD + maxN * L.PITCH;
    const outsH = outs.length * L.OUTH + Math.max(0, outs.length - 1) * L.OUTGAP;
    const H = Math.max(colH, outsH + L.HEAD) + 2 * L.PAD;
    const nodes = {};
    cols.forEach(c => {
      list.filter(d => colOf(d) === c.k).forEach((d, r) => { nodes[d.id] = { x: c.x, y: L.PAD + L.HEAD + r * L.PITCH, col: c.i, d }; });
    });
    const outTop = L.PAD + L.HEAD + Math.max(0, (H - 2 * L.PAD - L.HEAD - outsH) / 2);
    const outPos = {};
    outs.forEach((o, i) => { outPos[o] = { x: outX, y: outTop + i * (L.OUTH + L.OUTGAP) }; });
    layout = { W, H, cols, nodes, outs, outPos, busEnd: L.PAD + leftW + 16, ncols: keys.length };
    return layout;
  }
  // Wires leave each box on its right, drop into the gap below the row and run right along it, so they
  // pass between the boxes of the other columns instead of over them; then they curve into the output.
  function wires(lay) {
    const all = [];
    Object.values(lay.nodes).forEach(n => {
      const last = n.col === lay.ncols - 1;
      const lane = (n.col - (lay.ncols - 1) / 2) * 2.2;
      const yb = last ? n.y + L.BH / 2 : n.y + L.BH + (L.PITCH - L.BH) / 2 + lane;
      outsFor(n.d).forEach(o => { if (lay.outPos[o]) all.push({ n, o, yb }); });
    });
    // spread arrival points along each output box, in top-to-bottom order to limit crossings
    OUT_ORDER.forEach(o => {
      const ws = all.filter(w => w.o === o).sort((a, b) => a.yb - b.yb || a.n.col - b.n.col);
      const p = lay.outPos[o];
      ws.forEach((w, i) => { w.y2 = p ? p.y + 8 + (L.OUTH - 16) * (i + 1) / (ws.length + 1) : 0; });
    });
    return all.map(w => {
      const { n, o, yb, y2 } = w;
      const x1 = n.x + L.COLW, y1 = n.y + L.BH / 2, x2 = lay.outPos[o].x;
      let d;
      if (n.col === lay.ncols - 1) {
        const dx = (x2 - x1) * 0.5;
        d = `M${x1},${y1} C${x1 + dx},${y1} ${x2 - dx},${y2} ${x2},${y2}`;
      } else {
        const xb = lay.busEnd, dx = (x2 - xb) * 0.5;
        d = `M${x1},${y1} C${x1 + 10},${y1} ${x1 + 4},${yb} ${x1 + 14},${yb} L${xb},${yb} C${xb + dx},${yb} ${x2 - dx},${y2} ${x2},${y2}`;
      }
      const st = F.useCl ? statusOf(n.d) : "have";
      return { d, o, id: n.d.id, dash: st === "missing" ? "5 4" : st === "get" ? "2 3" : "" };
    });
  }

  function renderFlow(list) {
    $("empty").hidden = list.length > 0;
    const lay = buildLayout(list);
    const stage = $("stage");
    stage.style.width = lay.W + "px"; stage.style.height = lay.H + "px";
    const html = [];
    lay.cols.forEach(c => {
      const s = COLS[c.k];
      const n = list.filter(d => colOf(d) === c.k).length;
      html.push(`<div class="colhead" style="left:${c.x}px;top:${L.PAD}px;width:${L.COLW}px;color:${v(s.color)};border-color:${v(s.color)};background:${v(s.bg)}">${esc(s.name)}<span>${n}</span></div>`);
    });
    Object.values(lay.nodes).forEach(({ x, y, d }) => {
      const s = COLS[colOf(d)], st = statusOf(d);
      const moved = F.useCl && ans(d.id).src && ans(d.id).src !== d.src;
      html.push(`<button type="button" class="node${ui.sel === d.id ? " sel" : ""}${F.useCl ? " st-" + st : ""}" data-dp="${d.id}"
        title="${esc(d.name)}${F.useCl ? " · " + ST[st].name : ""}${moved ? " · moved from " + SOURCES[d.src].short : ""}"
        style="left:${x}px;top:${y}px;width:${L.COLW}px;height:${L.BH}px;border-left-color:${v(s.color)}">
        ${F.useCl ? `<span class="stm" style="color:${v(ST[st].color)}" aria-label="${ST[st].name}">${ST[st].mark}</span>` : ""}
        <span class="id">${d.id}</span><span class="nm">${esc(d.name)}</span>
        <span class="pips">${outsFor(d).map(o => `<span class="pip" style="background:${v(OUTPUTS[o].color)}"></span>`).join("")}</span></button>`);
    });
    if (lay.outs.length) {
      const ox = lay.outPos[lay.outs[0]].x;
      html.push(`<div class="colhead" style="left:${ox}px;top:${L.PAD}px;width:${L.OUTW}px;color:var(--ink);border-color:var(--rule);background:var(--panel)">Goes into<span>${lay.outs.length}</span></div>`);
    }
    lay.outs.forEach(o => {
      const p = lay.outPos[o];
      const feeding = list.filter(d => outsFor(d).includes(o));
      const gaps = F.useCl ? feeding.filter(d => statusOf(d) !== "have").length : 0;
      html.push(`<button type="button" class="outnode${ui.focusOut === o ? " focus" : ""}" data-out="${o}" style="left:${p.x}px;top:${p.y}px;width:${L.OUTW}px;height:${L.OUTH}px;border-color:${v(OUTPUTS[o].color)};color:${v(OUTPUTS[o].color)}">
        <b>${esc(OUTPUTS[o].name)}</b><span class="lbl">${esc(outLabel(o))}</span>
        <span class="cnt">${feeding.length} data points${F.useCl ? ` · <span style="color:${gaps ? "var(--st-missing)" : "var(--st-have)"}">${gaps ? gaps + " not in hand" : "all in hand"}</span>` : ""}</span></button>`);
    });
    $("nodes").innerHTML = html.join("");
    $("wires").setAttribute("width", lay.W); $("wires").setAttribute("height", lay.H);
    drawWires();
    if (view.auto) fit(); else applyView();
  }

  function drawWires() {
    if (!layout) return;
    const lay = layout;
    const focusDp = ui.hover && ui.hover.type === "dp" ? ui.hover.id : (ui.sel || null);
    const focusOut = ui.hover && ui.hover.type === "out" ? ui.hover.id : ui.focusOut;
    const anyFocus = focusDp || focusOut;
    const ws = wires(lay);
    // focused wires drawn last so they sit on top
    const on = w => (focusDp && focusDp === w.id) || (focusOut && focusOut === w.o);
    ws.sort((a, b) => on(a) - on(b));
    $("wires").innerHTML = ws.map(w => {
      const hi = on(w);
      const op = anyFocus ? (hi ? 0.95 : 0.06) : 0.34;
      return `<path d="${w.d}" fill="none" stroke="${v(OUTPUTS[w.o].color)}" stroke-width="${hi ? 2.4 : 1.3}" stroke-opacity="${op}"${w.dash ? ` stroke-dasharray="${w.dash}"` : ""}/>`;
    }).join("");
    document.querySelectorAll("#nodes .node").forEach(el => {
      const d = lay.nodes[el.dataset.dp]?.d;
      let dim = false;
      if (focusOut) dim = !outsFor(d).includes(focusOut);
      else if (focusDp) dim = el.dataset.dp !== focusDp;
      el.classList.toggle("dimmed", dim && !el.classList.contains("sel"));
    });
    document.querySelectorAll("#nodes .outnode").forEach(el => {
      let dim = false;
      if (focusDp) dim = !outsFor(lay.nodes[focusDp]?.d || DP.find(x => x.id === focusDp)).includes(el.dataset.out);
      else if (focusOut) dim = el.dataset.out !== focusOut;
      el.classList.toggle("dimmed", dim);
    });
  }

  // ---------- pan / zoom ----------
  function applyView() { $("stage").style.transform = `translate(${view.tx}px, ${view.ty}px) scale(${view.s})`; }
  function fit() {
    if (!layout) return;
    const c = $("canvas").getBoundingClientRect();
    if (!c.width || !c.height) return;
    const s = Math.min((c.width - 24) / layout.W, (c.height - 44) / layout.H, 1.35);
    view.s = Math.max(0.2, s);
    view.tx = (c.width - layout.W * view.s) / 2;
    view.ty = Math.max(8, (c.height - 28 - layout.H * view.s) / 2);
    view.auto = true;
    applyView();
  }
  function zoomAt(factor, cx, cy) {
    const c = $("canvas").getBoundingClientRect();
    const px = cx ?? c.width / 2, py = cy ?? c.height / 2;
    const ns = Math.min(3, Math.max(0.2, view.s * factor));
    view.tx = px - (px - view.tx) * (ns / view.s);
    view.ty = py - (py - view.ty) * (ns / view.s);
    view.s = ns; view.auto = false; applyView();
  }
  (function panZoom() {
    const cv = $("canvas");
    let drag = null;
    cv.addEventListener("pointerdown", e => {
      if (e.target.closest(".node, .outnode")) return;
      drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
      cv.setPointerCapture(e.pointerId); cv.classList.add("panning");
    });
    cv.addEventListener("pointermove", e => {
      if (!drag) return;
      view.tx = drag.tx + e.clientX - drag.x; view.ty = drag.ty + e.clientY - drag.y; view.auto = false; applyView();
    });
    const end = () => { drag = null; cv.classList.remove("panning"); };
    cv.addEventListener("pointerup", end); cv.addEventListener("pointercancel", end);
    cv.addEventListener("wheel", e => {
      const r = cv.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - r.left, e.clientY - r.top); }
      else { e.preventDefault(); view.tx -= e.deltaX; view.ty -= e.deltaY; view.auto = false; applyView(); }
    }, { passive: false });
  })();

  // ---------- table ----------
  const stTag = d => { const s = ST[statusOf(d)]; return `<span class="tag" style="color:${v(s.color)};border-color:${v(s.color)}">${s.mark} ${esc(s.short)}</span>`; };
  function renderTable(list) {
    $("tbody").innerHTML = list.length ? list.map(d => {
      const cs = d.countries.filter(c => F.countries.has(c));
      const outs = outsFor(d);
      const col = COLS[colOf(d)];
      return `<tr data-dp="${d.id}"><td class="mono">${d.id}</td><td>${esc(d.name)}</td>
        <td>${stTag(d)}</td>
        <td><span class="tag" style="color:${v(col.color)};border-color:${v(col.color)}">${esc(col.short)}</span></td>
        <td class="mono">${esc(d.field)}</td>
        <td>${outs.map(o => `<span class="tag" style="color:${v(OUTPUTS[o].color)};border-color:${v(OUTPUTS[o].color)}">${esc(OUTPUTS[o].name)}</span>`).join("")}</td>
        <td>${cs.map(c => `<span class="tag" style="color:var(--muted);border-color:var(--rule)">${c}</span>`).join("")}</td>
        <td class="mono">${esc(appliesFrom(d, outs)) || "–"}</td></tr>`;
    }).join("") : `<tr><td colspan="8" style="padding:24px;color:var(--muted)">No data points match these filters.</td></tr>`;
  }

  // ---------- checklist ----------
  function statusButtons(id, cur) {
    return `<div class="segs" role="radiogroup" aria-label="Does the client have it?">${STATUS.map(s =>
      `<button type="button" role="radio" aria-checked="${cur === s.key}" class="seg${cur === s.key ? " on" : ""}" style="--c:${v(s.color)}"
        data-cl-id="${id}" data-cl-status="${s.key}" id="seg-${id}-${s.key}">${s.mark} ${esc(s.short)}</button>`).join("")}</div>`;
  }
  function srcSelect(id, dp) {
    const a = ans(id);
    return `<select data-cl-id="${id}" data-cl-src aria-label="Where the client gets ${esc(dp.name)}">
      <option value="">${esc(SOURCES[dp.src].short)} (expected)</option>
      ${Object.entries(SOURCES).filter(([k]) => k !== dp.src).map(([k, s]) => `<option value="${k}" ${a.src === k ? "selected" : ""}>${esc(s.name)}</option>`).join("")}
    </select>`;
  }
  function renderChecklist() {
    const list = applicable();
    const cc = clCounts(list);
    const done = list.length - cc.none;
    $("cl-client").value = CL.client;
    $("cl-progress").innerHTML = `<div class="bar2" role="img" aria-label="${done} of ${list.length} answered">${["have", "get", "missing"].map(k =>
      `<span style="width:${list.length ? cc[k] / list.length * 100 : 0}%;background:${v(ST[k].color)}"></span>`).join("")}</div>
      <div class="legend">${STATUS.map(s => `<span><i style="background:${v(s.color)}"></i>${esc(s.name)} <b>${cc[s.key]}</b></span>`).join("")}
      <span class="muted">${done} of ${list.length} answered for ${selCountries().map(countryName).join(", ") || "no country"}</span></div>`;
    const groups = Object.keys(SOURCES).map(k => ({ k, items: list.filter(d => d.src === k) })).filter(g => g.items.length);
    $("cl-groups").innerHTML = groups.length ? groups.map(g => `<section class="clgroup">
      <header><span class="dot" style="background:${v(SOURCES[g.k].color)}"></span><b>Usually from ${esc(SOURCES[g.k].name)}</b><span class="muted">${g.items.length}</span>
        <span class="clquick">Mark all: ${STATUS.slice(0, 3).map(s => `<button type="button" class="link" data-cl-all="${g.k}" data-cl-status="${s.key}">${esc(s.short)}</button>`).join("")}</span></header>
      ${g.items.map(d => {
        const a = ans(d.id), st = statusOf(d);
        return `<div class="clrow st-${st}" data-row="${d.id}">
          <div class="clname"><button type="button" class="link mono" data-dp="${d.id}" title="Open details">${d.id}</button> <b>${esc(d.name)}</b>
            <p>${esc(d.desc)}</p>
            <p class="muted">${outsFor(d).map(o => `<span class="tag" style="color:${v(OUTPUTS[o].color)};border-color:${v(OUTPUTS[o].color)}">${esc(OUTPUTS[o].name)}</span>`).join("")}</p></div>
          <div class="clans">${statusButtons(d.id, st)}
            <div class="clsrc"><label>Where they get it ${srcSelect(d.id, d)}</label>
            <input type="text" data-cl-id="${d.id}" data-cl-note value="${esc(a.note || "")}" placeholder="System, owner or note" aria-label="Note for ${esc(d.name)}"></div></div>
        </div>`;
      }).join("")}</section>`).join("")
      : `<p class="note" style="padding:24px">No data points apply. Tick a country and a regulation in the filters.</p>`;
  }

  // ---------- drawer ----------
  function renderDrawer() {
    const d = DP.find(x => x.id === ui.sel);
    const dr = $("drawer"), tab = $("drawer-tab");
    if (!d) { dr.hidden = true; tab.hidden = true; return; }
    if (ui.drawerMin) {
      dr.hidden = true; tab.hidden = false; tab.textContent = `‹ ${d.id} ${d.name}`;
      return;
    }
    tab.hidden = true; dr.hidden = false;
    const s = SOURCES[d.src];
    const cs = d.countries.filter(c => F.countries.has(c));
    const rows = cs.map(c => {
      const outs = outsIn(d, c);
      const note = [d.notes[c], isEU(c) && d.notes._ && outs.some(isPPWR) ? d.notes._ : ""].filter(Boolean).join(" ");
      return `<tr><td class="mono">${c}</td><td>${outs.map(o => `<div><span class="dot" style="display:inline-block;background:${v(OUTPUTS[o].color)}"></span> ${esc(OUT_LABEL[o][c] || OUT_LABEL[o]._)}</div>`).join("")}${note ? `<div class="note" style="margin-top:4px">${esc(note)}</div>` : ""}</td></tr>`;
    }).join("");
    const a = ans(d.id);
    dr.innerHTML = `<div class="drawer-top"><span class="k">${d.id}</span><div>
        <button type="button" class="iconbtn small" id="d-min" title="Minimise" aria-label="Minimise details">–</button>
        <button type="button" class="iconbtn small" id="d-close" title="Close" aria-label="Close details">×</button></div></div>
      <h2>${esc(d.name)}</h2>
      <p style="margin:0">${esc(d.desc)}</p>
      <dl class="dl">
        <div><dt>Client checklist${CL.client ? " · " + esc(CL.client) : ""}</dt><dd>${statusButtons(d.id, statusOf(d))}
          <div class="clsrc" style="margin-top:8px"><label>Where they get it ${srcSelect(d.id, d)}</label>
          <input type="text" data-cl-id="${d.id}" data-cl-note value="${esc(a.note || "")}" placeholder="System, owner or note" aria-label="Note"></div></dd></div>
        <div><dt>Usually comes from</dt><dd><span class="tag" style="color:${v(s.color)};border-color:${v(s.color)}">${esc(s.name)}</span></dd></div>
        <div><dt>System / field (example)</dt><dd class="mono">${esc(d.field)}</dd></div>
        <div><dt>Goes into, by selected country</dt><dd>${rows ? `<table class="ctable"><tbody>${rows}</tbody></table>` : "Not needed in the selected countries."}</dd></div>
        ${d.out.some(isPPWR) ? `<div><dt>PPWR applies from</dt><dd class="mono">${esc(d.from || "12 Aug 2026")}</dd></div>` : ""}
        ${d.out.some(isDPP) ? `<div><dt>Digital Product Passport</dt><dd>${esc(d.dpp || "")}<p class="note" style="margin-top:4px">Applies from: ${esc(d.dppFrom || "TBC")}. ${esc(DPP_NOTE || "")}</p></dd></div>` : ""}
        <div><dt>Needed in</dt><dd>${d.countries.map(c => `<span class="tag" style="color:${F.countries.has(c) ? "var(--accent)" : "var(--muted)"};border-color:${F.countries.has(c) ? "var(--accent)" : "var(--rule)"}">${c}</span>`).join("")}</dd></div>
      </dl>`;
    $("d-min").onclick = () => { ui.drawerMin = true; renderDrawer(); };
    $("d-close").onclick = () => { ui.sel = null; renderAll(); };
  }

  // ---------- render ----------
  function renderAll() {
    const list = visible();
    if (ui.sel && !DP.some(d => d.id === ui.sel)) ui.sel = null;
    renderFilters();
    renderChips(list);
    $("filters").hidden = !ui.filtersOpen;
    $("toggle-filters").setAttribute("aria-expanded", String(ui.filtersOpen));
    $("canvas").hidden = ui.view !== "flow";
    $("tableview").hidden = ui.view !== "table";
    $("clview").hidden = ui.view !== "check";
    $("zoom").style.visibility = ui.view === "flow" ? "visible" : "hidden";
    ["flow", "table", "check"].forEach(k => $("v-" + k).setAttribute("aria-pressed", String(ui.view === k)));
    if (ui.view === "flow") renderFlow(list); else if (ui.view === "table") renderTable(list); else renderChecklist();
    renderDrawer();
    save();
  }

  // ---------- export ----------
  const LIBS = {
    jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
    svg2pdf: "https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js",
    xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  };
  const loaded = {};
  function loadScript(url) {
    if (!loaded[url]) loaded[url] = new Promise((res, rej) => {
      const s = document.createElement("script"); s.src = url; s.onload = res; s.onerror = () => rej(new Error("Could not load " + url));
      document.head.appendChild(s);
    });
    return loaded[url];
  }
  // fixed light palette for exports, so files look the same whatever the screen theme
  const PAL = {
    src: { erp: ["#2b5d8a", "#e6eef6"], supplier: ["#7a4b9c", "#f1eaf7"], plm: ["#9a5b12", "#fbf0e0"], man: ["#5a6472", "#eceef1"], gap: ["#b42318", "#fdecea"] },
    out: { rep: "#2b5d8a", fee: "#b45309", doc: "#0d6b66", lab: "#a3355e", evid: "#6b7684", dpp: "#4c4fb8" },
    st: { have: "#1f7a45", get: "#a86400", missing: "#b42318", none: "#5b6676" },
    ink: "#172231", muted: "#5b6676", rule: "#d0d7dd",
  };
  let toastTimer = null;
  function toast(msg) {
    const t = $("toast"); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }
  function stamp() { return new Date().toISOString().slice(0, 10); }
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  function fileBase(kind = "data-points") {
    const cs = selCountries();
    return `epr-ppwr-dpp-${kind}_${CL.client ? slug(CL.client) + "_" : ""}${cs.length ? cs.join("-") : "no-country"}_${stamp()}`;
  }
  function filterSummary() {
    const cs = selCountries();
    const off = (keys, set, name) => keys.filter(k => !set.has(k)).map(name);
    const anyEU = cs.some(isEU);
    const parts = [
      `Countries: ${cs.length ? cs.map(countryName).join(", ") : "none"}`,
      `Regulation: ${REGS.filter(r => F.regs.has(r.key) && (!r.eu || anyEU)).map(r => r.name).join(", ") || "none"}`,
    ];
    if (F.useCl) parts.push(`Client checklist${CL.client ? ": " + CL.client : ""}`);
    const hs = off(COL_ORDER, F.srcs, k => COLS[k].short);
    const hc = F.useCl ? off(STATUS.map(s => s.key), F.cstat, k => ST[k].name) : [];
    const ho = off(Object.keys(OUTPUTS), F.outs, k => OUTPUTS[k].name);
    const ht = off(TIMING.map(t => t.key), F.timing, k => TIMING.find(t => t.key === k).name);
    const hp = off(SCOPE.map(s => s.key), F.scope, k => SCOPE.find(s => s.key === k).name);
    if (hc.length) parts.push("Hidden answers: " + hc.join(", "));
    if (hs.length) parts.push("Hidden sources: " + hs.join(", "));
    if (ho.length) parts.push("Hidden outputs: " + ho.join(", "));
    if (ht.length) parts.push("Hidden timing: " + ht.join(", "));
    if (hp.length) parts.push("Hidden scope: " + hp.join(", "));
    if (F.q.trim()) parts.push(`Search: "${F.q.trim()}"`);
    return parts;
  }
  function trunc(s, n) { return s.length > n ? s.slice(0, n - 1) + "…" : s; }

  // Standalone SVG of the current flowchart (same layout as the screen)
  function flowchartSVG() {
    const list = visible();
    const lay = buildLayout(list);
    const HEAD = F.useCl ? 96 : 78;
    const W = lay.W, H = lay.H + HEAD;
    const t = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-size="${o.size || 11}" fill="${o.fill || PAL.ink}"${o.bold ? ' font-weight="bold"' : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}>${esc(s)}</text>`;
    const out = [`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`, `<rect x="0" y="0" width="${W}" height="${H}" fill="#ffffff"/>`];
    out.push(t(L.PAD, 26, `EPR, PPWR and DPP data flowchart${CL.client && F.useCl ? " · " + CL.client : ""}`, { size: 17, bold: true }));
    out.push(t(L.PAD, 46, filterSummary().join("   ·   "), { size: 10.5, fill: PAL.muted }));
    out.push(t(L.PAD, 63, `${list.length} data points · ${list.reduce((n, d) => n + outsFor(d).length, 0)} links · exported ${stamp()} · sample data, country rules indicative`, { size: 10, fill: PAL.muted }));
    if (F.useCl) {
      const cc = clCounts(list);
      let x = L.PAD;
      STATUS.forEach(s => {
        const label = `${s.mark} ${s.name}: ${cc[s.key]}`;
        out.push(t(x, 82, label, { size: 10.5, bold: true, fill: PAL.st[s.key] }));
        x += label.length * 6.4 + 22;
      });
      out.push(t(x, 82, "Dotted line: can get it · dashed line: not available", { size: 10, fill: PAL.muted }));
    }
    out.push(`<g transform="translate(0 ${HEAD})">`);
    wires(lay).forEach(w => out.push(`<path d="${w.d}" fill="none" stroke="${PAL.out[w.o]}" stroke-width="1" stroke-opacity="0.55"${w.dash ? ` stroke-dasharray="${w.dash}"` : ""}/>`));
    lay.cols.forEach(c => {
      const [col, bg] = PAL.src[c.k];
      const n = list.filter(d => colOf(d) === c.k).length;
      out.push(`<rect x="${c.x}" y="${L.PAD}" width="${L.COLW}" height="30" rx="7" fill="${bg}" stroke="${col}" stroke-width="1.4"/>`);
      out.push(t(c.x + 10, L.PAD + 19.5, COLS[c.k].name, { size: 11.5, bold: true, fill: col }));
      out.push(t(c.x + L.COLW - 10, L.PAD + 19.5, String(n), { size: 11, fill: col, anchor: "end" }));
    });
    Object.values(lay.nodes).forEach(({ x, y, d }) => {
      const [col] = PAL.src[colOf(d)];
      const st = statusOf(d);
      const dash = F.useCl && st === "get" ? ' stroke-dasharray="3 2"' : "";
      const stroke = F.useCl && st !== "none" ? PAL.st[st] : PAL.rule;
      out.push(`<rect x="${x}" y="${y}" width="${L.COLW}" height="${L.BH}" rx="5" fill="#ffffff" stroke="${stroke}" stroke-width="1"${dash}/>`);
      out.push(`<rect x="${x}" y="${y}" width="4" height="${L.BH}" fill="${col}"/>`);
      let tx = x + 10;
      if (F.useCl) { out.push(t(tx, y + 19, ST[st].mark, { size: 11, bold: true, fill: PAL.st[st] })); tx += 14; }
      out.push(t(tx, y + 19, d.id, { size: 9, fill: PAL.muted }));
      out.push(t(tx + 30, y + 19, trunc(d.name, F.useCl ? 28 : 31), { size: 10.5 }));
      outsFor(d).forEach((o, i) => out.push(`<rect x="${x + L.COLW - 10 - (outsFor(d).length - i) * 9 + 9}" y="${y + 11}" width="7" height="7" rx="1.5" fill="${PAL.out[o]}"/>`));
    });
    if (lay.outs.length) {
      const ox = lay.outPos[lay.outs[0]].x;
      out.push(t(ox + L.OUTW / 2, L.PAD + 19.5, "Goes into", { size: 11.5, bold: true, anchor: "middle" }));
    }
    lay.outs.forEach(o => {
      const p = lay.outPos[o];
      const feeding = list.filter(d => outsFor(d).includes(o));
      const gaps = feeding.filter(d => statusOf(d) !== "have").length;
      out.push(`<rect x="${p.x}" y="${p.y}" width="${L.OUTW}" height="${L.OUTH}" rx="9" fill="#ffffff" stroke="${PAL.out[o]}" stroke-width="2"/>`);
      out.push(t(p.x + 12, p.y + 24, OUTPUTS[o].name, { size: 12, bold: true }));
      out.push(t(p.x + 12, p.y + 44, trunc(outLabel(o), 46), { size: 10, fill: PAL.muted }));
      out.push(t(p.x + 12, p.y + 74, `${feeding.length} data points${F.useCl ? (gaps ? ` · ${gaps} not in hand` : " · all in hand") : ""}`, { size: 10.5, bold: true, fill: PAL.out[o] }));
    });
    out.push("</g></svg>");
    return { svg: out.join(""), W, H, count: list.length };
  }

  async function exportPDF() {
    const f = flowchartSVG();
    if (!f.count) { toast("Nothing to export: no data points match the filters."); return; }
    toast("Preparing PDF…");
    try {
      await loadScript(LIBS.jspdf);
      await loadScript(LIBS.svg2pdf);
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
      const pw = 420, ph = 297, m = 10;
      const s = Math.min((pw - 2 * m) / f.W, (ph - 2 * m) / f.H);
      const el = new DOMParser().parseFromString(f.svg, "image/svg+xml").documentElement;
      await doc.svg(el, { x: (pw - f.W * s) / 2, y: m, width: f.W * s, height: f.H * s });
      doc.save(fileBase() + ".pdf");
      toast("PDF downloaded.");
    } catch (err) {
      toast("Couldn't create the PDF here. Use Print and choose Save as PDF instead.");
    }
  }
  function printFlow() {
    const f = flowchartSVG();
    if (!f.count) { toast("Nothing to print: no data points match the filters."); return; }
    $("printarea").innerHTML = f.svg;
    window.print();
  }

  const clCols = d => { const a = ans(d.id); return [ST[statusOf(d)].name, a.src ? SOURCES[a.src].name : "", a.note || ""]; };
  function tableRows() {
    const list = visible();
    const head = ["ID", "Data point", "Description", "Usually comes from", "System / field (example)", "Goes into", "Regulation", "Countries", "Applies from", "DPP use",
      "Client has it?", "Client gets it from", "Client note"];
    const rows = list.map(d => {
      const outs = outsFor(d);
      return [d.id, d.name, d.desc, SOURCES[d.src].name, d.field, outs.map(o => OUTPUTS[o].name).join("; "),
        [...new Set(outs.map(regOf))].join(", "), d.countries.filter(c => F.countries.has(c)).join(", "), appliesFrom(d, outs),
        outs.some(isDPP) ? (d.dpp || "") : "", ...clCols(d)];
    });
    return { head, rows, list };
  }
  function byCountryRows(list) {
    const head = ["Country", "ID", "Data point", "Comes from", "Goes into", "Goes into (country name)", "Country note"];
    const rows = [];
    selCountries().forEach(c => list.forEach(d => {
      if (!d.countries.includes(c)) return;
      outsFor(d).filter(o => !(euOnly(o) && !isEU(c))).forEach(o => {
        const note = isDPP(o) ? (d.dpp || "") : [d.notes[c], isPPWR(o) && d.notes._ ? d.notes._ : ""].filter(Boolean).join(" ");
        rows.push([countryName(c), d.id, d.name, COLS[colOf(d)].name, OUTPUTS[o].name, OUT_LABEL[o][c] || OUT_LABEL[o]._, note]);
      });
    }));
    return { head, rows };
  }
  function download(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const csvCell = x => { const s = String(x ?? ""); return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const toCSV = rows => "﻿" + rows.map(r => r.map(csvCell).join(",")).join("\r\n");
  function exportCSV() {
    const { head, rows } = tableRows();
    if (!rows.length) { toast("Nothing to export: no data points match the filters."); return; }
    download(new Blob([toCSV([head, ...rows])], { type: "text/csv;charset=utf-8" }), fileBase() + ".csv");
    toast(`CSV downloaded: ${rows.length} data points.`);
  }
  async function exportXLSX() {
    const t = tableRows();
    if (!t.rows.length) { toast("Nothing to export: no data points match the filters."); return; }
    toast("Preparing Excel file…");
    try {
      await loadScript(LIBS.xlsx);
      const X = window.XLSX;
      const wb = X.utils.book_new();
      const s1 = X.utils.aoa_to_sheet([t.head, ...t.rows]);
      s1["!cols"] = [8, 30, 50, 22, 36, 44, 16, 22, 34, 50, 16, 22, 36].map(w => ({ wch: w }));
      s1["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: t.rows.length, c: t.head.length - 1 } }) };
      X.utils.book_append_sheet(wb, s1, "Data points");
      const bc = byCountryRows(t.list);
      const s2 = X.utils.aoa_to_sheet([bc.head, ...bc.rows]);
      s2["!cols"] = [16, 8, 30, 22, 28, 44, 50].map(w => ({ wch: w }));
      s2["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(1, bc.rows.length), c: bc.head.length - 1 } }) };
      X.utils.book_append_sheet(wb, s2, "By country");
      const s3 = X.utils.aoa_to_sheet([["Filters applied"], ...filterSummary().map(p => [p]), [], ["Exported", stamp()], ["Note", "Sample data. Country rules, field mappings and PPWR dates are indicative. DPP content and dates are set by ESPR delegated acts and are not yet fixed for drinks or packaging."]]);
      s3["!cols"] = [{ wch: 90 }, { wch: 20 }];
      X.utils.book_append_sheet(wb, s3, "Filters");
      X.writeFile(wb, fileBase() + ".xlsx");
      toast(`Excel downloaded: ${t.rows.length} data points.`);
    } catch (err) {
      toast("Couldn't create the Excel file here. Try Download as CSV instead.");
    }
  }

  // checklist file: one row per applicable data point, can be filled in Excel and imported back
  const CL_HEAD = ["Client", "ID", "Data point", "Description", "Usually comes from", "Goes into", "Has it? (We have it / We can get it / Not available)", "Gets it from (ERP / Supplier / PLM / Manual)", "Note"];
  function checklistRows() {
    return applicable().map(d => {
      const a = ans(d.id);
      return [CL.client, d.id, d.name, d.desc, SOURCES[d.src].name, outsFor(d).map(o => OUTPUTS[o].name).join("; "),
        a.status ? ST[a.status].name : "", a.src ? SOURCES[a.src].short : "", a.note || ""];
    });
  }
  function exportChecklistCSV() {
    const rows = checklistRows();
    if (!rows.length) { toast("Nothing to export: tick a country first."); return; }
    download(new Blob([toCSV([CL_HEAD, ...rows])], { type: "text/csv;charset=utf-8" }), fileBase("checklist") + ".csv");
    toast(`Checklist downloaded: ${rows.length} data points.`);
  }
  async function exportChecklistXLSX() {
    const rows = checklistRows();
    if (!rows.length) { toast("Nothing to export: tick a country first."); return; }
    toast("Preparing Excel file…");
    try {
      await loadScript(LIBS.xlsx);
      const X = window.XLSX;
      const wb = X.utils.book_new();
      const s = X.utils.aoa_to_sheet([CL_HEAD, ...rows]);
      s["!cols"] = [20, 8, 30, 50, 22, 40, 26, 22, 40].map(w => ({ wch: w }));
      s["!autofilter"] = { ref: X.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length, c: CL_HEAD.length - 1 } }) };
      X.utils.book_append_sheet(wb, s, "Checklist");
      const cc = clCounts(applicable());
      const s2 = X.utils.aoa_to_sheet([["Client", CL.client], ["Countries", selCountries().map(countryName).join(", ")], [],
        ...STATUS.map(x => [x.name, cc[x.key]]), [], ["Exported", stamp()],
        ["How to use", "Fill the 'Has it?' and 'Gets it from' columns, save as CSV, then use Import in the tool's Checklist view."]]);
      s2["!cols"] = [{ wch: 22 }, { wch: 80 }];
      X.utils.book_append_sheet(wb, s2, "Summary");
      X.writeFile(wb, fileBase("checklist") + ".xlsx");
      toast(`Checklist downloaded: ${rows.length} data points.`);
    } catch (err) {
      toast("Couldn't create the Excel file here. Try Download as CSV instead.");
    }
  }
  function parseCSV(text) {
    const rows = []; let row = [], cell = "", q = false;
    text = text.replace(/^﻿/, "");
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === "," || ch === ";" && !text.slice(0, 400).includes(",")) { row.push(cell); cell = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => c.trim()));
  }
  function importChecklist(text) {
    const rows = parseCSV(text);
    if (rows.length < 2) { toast("That file has no checklist rows."); return; }
    const h = rows[0].map(x => x.trim().toLowerCase());
    const col = pred => h.findIndex(pred);
    const iId = col(x => x === "id"), iSt = col(x => x.startsWith("has it")), iSrc = col(x => x.startsWith("gets it from")), iNote = col(x => x === "note"), iCl = col(x => x === "client");
    if (iId < 0 || iSt < 0) { toast("Couldn't read the file: it needs the ID and 'Has it?' columns from a checklist export."); return; }
    const stKey = s => { s = (s || "").trim().toLowerCase(); const m = STATUS.find(x => x.key === s || x.name.toLowerCase() === s || x.short.toLowerCase() === s); return m ? m.key : ""; };
    const srcKey = s => { s = (s || "").trim().toLowerCase(); const m = Object.entries(SOURCES).find(([k, x]) => k === s || x.short.toLowerCase() === s || x.name.toLowerCase() === s); return m ? m[0] : ""; };
    let n = 0;
    rows.slice(1).forEach(r => {
      const id = (r[iId] || "").trim().toUpperCase();
      const dp = DP.find(d => d.id === id);
      if (!dp) return;
      const src = iSrc >= 0 ? srcKey(r[iSrc]) : "";
      setAnswer(id, { status: stKey(r[iSt]) || "none", src: src && src !== dp.src ? src : "", note: iNote >= 0 ? (r[iNote] || "").trim() : (ans(id).note || "") });
      n++;
    });
    if (iCl >= 0 && rows[1][iCl] && rows[1][iCl].trim()) { CL.client = rows[1][iCl].trim(); saveCL(); }
    toast(`Imported ${n} checklist answers.`);
    renderAll();
  }

  function setMenu(open) {
    $("export-menu").hidden = !open;
    $("export-btn").setAttribute("aria-expanded", String(open));
  }
  $("export-btn").addEventListener("click", e => { e.stopPropagation(); setMenu($("export-menu").hidden); });
  document.addEventListener("click", e => { if (!e.target.closest(".export")) setMenu(false); });
  $("exp-pdf").addEventListener("click", () => { setMenu(false); exportPDF(); });
  $("exp-print").addEventListener("click", () => { setMenu(false); printFlow(); });
  $("exp-csv").addEventListener("click", () => { setMenu(false); exportCSV(); });
  $("exp-xlsx").addEventListener("click", () => { setMenu(false); exportXLSX(); });
  $("exp-cl-xlsx").addEventListener("click", () => { setMenu(false); exportChecklistXLSX(); });
  $("exp-cl-csv").addEventListener("click", () => { setMenu(false); exportChecklistCSV(); });
  $("cl-xlsx").addEventListener("click", exportChecklistXLSX);
  $("cl-csv").addEventListener("click", exportChecklistCSV);
  $("cl-import").addEventListener("click", () => $("cl-file").click());
  $("cl-file").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => importChecklist(String(r.result)); r.readAsText(f, "utf-8");
    e.target.value = "";
  });
  $("cl-clear").addEventListener("click", () => {
    if (!Object.keys(CL.answers).length) { toast("The checklist is already empty."); return; }
    if (!window.confirm("Clear all checklist answers on this device? Download the checklist first if you want to keep them.")) return;
    CL.answers = {}; saveCL(); renderAll(); toast("Checklist answers cleared.");
  });
  $("cl-client").addEventListener("input", e => { CL.client = e.target.value; saveCL(); renderChips(visible()); });
  $("cl-goflow").addEventListener("click", () => { ui.view = "flow"; F.useCl = true; view.auto = true; renderAll(); });

  // ---------- events ----------
  document.addEventListener("change", e => {
    const t = e.target;
    if (t.dataset.f) { toggle(t.dataset.f, t.value, t.checked); view.auto = true; renderAll(); return; }
    if (t.matches("[data-cl-src]")) { setAnswer(t.dataset.clId, { src: t.value }); view.auto = true; renderAll(); return; }
    if (t.matches("[data-cl-note]")) { setAnswer(t.dataset.clId, { note: t.value.trim() }); }
  });
  document.addEventListener("input", e => {
    const t = e.target;
    if (t.matches("[data-cl-note]")) setAnswer(t.dataset.clId, { note: t.value });
  });
  document.addEventListener("click", e => {
    const all = e.target.closest("[data-all]"), none = e.target.closest("[data-none]");
    if (all) { setGroup(all.dataset.all, true); view.auto = true; renderAll(); return; }
    if (none) { setGroup(none.dataset.none, false); view.auto = true; renderAll(); return; }
    const chip = e.target.closest("[data-chip-g]");
    if (chip) { toggle(chip.dataset.chipG, chip.dataset.chipK, chip.dataset.chipOff === "1"); view.auto = true; renderAll(); return; }
    const seg = e.target.closest("[data-cl-status]");
    if (seg && seg.dataset.clAll) {
      applicable().filter(d => d.src === seg.dataset.clAll).forEach(d => setAnswer(d.id, { status: seg.dataset.clStatus }));
      renderAll(); return;
    }
    if (seg) {
      const id = seg.dataset.clId, key = seg.dataset.clStatus;
      setAnswer(id, { status: statusOf(DP.find(d => d.id === id)) === key ? "none" : key });
      view.auto = true; renderAll();
      const again = $(`seg-${id}-${key}`); if (again) again.focus();
      return;
    }
    const node = e.target.closest("[data-dp]");
    if (node) { ui.sel = ui.sel === node.dataset.dp ? null : node.dataset.dp; ui.drawerMin = false; ui.focusOut = null; renderAll(); return; }
    const out = e.target.closest("[data-out]");
    if (out) { ui.focusOut = ui.focusOut === out.dataset.out ? null : out.dataset.out; ui.sel = null; renderAll(); }
  });
  $("nodes").addEventListener("pointerover", e => {
    const n = e.target.closest(".node"), o = e.target.closest(".outnode");
    const h = n ? { type: "dp", id: n.dataset.dp } : o ? { type: "out", id: o.dataset.out } : null;
    if (JSON.stringify(h) !== JSON.stringify(ui.hover)) { ui.hover = h; drawWires(); }
  });
  $("nodes").addEventListener("pointerleave", () => { ui.hover = null; drawWires(); });
  $("toggle-filters").addEventListener("click", () => { ui.filtersOpen = !ui.filtersOpen; view.auto = true; renderAll(); });
  $("hide-filters").addEventListener("click", () => { ui.filtersOpen = false; view.auto = true; renderAll(); });
  $("reset").addEventListener("click", () => { F = defaults(); $("q").value = ""; ui.sel = null; ui.focusOut = null; view.auto = true; renderAll(); });
  $("drawer-tab").addEventListener("click", () => { ui.drawerMin = false; renderDrawer(); });
  $("q").addEventListener("input", e => { F.q = e.target.value; view.auto = true; renderAll(); });
  $("v-flow").addEventListener("click", () => { ui.view = "flow"; view.auto = true; renderAll(); });
  $("v-table").addEventListener("click", () => { ui.view = "table"; renderAll(); });
  $("v-check").addEventListener("click", () => { ui.view = "check"; renderAll(); });
  $("z-in").addEventListener("click", () => zoomAt(1.2));
  $("z-out").addEventListener("click", () => zoomAt(1 / 1.2));
  $("z-fit").addEventListener("click", fit);
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") { if (ui.sel) { ui.sel = null; renderAll(); } else if (ui.focusOut) { ui.focusOut = null; renderAll(); } }
  });
  new ResizeObserver(() => { if (view.auto) fit(); }).observe($("canvas"));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (view.auto) fit(); });

  renderAll();
})();
