"""Reference lists for workspace setup: supported countries and compliance modules."""

from __future__ import annotations

from typing import Literal

ModuleId = Literal["EPR", "PPWR", "DPP", "LCA"]

COUNTRIES: list[dict[str, str | bool]] = [
    {"code": "UK", "name": "United Kingdom", "eu": False},
    {"code": "DE", "name": "Germany", "eu": True},
    {"code": "FR", "name": "France", "eu": True},
    {"code": "ES", "name": "Spain", "eu": True},
    {"code": "IT", "name": "Italy", "eu": True},
    {"code": "DK", "name": "Denmark", "eu": True},
    {"code": "NL", "name": "Netherlands", "eu": True},
]

MODULES: list[dict[str, str]] = [
    {"id": "EPR", "name": "Extended producer responsibility"},
    {"id": "PPWR", "name": "EU packaging regulation"},
    {"id": "DPP", "name": "Digital product passport"},
    {"id": "LCA", "name": "Carbon footprint"},
]

COUNTRY_CODES = frozenset(str(c["code"]) for c in COUNTRIES)
EU_COUNTRIES = frozenset(str(c["code"]) for c in COUNTRIES if c["eu"])
# PPWR and DPP are EU rules: a workspace needs at least one EU country to use them.
EU_ONLY_MODULES = frozenset({"PPWR", "DPP"})
