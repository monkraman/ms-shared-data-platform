"""Per-SKU business rules: UK RAM rating, PPWR recyclability grade, recycled-content targets,
markets and status. Every result is calculated from the stored values on read, with its reason.

Rules and thresholds are reference data (``reference/assessment.json``):

* **RAM rating** (UK, per component): a rating stated in the recyclability result wins. Otherwise
  Red for carbon-black plastic, PVC or PS, a main material under 80% of the component, a poor
  result or no assessment at all (unassessed packaging is Red under RAM); Amber for a limited
  result or a main material under 95%; Green for a good result.
* **PPWR grade** (per component, then per packaging unit): the recyclable share is the main
  material's share, capped by the recyclability result, black plastic and PVC/PS. The unit's
  share is the weight-weighted share of its primary components. A from 95%, B 80%, C 70%,
  D 50%, else E; D and E fail from 2030.
* **Recycled content** (per packaging unit: the components of one packaging level): the plastic
  part's weight-weighted recycled share against 30% (contact-sensitive, mainly PET), 10% (other
  contact-sensitive) or 35% (the rest), the 2030 targets. Units whose plastic is under 5% of
  their weight are exempt.
"""

from __future__ import annotations

import json
import re
from functools import cache
from pathlib import Path
from typing import Any

from app.catalog import reference as catalog_reference
from app.catalog.fields import FieldMap, number, value
from app.catalog.models import Product

_REFERENCE = Path(__file__).resolve().parent / "reference" / "assessment.json"
RAM_ORDER = {"Green": 0, "Amber": 1, "Red": 2}
GRADES = ("A", "B", "C", "D", "E")


@cache
def rules() -> dict[str, Any]:
    return json.loads(_REFERENCE.read_text(encoding="utf-8"))


@cache
def eu_countries() -> frozenset[str]:
    return frozenset(c["code"] for c in catalog_reference.dictionary()["countries"] if c.get("eu"))


def main_share(split: str) -> float:
    """The largest share in a material split ("PP 95; EVOH 5" → 95); 100 when there is none."""
    shares = [float(n) for n in re.findall(r"(\d+(?:\.\d+)?)\s*%?", split or "")]
    return max(shares) if shares and sum(shares) > 0 else 100.0


def _is_plastic(material: str) -> bool:
    return material.strip().lower() == "plastic"


def _is_black(colour: str) -> bool:
    text = colour.strip().lower()
    return any(c in text for c in rules()["ram"]["red_colours"])


def _grade(pct: float) -> str:
    return next(g for g, floor in rules()["ppwr_grade"]["thresholds"] if pct >= floor)


def component(fields: FieldMap, material: str | None = None) -> dict[str, Any]:
    """RAM rating and PPWR grade of one component, each with a reason.
    ``material`` replaces the stored material (scenarios)."""
    ram_rules, grade_rules = rules()["ram"], rules()["ppwr_grade"]
    material = material if material is not None else value(fields, "material")
    result = value(fields, "recyclability_result")
    polymer = value(fields, "polymer").upper()
    share = main_share(value(fields, "material_split"))
    plastic = _is_plastic(material)
    black = plastic and _is_black(value(fields, "colour"))
    red_polymer = plastic and polymer in ram_rules["red_polymers"]

    # UK RAM rating
    ram: str | None
    if not material:
        ram, ram_reason = None, "Material missing"
    elif result in ("Red", "Amber", "Green"):
        ram, ram_reason = result, "Stated rating"
    elif black:
        ram, ram_reason = "Red", "Carbon-black plastic is not detected in sorting"
    elif red_polymer:
        ram, ram_reason = "Red", f"{polymer} is not recycled at scale"
    elif share < ram_rules["red_below_main_share"]:
        ram, ram_reason = "Red", f"Multi-material, main material {share:g}%"
    elif result in ram_rules["red_results"]:
        ram, ram_reason = "Red", f"Recyclability {result.lower()}"
    elif not result:
        ram, ram_reason = "Red", "Not assessed"
    elif result in ram_rules["amber_results"]:
        ram, ram_reason = "Amber", f"Recyclability {result.lower()}"
    elif share < ram_rules["amber_below_main_share"]:
        ram, ram_reason = "Amber", f"Main material {share:g}%"
    elif result in ram_rules["green_results"]:
        ram, ram_reason = "Green", "Recyclable at scale"
    else:
        ram, ram_reason = "Red", f'Unknown result "{result}"'

    # PPWR recyclability grade
    pct: float | None
    if result in GRADES:
        pct, grade, grade_reason = None, result, "Stated grade"
    elif not material:
        pct, grade, grade_reason = None, None, "Material missing"
    elif not result or result not in grade_rules["cap_by_result"]:
        pct, grade, grade_reason = None, None, "Recyclability not assessed"
    else:
        pct = min(share, grade_rules["cap_by_result"][result])
        grade_reason = f"Recyclability {result.lower()}"
        if share < 100:
            grade_reason += f", main material {share:g}%"
        if black:
            pct, grade_reason = min(pct, grade_rules["cap_black_plastic"]), "Carbon-black plastic"
        if red_polymer:
            pct, grade_reason = min(pct, grade_rules["cap_red_polymer"]), f"{polymer} plastic"
        grade = _grade(pct)

    return {
        "ram": ram,
        "ram_reason": ram_reason,
        "grade": grade,
        "recyclable_pct": pct,
        "grade_reason": grade_reason,
    }


def recycled_content(p: Product) -> list[dict[str, Any]]:
    """Recycled content of the plastic part of each packaging unit (one per packaging level)
    against its 2030 target. ``met`` is None when a plastic component's share is unknown."""
    rc = rules()["recycled_content"]
    units: dict[str, list[Any]] = {}
    for c in p.components:
        units.setdefault(value(c.fields, "packaging_level") or "Unspecified", []).append(c)
    out = []
    for level, comps in units.items():
        plastic = [c for c in comps if _is_plastic(value(c.fields, "material"))]
        weight = {c.code: number(value(c.fields, "weight_g")) or 0 for c in comps}
        plastic_g = sum(weight[c.code] for c in plastic)
        total_g = sum(weight.values())
        if plastic_g <= 0:
            continue
        contact = any(value(c.fields, "food_contact").lower() == "yes" for c in plastic)
        pet_g = sum(weight[c.code] for c in plastic if value(c.fields, "polymer").upper() == "PET")
        if not contact:
            target, basis = rc["other"], "Not contact-sensitive"
        elif pet_g > plastic_g / 2:
            target, basis = rc["contact_sensitive_pet"], "Contact-sensitive, mainly PET"
        else:
            target, basis = rc["contact_sensitive_other"], "Contact-sensitive, other plastic"
        shares = [number(value(c.fields, "recycled_content_pct")) for c in plastic]
        pct = (
            None
            if any(s is None for s in shares)
            else round(sum(weight[c.code] * (s or 0) for c, s in zip(plastic, shares, strict=True)) / plastic_g, 1)
        )
        exempt = total_g > 0 and plastic_g / total_g < rc["exempt_below_plastic_share"] / 100
        out.append(
            {
                "level": level,
                "plastic_g": round(plastic_g, 2),
                "recycled_pct": pct,
                "target_pct": target,
                "basis": "Plastic under 5% of the unit's weight" if exempt else basis,
                "exempt": exempt,
                "met": True if exempt else None if pct is None else pct >= target,
            }
        )
    return out


def markets(p: Product, workspace_countries: list[str]) -> tuple[list[str], bool]:
    """Countries the SKU is sold in, from its sales lines. Lines without a market count for every
    country of the workspace; the second value says whether that assumption was made."""
    found = {value(s.fields, "market").upper() for s in p.sales}
    assumed = "" in found or not found
    found.discard("")
    if assumed:
        found |= set(workspace_countries)
    return sorted(found), assumed


def worst_ram(ratings: list[str | None]) -> str | None:
    known = [r for r in ratings if r]
    return max(known, key=RAM_ORDER.__getitem__) if known else None


def packaging_unit(p: Product, per_component: dict[str, dict[str, Any]]) -> dict[str, Any]:
    """The PPWR grade of the sales unit: weight-weighted recyclable share of its primary components."""
    primary = [c for c in p.components if value(c.fields, "packaging_level") == "Primary"] or list(p.components)
    if not primary:
        return {"grade": None, "recyclable_pct": None, "grade_reason": "No packaging components"}
    stated = [per_component[c.code]["grade"] for c in primary if per_component[c.code]["recyclable_pct"] is None]
    if any(g is None for g in stated):
        missing = sum(1 for g in stated if g is None)
        return {"grade": None, "recyclable_pct": None, "grade_reason": f"{missing} primary component(s) not assessed"}
    if stated:  # graded by an assessment: the unit takes the worst stated or calculated grade
        worst = max([*stated, *(per_component[c.code]["grade"] for c in primary)], key=GRADES.index)
        return {"grade": worst, "recyclable_pct": None, "grade_reason": "Worst component grade"}
    weights = [
        (number(value(c.fields, "weight_g")) or 0) / (number(value(c.fields, "units_per_pack")) or 1) for c in primary
    ]
    total = sum(weights)
    if total <= 0:
        return {"grade": None, "recyclable_pct": None, "grade_reason": "Primary weights missing"}
    pct = sum(w * per_component[c.code]["recyclable_pct"] for c, w in zip(primary, weights, strict=True)) / total
    pct = round(pct, 1)
    weakest = min(primary, key=lambda c: per_component[c.code]["recyclable_pct"])
    reason = f"{pct:g}% recyclable by weight"
    if per_component[weakest.code]["recyclable_pct"] < 95:
        reason += f"; weakest: {value(weakest.fields, 'component_name') or weakest.code}"
    return {"grade": _grade(pct), "recyclable_pct": pct, "grade_reason": reason}


def product(
    p: Product,
    *,
    workspace_countries: list[str],
    ppwr: bool,
    fees: list[dict[str, Any]],
    open_gaps: int,
) -> dict[str, Any]:
    """Everything the SKU library shows for one SKU beyond its stored values."""
    per_component = {c.code: component(c.fields) for c in p.components}
    unit = packaging_unit(p, per_component)
    sold_in, assumed = markets(p, workspace_countries)
    ram = worst_ram([a["ram"] for a in per_component.values()])
    recycled = recycled_content(p)
    misses = [u for u in recycled if u["met"] is False]
    in_eu = ppwr and any(m in eu_countries() for m in sold_in)

    reasons: list[str] = []
    if in_eu and unit["grade"] in rules()["ppwr_grade"]["fails_2030"]:
        reasons.append(f"PPWR grade {unit['grade']} fails from 2030")
    if in_eu and misses:
        levels = ", ".join(u["level"].lower() for u in misses)
        reasons.append(f"Recycled plastic below the 2030 target ({levels})")
    at_risk = bool(reasons)
    if open_gaps:
        reasons.append(f"{open_gaps} open gap(s)")
    unrated = sum(1 for a in per_component.values() if a["ram"] is None)
    if unrated:
        reasons.append(f"{unrated} component(s) without a material")
    status = "at_risk" if at_risk else "issue" if reasons else "ok"

    return {
        "markets": sold_in,
        "markets_assumed": assumed,
        "ppwr_in_scope": in_eu,
        "fees": fees,
        "ram": ram,
        "ram_counts": {r: sum(1 for a in per_component.values() if a["ram"] == r) for r in RAM_ORDER},
        **unit,
        "recycled_content": recycled,
        "recycled_target_misses": len(misses),
        "status": status,
        "status_reasons": reasons,
        "components": per_component,
    }
