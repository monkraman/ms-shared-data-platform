"""Writes the demo CSV files that complete the sample client's data after the ERP and PLM syncs:

* ``seeds/demo/vendor-declarations.csv``: what vendors declare per component (polymer, material
  split, colour, recyclability, recycled content and certificates, PFAS, heavy metals, substances).
* ``seeds/demo/compliance-register.csv``: what the client's own team enters once per product
  (container volume, DoC reference and signatory, retention, deposit scheme, passport level).

Values come from the sample data set (``app/catalog/reference/sample-products.json``). A few are
left out on purpose so the Gaps screen has something to show: ``GAPS`` lists them.

    python scripts/make_demo_csvs.py
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SAMPLE = ROOT / "app" / "catalog" / "reference" / "sample-products.json"
DATA_POINTS = ROOT / "app" / "catalog" / "reference" / "data-points.json"
FIELDS = ROOT / "app" / "catalog" / "reference" / "fields.json"
OUT = ROOT / "seeds" / "demo"

# (SKU, component id or None, field) left empty: vendors have not answered yet.
GAPS = {
    ("HLA-KET-700", "HLA-KET-700-01", "pfas_declaration_ref"),
    ("HLA-KET-700", "HLA-KET-700-01", "recycled_content_pct"),
    ("HLA-BABY-190", "HLA-BABY-190-02", "recyclability_result"),
    ("HLA-MAYO-400", None, "doc_signatory"),
}


def fields_from(source: str) -> list[tuple[str, str]]:
    """(field, level) of every field whose data point comes from ``source``."""
    by_dp = {d["code"]: d["source"] for d in json.loads(DATA_POINTS.read_text(encoding="utf-8"))["data_points"]}
    out = []
    for key, f in json.loads(FIELDS.read_text(encoding="utf-8")).items():
        if f["level"] in ("Product", "Passport", "Component") and by_dp.get(f["dp"]) == source:
            out.append((key, f["level"]))
    return out


def write(name: str, source: str) -> int:
    products = json.loads(SAMPLE.read_text(encoding="utf-8"))["products"]
    wanted = fields_from(source)
    keys = [k for k, _ in wanted]
    levels = dict(wanted)
    header = ["sku", "product_name", "component_id", "component_name", *keys]
    rows = []
    for p in products:
        product_values = {k: v["value"] for k, v in {**p["fields"], **p["passport"]}.items()}
        for c in p["components"]:
            values = {**product_values, **{k: v["value"] for k, v in c["fields"].items()}}
            row = [p["sku"], product_values.get("product_name", ""), c["id"], values.get("component_name", "")]
            for k in keys:
                component = c["id"] if levels[k] == "Component" else None
                row.append("" if (p["sku"], component, k) in GAPS else values.get(k, ""))
            rows.append(row)
    # Drop columns no product has a value for.
    used = [i for i in range(len(header)) if i < 4 or any(r[i] for r in rows)]
    with (OUT / name).open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([header[i] for i in used])
        w.writerows([[r[i] for i in used] for r in rows])
    return len(rows)


if __name__ == "__main__":
    print("vendor-declarations.csv:", write("vendor-declarations.csv", "supplier"), "rows")
    print("compliance-register.csv:", write("compliance-register.csv", "man"), "rows")
