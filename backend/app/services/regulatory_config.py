"""Regulatory configuration repository and compliance matrix calculation engine.
Serves configurable sectors, countries, regulations, and DP01-DP45 canonical data points.
"""

import json
from pathlib import Path
from typing import List, Dict, Optional
from app.schemas.configuration import (
    SectorConfig,
    CountryConfig,
    RegulationConfig,
    DataPointDefinition,
    ComplianceMatrixResponse,
)

# SECTOR DEFINITIONS
SECTORS_SEED: List[SectorConfig] = [
    SectorConfig(
        id="food_beverage",
        name="Food & Beverage",
        description="Packaged foodstuffs, beverages, shelf-stable, chilled and ambient consumer goods",
        default_categories=["Rigid Plastic", "Flexible Films", "Glass Containers", "Corrugated Cardboard", "Aluminium Cans", "Beverage Cartons"],
        active=True,
    ),
    SectorConfig(
        id="cosmetics_personal_care",
        name="Cosmetics & Personal Care",
        description="Skincare, haircare, colour cosmetics, perfumes, aerosols, and hygiene products",
        default_categories=["Plastic Bottles & Pumps", "Glass Jars", "Aerosol Cans", "Multi-layer Tubes", "Paperboard Cartons"],
        active=True,
    ),
    SectorConfig(
        id="batteries",
        name="Batteries & Portable Power",
        description="Industrial, automotive, EV, and portable consumer batteries under EU Battery Regulation 2023/1542",
        default_categories=["Lithium-ion Cells", "Alkaline / Zinc-Carbon", "Lead-Acid", "Nickel-Metal Hydride", "Battery Casings"],
        active=True,
    ),
    SectorConfig(
        id="electronics_eee",
        name="Electrical & Electronic Equipment (WEEE)",
        description="Consumer electronics, IT/telecoms, household appliances, and lighting",
        default_categories=["Small IT / Screens", "Consumer Electronics", "Polystyrene Packaging", "Corrugated Boxes", "Cable Ties"],
        active=True,
    ),
    SectorConfig(
        id="textiles_apparel",
        name="Textiles, Apparel & Footwear",
        description="Garments, household textiles, footwear, and apparel packaging under emerging EU textile EPR",
        default_categories=["Garment Polybags", "Hangers", "Shoe Boxes", "Hangtags & String", "Mailing Bags"],
        active=True,
    ),
    SectorConfig(
        id="retail_ecommerce",
        name="Retail & E-Commerce Fulfillment",
        description="Secondary, tertiary, e-commerce delivery packaging, pallets, stretch film, and dunnage",
        default_categories=["Corrugated Shipping Boxes", "Polyethylene Mailers", "Bubble Wrap / Air Pillows", "Gummed Paper Tape", "Pallet Stretch Wrap"],
        active=True,
    ),
    SectorConfig(
        id="construction_industrial",
        name="Construction & Industrial Packaging",
        description="Building materials, chemical containers, IBCs, industrial drums, and heavy transit packaging",
        default_categories=["Multiwall Paper Sacks", "Steel Drums", "Intermediate Bulk Containers (IBC)", "Heavy-duty Plastic Pallets"],
        active=True,
    ),
]

# REGULATION DEFINITIONS
REGULATIONS_SEED: List[RegulationConfig] = [
    RegulationConfig(
        regulation_code="UK_PEPR",
        name="UK Packaging Extended Producer Responsibility (pEPR)",
        country_code="UK",
        country_name="United Kingdom",
        description="Obligation to report biannual packaging data and pay modulated disposal fees via Defra RPD.",
        national_report_name="RPD packaging data file",
        fee_system_name="PackUK fee, adjusted by RAM rating",
        ppwr_applicable=False,
        applies_from="Live / 2025 Reporting Cycle",
        legal_basis="The Producer Responsibility Obligations (Packaging and Packaging Waste) Regulations 2024",
    ),
    RegulationConfig(
        regulation_code="EU_PPWR",
        name="EU Packaging and Packaging Waste Regulation (PPWR)",
        country_code="EU",
        country_name="European Union",
        description="Harmonised EU-wide recyclability performance grades (A-C), recycled content targets, minimisation, and Declaration of Conformity.",
        national_report_name="EU Declaration of Conformity and technical documentation",
        fee_system_name="Eco-modulation based on Recyclability Performance Grades A-E",
        ppwr_applicable=True,
        applies_from="12 Aug 2026",
        legal_basis="Regulation (EU) 2025/40 on packaging and packaging waste",
    ),
    RegulationConfig(
        regulation_code="DE_VERPACKG",
        name="German Packaging Act (VerpackG / LUCID)",
        country_code="DE",
        country_name="Germany",
        description="Mandatory registration with ZSVR LUCID and system participation contract with a dual system.",
        national_report_name="LUCID and dual system quantity reports",
        fee_system_name="Dual system fee, recyclability-based",
        ppwr_applicable=True,
        applies_from="Live",
        legal_basis="Verpackungsgesetz (VerpackG) BGBl. I S. 1434",
    ),
    RegulationConfig(
        regulation_code="FR_CITEO",
        name="French AGEC / Citeo Household Packaging EPR",
        country_code="FR",
        country_name="France",
        description="Annual declaration to Citeo or Adelphe with Triman on-pack logo and eco-modulation bonuses/maluses.",
        national_report_name="Citeo declaration",
        fee_system_name="Citeo contribution with bonus and malus",
        ppwr_applicable=True,
        applies_from="Live",
        legal_basis="Loi n° 2020-105 relative à la lutte contre le gaspillage et à l'économie circulaire (AGEC)",
    ),
    RegulationConfig(
        regulation_code="ES_RD1055",
        name="Spanish Packaging & Waste Regulation (RD 1055/2022) & Plastic Tax",
        country_code="ES",
        country_name="Spain",
        description="Obligatory registration in Registro de Productores de Producto (MITERD), collective SCRAP filing, plus €0.45/kg virgin plastic tax.",
        national_report_name="SCRAP declaration and MITERD annual report",
        fee_system_name="SCRAP fee (non-reusable plastic tax tracked alongside at €0.45/kg)",
        ppwr_applicable=True,
        applies_from="Live",
        legal_basis="Real Decreto 1055/2022 de envases y residuos de envases / Ley 7/2022",
    ),
    RegulationConfig(
        regulation_code="IT_CONAI",
        name="Italian Packaging Consortium EPR (CONAI)",
        country_code="IT",
        country_name="Italy",
        description="CONAI environmental contribution (CAC) segmented into environmental tiers based on recyclability and sortability.",
        national_report_name="CONAI declaration",
        fee_system_name="CONAI environmental contribution (CAC)",
        ppwr_applicable=True,
        applies_from="Live",
        legal_basis="Decreto Legislativo 3 aprile 2006, n. 152 (Codice dell'Ambiente)",
    ),
    RegulationConfig(
        regulation_code="DK_DPA",
        name="Danish Producer Responsibility (DPA / VANA)",
        country_code="DK",
        country_name="Denmark",
        description="Producer registration with DPA (Dansk Producentansvar) and collective scheme reporting with eco-modulated fees.",
        national_report_name="Danish producer register report (DPA)",
        fee_system_name="Producer responsibility fee (PRO modulated)",
        ppwr_applicable=True,
        applies_from="Live / Oct 2025 Milestones",
        legal_basis="Bekendtgørelse om emballage og emballageaffald (BEK nr 955)",
    ),
    RegulationConfig(
        regulation_code="NL_AFVALFONDS",
        name="Dutch Packaging Waste Fund (Afvalfonds Verpakkingen)",
        country_code="NL",
        country_name="Netherlands",
        description="Packaging declaration to Afvalfonds (Nedvang) with differentiated tariffs and circular design discounts.",
        national_report_name="Afvalfonds declaration",
        fee_system_name="Afvalfonds waste management contribution",
        ppwr_applicable=True,
        applies_from="Live",
        legal_basis="Besluit beheer verpakkingen 2014 / UPV Verpakkingen",
    ),
    RegulationConfig(
        regulation_code="US_CA_SB54",
        name="California Plastic Pollution Prevention & Packaging Producer Responsibility Act (SB 54)",
        country_code="US-CA",
        country_name="United States - California",
        description="PRO participation under CalRecycle with aggressive 2032 source reduction and recyclability benchmarks.",
        national_report_name="CalRecycle PRO compliance dataset",
        fee_system_name="CalRecycle / Circular Action Alliance modulated fee",
        ppwr_applicable=False,
        applies_from="2026/2027",
        legal_basis="California Public Resources Code §§ 42040-42084",
    ),
]

# COUNTRY DEFINITIONS
COUNTRIES_SEED: List[CountryConfig] = [
    CountryConfig(
        country_code="UK",
        country_name="United Kingdom",
        currency="GBP",
        is_eu_member=False,
        regulations=["UK_PEPR"],
        data_points_required_count=26,
        active=True,
    ),
    CountryConfig(
        country_code="DE",
        country_name="Germany",
        currency="EUR",
        is_eu_member=True,
        regulations=["DE_VERPACKG", "EU_PPWR"],
        data_points_required_count=39,
        active=True,
    ),
    CountryConfig(
        country_code="FR",
        country_name="France",
        currency="EUR",
        is_eu_member=True,
        regulations=["FR_CITEO", "EU_PPWR"],
        data_points_required_count=38,
        active=True,
    ),
    CountryConfig(
        country_code="ES",
        country_name="Spain",
        currency="EUR",
        is_eu_member=True,
        regulations=["ES_RD1055", "EU_PPWR"],
        data_points_required_count=38,
        active=True,
    ),
    CountryConfig(
        country_code="IT",
        country_name="Italy",
        currency="EUR",
        is_eu_member=True,
        regulations=["IT_CONAI", "EU_PPWR"],
        data_points_required_count=39,
        active=True,
    ),
    CountryConfig(
        country_code="DK",
        country_name="Denmark",
        currency="DKK",
        is_eu_member=True,
        regulations=["DK_DPA", "EU_PPWR"],
        data_points_required_count=38,
        active=True,
    ),
    CountryConfig(
        country_code="NL",
        country_name="Netherlands",
        currency="EUR",
        is_eu_member=True,
        regulations=["NL_AFVALFONDS", "EU_PPWR"],
        data_points_required_count=38,
        active=True,
    ),
    CountryConfig(
        country_code="US-CA",
        country_name="United States - California",
        currency="USD",
        is_eu_member=False,
        regulations=["US_CA_SB54"],
        data_points_required_count=28,
        active=True,
    ),
]


class RegulatoryConfigService:
    def __init__(self):
        self.sectors = {s.id: s for s in SECTORS_SEED}
        self.countries = {c.country_code: c for c in COUNTRIES_SEED}
        self.regulations = {r.regulation_code: r for r in REGULATIONS_SEED}
        self.data_points: Dict[str, DataPointDefinition] = {}
        self._load_data_points()

    def _load_data_points(self):
        seed_path = Path(__file__).parent / "data_points_seed.json"
        if seed_path.exists():
            with open(seed_path, "r", encoding="utf-8") as f:
                raw_dps = json.load(f)
                for item in raw_dps:
                    dp = DataPointDefinition(**item)
                    self.data_points[dp.id] = dp

    def get_all_sectors(self) -> List[SectorConfig]:
        return list(self.sectors.values())

    def get_all_countries(self) -> List[CountryConfig]:
        return list(self.countries.values())

    def get_regulations(self, country_code: Optional[str] = None) -> List[RegulationConfig]:
        if not country_code:
            return list(self.regulations.values())
        country_code_upper = country_code.upper()
        return [
            r for r in self.regulations.values()
            if r.country_code == country_code_upper or (r.country_code == "EU" and self.is_eu(country_code_upper))
        ]

    def is_eu(self, country_code: str) -> bool:
        country = self.countries.get(country_code)
        return country.is_eu_member if country else False

    def get_data_points(self, country_codes: Optional[List[str]] = None) -> List[DataPointDefinition]:
        if not country_codes:
            return list(self.data_points.values())
        upper_codes = [c.upper() for c in country_codes]
        matching = []
        for dp in self.data_points.values():
            if any(c in dp.applicable_countries for c in upper_codes):
                matching.append(dp)
        return matching

    def calculate_compliance_matrix(self, sector_ids: List[str], country_codes: List[str]) -> ComplianceMatrixResponse:
        upper_codes = [c.upper() for c in country_codes]
        
        # Determine applicable regulations
        active_regs: Dict[str, RegulationConfig] = {}
        has_eu_member = False
        
        for code in upper_codes:
            country = self.countries.get(code)
            if country:
                if country.is_eu_member:
                    has_eu_member = True
                for reg_code in country.regulations:
                    if reg_code in self.regulations:
                        active_regs[reg_code] = self.regulations[reg_code]

        if has_eu_member and "EU_PPWR" in self.regulations:
            active_regs["EU_PPWR"] = self.regulations["EU_PPWR"]

        # Required data points
        required_dps: List[DataPointDefinition] = []
        source_systems_set = set()
        for dp in self.data_points.values():
            if any(c in dp.applicable_countries for c in upper_codes):
                required_dps.append(dp)
                source_systems_set.add(dp.comes_from)

        national_reports = {
            r.country_code: f"{r.name}: {r.national_report_name}"
            for r in active_regs.values()
        }
        fee_systems = {
            r.country_code: f"{r.name}: {r.fee_system_name}"
            for r in active_regs.values()
        }

        return ComplianceMatrixResponse(
            applicable_regulations=list(active_regs.values()),
            total_data_points_required=len(required_dps),
            required_data_points=required_dps,
            source_systems_needed=sorted(list(source_systems_set)),
            national_reports=national_reports,
            fee_systems=fee_systems,
        )


regulatory_service = RegulatoryConfigService()

