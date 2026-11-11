"""EU Declaration of Conformity for packaging under the PPWR, built from the product's data.

Each requirement is checked against the stored values and shows the evidence it rests on.
A declaration is "ready" when its identifying fields are filled and no requirement lacks
data; otherwise it is a draft that lists what is missing. Texts exist in English and
Danish; the Danish text should be reviewed by a native speaker before legal use.
"""

from __future__ import annotations

from typing import Any, Literal

from app.catalog.models import FieldMap, Product

Lang = Literal["en", "da"]

HEADER_FIELDS = ("doc_reference", "doc_manufacturer", "doc_signatory", "doc_issue_date", "technical_file_refs")
HEAVY_METALS_LIMIT_MGKG = 100

TEXT: dict[str, dict[str, str]] = {
    "en": {
        "title": "EU Declaration of Conformity",
        "subtitle": "Packaging · Regulation (EU) 2025/40 on packaging and packaging waste",
        "product": "Packaging and product",
        "manufacturer": "Manufacturer",
        "responsibility": "This declaration of conformity is issued under the sole responsibility of the manufacturer.",
        "object": "Object of the declaration",
        "conformity": "The packaging described above is in conformity with the following requirements",
        "technical": "Technical documentation",
        "signed": "Signed for and on behalf of",
        "date": "Date of issue",
        "retention": "Kept until",
        "reference": "Declaration reference",
        "version": "Version",
        "sku": "SKU",
        "gtin": "GTIN",
        "component": "Component",
        "level": "Level",
        "material": "Material",
        "weight": "Weight (g)",
        "recycled": "Recycled content (%)",
        "recyclability": "Recyclability",
        "req_substances": "Substances in packaging (PFAS in food-contact packaging, heavy metals)",
        "req_recyclability": "Recyclable packaging",
        "req_recycled": "Minimum recycled content in plastic packaging",
        "req_minimisation": "Packaging minimisation",
        "req_labelling": "Labelling and data carrier",
        "draft": "Draft: data missing",
        "ready": "Ready to sign",
    },
    "da": {
        "title": "EU-overensstemmelseserklæring",
        "subtitle": "Emballage · Forordning (EU) 2025/40 om emballage og emballageaffald",
        "product": "Emballage og produkt",
        "manufacturer": "Fabrikant",
        "responsibility": "Denne overensstemmelseserklæring udstedes på fabrikantens eget ansvar.",
        "object": "Erklæringens genstand",
        "conformity": "Den ovenfor beskrevne emballage er i overensstemmelse med følgende krav",
        "technical": "Teknisk dokumentation",
        "signed": "Underskrevet for og på vegne af",
        "date": "Udstedelsesdato",
        "retention": "Opbevares indtil",
        "reference": "Erklæringens reference",
        "version": "Version",
        "sku": "Varenummer",
        "gtin": "GTIN",
        "component": "Komponent",
        "level": "Niveau",
        "material": "Materiale",
        "weight": "Vægt (g)",
        "recycled": "Genanvendt indhold (%)",
        "recyclability": "Genanvendelighed",
        "req_substances": "Stoffer i emballage (PFAS i emballage med fødevarekontakt, tungmetaller)",
        "req_recyclability": "Genanvendelig emballage",
        "req_recycled": "Minimumsindhold af genanvendt materiale i plastemballage",
        "req_minimisation": "Minimering af emballage",
        "req_labelling": "Mærkning og databærer",
        "draft": "Udkast: data mangler",
        "ready": "Klar til underskrift",
    },
}

LEVELS_DA = {"Primary": "Primær", "Secondary": "Sekundær", "Transit": "Transport"}
MATERIALS_DA = {
    "Plastic": "Plast",
    "Paper/board": "Papir/pap",
    "Glass": "Glas",
    "Steel": "Stål",
    "Aluminium": "Aluminium",
}


def _v(fields: FieldMap, key: str) -> str:
    return str((fields.get(key) or {}).get("value", "")).strip()


def _num(text: str) -> float | None:
    try:
        return float(text) if text else None
    except ValueError:
        return None


def _requirement(key: str, t: dict[str, str], status: str, evidence: list[str]) -> dict[str, Any]:
    return {"key": key, "label": t[f"req_{key}"], "status": status, "evidence": evidence}


def requirements(p: Product, t: dict[str, str]) -> list[dict[str, Any]]:
    comps = p.components
    fields = {**p.fields, **p.passport}

    # Substances: heavy metals within the limit; PFAS and SoC declarations where needed.
    subst, s_status = [], "ok"
    for c in comps:
        name = _v(c.fields, "component_name")
        metals = _num(_v(c.fields, "heavy_metals_mgkg"))
        if metals is None:
            s_status = "missing"
        elif metals > HEAVY_METALS_LIMIT_MGKG:
            s_status = "warning" if s_status == "ok" else s_status
            subst.append(f"{name}: {metals:g} mg/kg > {HEAVY_METALS_LIMIT_MGKG}")
        if _v(c.fields, "food_contact") == "Yes":
            ref = _v(c.fields, "pfas_declaration_ref")
            if ref in ("", "n/a"):
                s_status = "missing"
            else:
                subst.append(f"{name}: PFAS {ref}")
    # Recyclability per component.
    rec, r_status = [], "ok"
    for c in comps:
        result = _v(c.fields, "recyclability_result")
        if not result:
            r_status = "missing"
        elif result in ("Poor", "Not recyclable"):
            r_status = "warning" if r_status == "ok" else r_status
        elif result == "Limited" and r_status == "ok":
            r_status = "warning"
        if result:
            rec.append(f"{_v(c.fields, 'component_name')}: {result}")
    # Recycled content in plastic components, with a certificate when claimed.
    rc, rc_status = [], "ok"
    plastics = [c for c in comps if _v(c.fields, "material").lower() == "plastic"]
    for c in plastics:
        pct = _num(_v(c.fields, "recycled_content_pct"))
        cert = _v(c.fields, "recycled_content_cert")
        if pct is None:
            rc_status = "missing"
        else:
            rc.append(f"{_v(c.fields, 'component_name')}: {pct:g}%" + (f" ({cert})" if cert not in ("", "n/a") else ""))
            if pct > 0 and cert in ("", "n/a"):
                rc_status = "missing"
    if not plastics:
        rc = ["—"]
    # Minimisation.
    mini_ref, ratio = _v(fields, "minimisation_assessment_ref"), _v(fields, "empty_space_ratio_pct")
    m_status = "ok" if mini_ref else "missing"
    mini = [x for x in (mini_ref, f"{ratio}%" if ratio else "") if x]
    # Labelling.
    label, carrier = _v(fields, "harmonised_label_status"), _v(fields, "data_carrier_url")
    l_status = "missing" if not label else ("ok" if label in ("In place", "Done", "Yes") else "warning")
    lab = [x for x in (label, carrier) if x]

    return [
        _requirement("substances", t, s_status, subst),
        _requirement("recyclability", t, r_status, rec),
        _requirement("recycled", t, rc_status, rc),
        _requirement("minimisation", t, m_status, mini),
        _requirement("labelling", t, l_status, lab),
    ]


def declaration(p: Product, lang: Lang, manufacturer_fallback: str) -> dict[str, Any]:
    t = TEXT[lang]
    fields = {**p.fields, **p.passport}
    reqs = requirements(p, t)
    missing = [k for k in HEADER_FIELDS if not _v(fields, k)]
    status = "ready" if not missing and all(r["status"] != "missing" for r in reqs) else "draft"

    def level(text: str) -> str:
        return LEVELS_DA.get(text, text) if lang == "da" else text

    def material(text: str) -> str:
        return MATERIALS_DA.get(text, text) if lang == "da" else text

    return {
        "lang": lang,
        "status": status,
        "status_label": t[status],
        "text": t,
        "sku": p.sku,
        "product_name": _v(fields, "product_name") or p.sku,
        "gtin": _v(fields, "gtin"),
        "reference": _v(fields, "doc_reference"),
        "version": _v(fields, "doc_version"),
        "manufacturer": _v(fields, "doc_manufacturer") or manufacturer_fallback,
        "signatory": _v(fields, "doc_signatory"),
        "issue_date": _v(fields, "doc_issue_date"),
        "retention_until": _v(fields, "retention_until"),
        "technical_file_refs": [r.strip() for r in _v(fields, "technical_file_refs").split(";") if r.strip()],
        "components": [
            {
                "name": _v(c.fields, "component_name"),
                "level": level(_v(c.fields, "packaging_level")),
                "material": material(_v(c.fields, "material")),
                "weight_g": _v(c.fields, "weight_g"),
                "recycled_content_pct": _v(c.fields, "recycled_content_pct"),
                "recyclability": _v(c.fields, "recyclability_result"),
            }
            for c in p.components
        ],
        "requirements": reqs,
        "missing_fields": missing,
    }


def readiness(p: Product) -> dict[str, Any]:
    doc = declaration(p, "en", "")
    return {
        "sku": p.sku,
        "product_name": doc["product_name"],
        "status": doc["status"],
        "reference": doc["reference"],
        "requirements": {r["key"]: r["status"] for r in doc["requirements"]},
        "missing_fields": doc["missing_fields"],
    }
