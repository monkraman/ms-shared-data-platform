"""Thread-safe multi-tenant memory store and seed fixtures for KHC demo prototype."""

import copy
from datetime import datetime
from threading import Lock
from typing import Dict, List, Optional

from app.schemas.tenancy import TenantBase, TenantCreate, TenantResponse, TenantTier
from app.schemas.canonical import (
    MaterialCategory,
    PackagingComponentBase,
    PackagingLevel,
    PlacedOnMarketSales,
    ProductResponse,
    SourceLineage,
    SourceSystemType,
    IngestionBatch,
)
from app.schemas.quality import (
    DataQualityIssue,
    IssueSeverity,
    IssueStatus,
    SourceCorrectionTicket,
)
from app.schemas.epr import (
    CalculationRunResponse,
    JurisdictionRuleSet,
    TariffRate,
)


class DataStore:
    """Thread-safe multi-tenant data store pre-seeded with KHC Kraft Heinz demo portfolio."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.tenants: Dict[str, TenantResponse] = {}
        self.products: Dict[str, Dict[str, ProductResponse]] = {}  # tenant_id -> sku -> ProductResponse
        self.sales: Dict[str, List[PlacedOnMarketSales]] = {}      # tenant_id -> list of PlacedOnMarketSales
        self.batches: Dict[str, List[IngestionBatch]] = {}         # tenant_id -> list of IngestionBatch
        self.quality_issues: Dict[str, Dict[str, DataQualityIssue]] = {} # tenant_id -> issue_id -> DataQualityIssue
        self.correction_tickets: Dict[str, List[SourceCorrectionTicket]] = {} # tenant_id -> list of SourceCorrectionTicket
        self.rule_sets: Dict[str, JurisdictionRuleSet] = {}        # rule_set_id -> JurisdictionRuleSet
        self.runs: Dict[str, List[CalculationRunResponse]] = {}    # tenant_id -> list of CalculationRunResponse

        self._seed_tenants()
        self._seed_rule_sets()
        self._seed_khc_data()

    def _seed_tenants(self) -> None:
        khc_eu = TenantResponse(
            id="khc-europe",
            name="The Kraft Heinz Company (Europe & UK)",
            sector="Food & Beverage / FMCG",
            tier=TenantTier.ENTERPRISE,
            primary_jurisdiction="FR",
            source_systems=["Trace One (Devex PLM)", "SAP ERP S/4HANA", "Snowflake Analytics"],
            active_products_count=4,
            open_quality_issues_count=3,
        )
        khc_na = TenantResponse(
            id="khc-north-america",
            name="The Kraft Heinz Company (North America)",
            sector="Food & Beverage / FMCG",
            tier=TenantTier.ENTERPRISE,
            primary_jurisdiction="US",
            source_systems=["Trace One (Devex PLM)", "SAP ERP S/4HANA"],
            active_products_count=2,
            open_quality_issues_count=1,
        )
        self.tenants[khc_eu.id] = khc_eu
        self.tenants[khc_na.id] = khc_na

    def _seed_rule_sets(self) -> None:
        # 1. France CITEO 2025 Approved Packaging Fee Schedule
        citeo_fr = JurisdictionRuleSet(
            id="FR-CITEO-2025",
            jurisdiction="FR",
            scheme_name="CITEO Household Packaging EPR (France)",
            reporting_year=2025,
            version="2025.1-official",
            currency="EUR",
            effective_from="2025-01-01",
            effective_to="2025-12-31",
            rates={
                MaterialCategory.GLASS.value: TariffRate(
                    material=MaterialCategory.GLASS.value,
                    base_rate_eur_per_tonne=26.40,
                    description="Standard clear and colored glass bottles and jars",
                    recycled_content_discount_pct=0.0,
                    pcr_threshold_pct=50.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.PET_CLEAR.value: TariffRate(
                    material=MaterialCategory.PET_CLEAR.value,
                    base_rate_eur_per_tonne=425.00,
                    description="Clear / light blue PET bottles and rigid containers",
                    recycled_content_discount_pct=15.0, # 15% bonus for certified PCR >= 30%
                    pcr_threshold_pct=30.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.PET_OPAQUE.value: TariffRate(
                    material=MaterialCategory.PET_OPAQUE.value,
                    base_rate_eur_per_tonne=680.00,
                    description="Opaque or heavily colored PET; disrupts optical sorting",
                    recycled_content_discount_pct=0.0,
                    pcr_threshold_pct=100.0,
                    disruptor_malus_pct=30.0, # 30% malus penalty
                ),
                MaterialCategory.PP.value: TariffRate(
                    material=MaterialCategory.PP.value,
                    base_rate_eur_per_tonne=460.00,
                    description="Polypropylene caps, closures, and rigid tubs",
                    recycled_content_discount_pct=10.0,
                    pcr_threshold_pct=30.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.HDPE.value: TariffRate(
                    material=MaterialCategory.HDPE.value,
                    base_rate_eur_per_tonne=440.00,
                    description="High-density polyethylene rigid bottles and handles",
                    recycled_content_discount_pct=10.0,
                    pcr_threshold_pct=30.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.FLEXIBLE_PE.value: TariffRate(
                    material=MaterialCategory.FLEXIBLE_PE.value,
                    base_rate_eur_per_tonne=585.00,
                    description="Flexible polyethylene films and shrink sleeves",
                    recycled_content_discount_pct=5.0,
                    pcr_threshold_pct=25.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.PAPER_CARDBOARD.value: TariffRate(
                    material=MaterialCategory.PAPER_CARDBOARD.value,
                    base_rate_eur_per_tonne=210.00,
                    description="Corrugated secondary packaging and folding cartons",
                    recycled_content_discount_pct=12.0,
                    pcr_threshold_pct=70.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.ALUMINUM.value: TariffRate(
                    material=MaterialCategory.ALUMINUM.value,
                    base_rate_eur_per_tonne=115.00,
                    description="Aluminum cans, foils, and closures",
                    recycled_content_discount_pct=0.0,
                    pcr_threshold_pct=50.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.STEEL_TINPLATE.value: TariffRate(
                    material=MaterialCategory.STEEL_TINPLATE.value,
                    base_rate_eur_per_tonne=85.00,
                    description="Steel and tinplate food cans and jar lids",
                    recycled_content_discount_pct=0.0,
                    pcr_threshold_pct=50.0,
                    disruptor_malus_pct=0.0,
                ),
                MaterialCategory.OTHER_COMPOSITE.value: TariffRate(
                    material=MaterialCategory.OTHER_COMPOSITE.value,
                    base_rate_eur_per_tonne=890.00,
                    description="Unsorted multi-material composites and non-separable laminates",
                    recycled_content_discount_pct=0.0,
                    pcr_threshold_pct=100.0,
                    disruptor_malus_pct=50.0,
                ),
            },
        )
        self.rule_sets[citeo_fr.id] = citeo_fr

        # 2. Germany LUCID / ZSVR 2025 Approved Packaging Fee Schedule
        lucid_de = JurisdictionRuleSet(
            id="DE-LUCID-2025",
            jurisdiction="DE",
            scheme_name="ZSVR LUCID Verpackungsgesetz (Germany)",
            reporting_year=2025,
            version="2025.2-approved",
            currency="EUR",
            effective_from="2025-01-01",
            effective_to="2025-12-31",
            rates={
                MaterialCategory.GLASS.value: TariffRate(
                    material=MaterialCategory.GLASS.value,
                    base_rate_eur_per_tonne=32.00,
                    description="Hohlglas (Glass packaging)",
                ),
                MaterialCategory.PET_CLEAR.value: TariffRate(
                    material=MaterialCategory.PET_CLEAR.value,
                    base_rate_eur_per_tonne=510.00,
                    description="Kunststoffe (Rigid plastics / PET)",
                    recycled_content_discount_pct=12.0,
                    pcr_threshold_pct=30.0,
                ),
                MaterialCategory.PP.value: TariffRate(
                    material=MaterialCategory.PP.value,
                    base_rate_eur_per_tonne=510.00,
                    description="Kunststoffe (Rigid plastics / PP)",
                ),
                MaterialCategory.PAPER_CARDBOARD.value: TariffRate(
                    material=MaterialCategory.PAPER_CARDBOARD.value,
                    base_rate_eur_per_tonne=195.00,
                    description="Papier, Pappe, Karton (PPK)",
                ),
                MaterialCategory.STEEL_TINPLATE.value: TariffRate(
                    material=MaterialCategory.STEEL_TINPLATE.value,
                    base_rate_eur_per_tonne=170.00,
                    description="Weissblech (Tinplate)",
                ),
            },
        )
        self.rule_sets[lucid_de.id] = lucid_de

    def _seed_khc_data(self) -> None:
        tenant = "khc-europe"
        self.products[tenant] = {}
        self.sales[tenant] = []
        self.batches[tenant] = []
        self.quality_issues[tenant] = {}
        self.correction_tickets[tenant] = []
        self.runs[tenant] = []

        # Batch 1: Ingested from Trace One PLM Devex
        batch1 = IngestionBatch(
            id="BATCH-TRACEEONE-089",
            tenant_id=tenant,
            source_type=SourceSystemType.TRACE_ONE_DEVEX,
            source_reference="TraceOne PLM Export Job #TO-9923 (Devex Migration)",
            created_at=datetime(2026, 10, 20, 9, 30),
            status="completed",
            records_received=4,
            records_normalized=4,
            quality_issues_detected=3,
            message="Ingested 4 finished goods packaging specs. 3 data quality issues flagged for KHC source systems.",
        )
        self.batches[tenant].append(batch1)

        # SKU 1: Heinz Tomato Ketchup 500g Classic Glass Bottle
        sku1_comps = [
            PackagingComponentBase(
                id="COMP-HK-001",
                name="500g Iconic Octagonal Glass Bottle",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.GLASS,
                weight_grams=285.0,
                recycled_content_pct=45.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-GLASS-500",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-HK-002",
                name="Tinplate Twist Cap with Safety Button",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.STEEL_TINPLATE,
                weight_grams=11.5,
                recycled_content_pct=35.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CAP-TWIST",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-HK-003",
                name="Paper Neck and Body Wrap Labels",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PAPER_CARDBOARD,
                weight_grams=3.2,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-LBL-PAPER",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-HK-004",
                name="Corrugated Shipping Tray (12 pack)",
                level=PackagingLevel.SECONDARY,
                material=MaterialCategory.PAPER_CARDBOARD,
                weight_grams=180.0 / 12.0,  # 15g per unit
                recycled_content_pct=85.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.SAP_ERP,
                    source_record_id="SAP-BOM-SEC-091",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p1 = ProductResponse(
            sku="KHC-HTK-500G-GL",
            brand="Heinz",
            name="Heinz Tomato Ketchup 500g Glass Bottle",
            category="Condiments & Sauces",
            unit_volume_ml=430.0,
            net_content_grams=500.0,
            status="active",
            components=sku1_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku1_comps),
            primary_material_summary="Glass (285g), Steel (11.5g), Paper (18.2g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-8821",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p1.sku] = p1

        # SKU 2: Heinz Tomato Ketchup 400ml Top-Down Squeezy Bottle (HAS QUALITY ISSUE: Missing PCR Certificate)
        sku2_comps = [
            PackagingComponentBase(
                id="COMP-HK-SQ-01",
                name="Clear PET Squeezy Bottle Body",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PET_CLEAR,
                weight_grams=32.0,
                recycled_content_pct=30.0, # Claimed 30%, but certificate missing
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-PET-400",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-HK-SQ-02",
                name="Flip-Top PP Dispensing Cap with Silicone Valve",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=14.2,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CAP-VALVE",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-HK-SQ-03",
                name="Shrink Wrap Secondary Pack Sleeve (6 pack)",
                level=PackagingLevel.SECONDARY,
                material=MaterialCategory.FLEXIBLE_PE,
                weight_grams=48.0 / 6.0,  # 8g per bottle
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.SAP_ERP,
                    source_record_id="SAP-BOM-SHRINK-400",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p2 = ProductResponse(
            sku="KHC-HTK-400ML-SQ",
            brand="Heinz",
            name="Heinz Tomato Ketchup 400ml Squeezy Top-Down Bottle",
            category="Condiments & Sauces",
            unit_volume_ml=400.0,
            net_content_grams=460.0,
            status="active",
            components=sku2_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku2_comps),
            primary_material_summary="PET Clear (32g), PP (14.2g), Flexible PE (8g)",
            has_quality_issues=True,
            open_issue_count=1,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-9014",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p2.sku] = p2

        # SKU 3: Philadelphia Original Cream Cheese 200g Tub (HAS QUALITY ISSUE: Multi-layer foil lid unmapped)
        sku3_comps = [
            PackagingComponentBase(
                id="COMP-PHIL-01",
                name="Oval Polypropylene (PP) Tub Container",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=12.4,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-TUB-PP",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-PHIL-02",
                name="Multi-layer Peelable Sealing Foil Lid (Alu/PE)",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.OTHER_COMPOSITE,
                weight_grams=1.8,
                recycled_content_pct=0.0,
                is_recyclable=False,
                recyclability_notes="Non-separable aluminum/plastic composite laminate",
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-FOIL-LID",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-PHIL-03",
                name="Over-cap Polypropylene (PP) Lid",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=4.1,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-OVERCAP-PP",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p3 = ProductResponse(
            sku="KHC-PHIL-200G-TUB",
            brand="Philadelphia",
            name="Philadelphia Original Cream Cheese 200g",
            category="Dairy & Spreads",
            net_content_grams=200.0,
            status="active",
            components=sku3_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku3_comps),
            primary_material_summary="PP (16.5g), Composite Foil (1.8g)",
            has_quality_issues=True,
            open_issue_count=1,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-7740",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p3.sku] = p3

        # SKU 4: Kraft Macaroni & Cheese Dinner 206g Box
        sku4_comps = [
            PackagingComponentBase(
                id="COMP-MAC-01",
                name="100% Recycled Paperboard Folding Carton",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PAPER_CARDBOARD,
                weight_grams=28.5,
                recycled_content_pct=100.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CARTON-MAC",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-MAC-02",
                name="Cheese Sauce Mix Inner Sachet (Paper/PE)",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.OTHER_COMPOSITE,
                weight_grams=2.6,
                recycled_content_pct=0.0,
                is_recyclable=False,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-SACHET-MAC",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p4 = ProductResponse(
            sku="KHC-MAC-206G-BOX",
            brand="Kraft",
            name="Kraft Macaroni & Cheese Original Dinner 206g",
            category="Meals & Sides",
            net_content_grams=206.0,
            status="active",
            components=sku4_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku4_comps),
            primary_material_summary="Paperboard (28.5g), Composite Sachet (2.6g)",
            has_quality_issues=True,
            open_issue_count=1,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-6512",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p4.sku] = p4

        # Seed Sales (Placed On Market) for France and Germany (2025 reporting year)
        self.sales[tenant] = [
            PlacedOnMarketSales(
                id="SALE-FR-01",
                tenant_id=tenant,
                sku=p1.sku,
                jurisdiction="FR",
                reporting_year=2025,
                units_sold=4_200_000,
                sales_channel="Retail / B2C (Carrefour, Auchan, E.Leclerc)",
                source_system="SAP ERP S/4HANA Sales & Distribution",
            ),
            PlacedOnMarketSales(
                id="SALE-FR-02",
                tenant_id=tenant,
                sku=p2.sku,
                jurisdiction="FR",
                reporting_year=2025,
                units_sold=7_850_000,
                sales_channel="Retail / B2C (Carrefour, Intermarché)",
                source_system="SAP ERP S/4HANA Sales & Distribution",
            ),
            PlacedOnMarketSales(
                id="SALE-FR-03",
                tenant_id=tenant,
                sku=p3.sku,
                jurisdiction="FR",
                reporting_year=2025,
                units_sold=3_400_000,
                sales_channel="Retail / B2C (Monoprix, Carrefour)",
                source_system="SAP ERP S/4HANA Sales & Distribution",
            ),
            PlacedOnMarketSales(
                id="SALE-FR-04",
                tenant_id=tenant,
                sku=p4.sku,
                jurisdiction="FR",
                reporting_year=2025,
                units_sold=1_100_000,
                sales_channel="Retail / B2C (Specialty Import)",
                source_system="SAP ERP S/4HANA Sales & Distribution",
            ),
            # Germany sales
            PlacedOnMarketSales(
                id="SALE-DE-01",
                tenant_id=tenant,
                sku=p1.sku,
                jurisdiction="DE",
                reporting_year=2025,
                units_sold=5_100_000,
                sales_channel="Retail (Rewe, Edeka)",
                source_system="SAP ERP S/4HANA Sales & Distribution",
            ),
            PlacedOnMarketSales(
                id="SALE-DE-02",
                tenant_id=tenant,
                sku=p2.sku,
                jurisdiction="DE",
                reporting_year=2025,
                units_sold=8_900_000,
                sales_channel="Retail (Rewe, Edeka, Kaufland)",
                source_system="SAP ERP S/4HANA Sales & Distribution",
            ),
        ]

        # Seed Layer 2 Data Quality Issues (Explicitly tracking single source of truth for KHC)
        issue1 = DataQualityIssue(
            id="DQI-KHC-001",
            tenant_id=tenant,
            rule_code="RULE-PCR-UNVERIFIED",
            rule_title="Unverified Post-Consumer Recycled (PCR) Content Claim",
            severity=IssueSeverity.WARNING,
            entity_type="PackagingComponent",
            entity_id="COMP-HK-SQ-01",
            field_name="recycled_content_pct",
            current_value="30.0% (Uncertified)",
            description=(
                "Component claims 30% rPET, but supplier PCR compliance certificate #CERT-PET-2025 is missing "
                "in Trace One PLM. Without proof, CITEO eco-modulation will revert to standard 0% discount tariff."
            ),
            suggested_source_action="Attach supplier certificate ISO 14021 in Trace One Devex spec #DEV-9014",
            source_spec_reference="DEV-9014",
            status=IssueStatus.OPEN,
            assigned_to="Packaging Specialist (KHC Europe)",
        )

        issue2 = DataQualityIssue(
            id="DQI-KHC-002",
            tenant_id=tenant,
            rule_code="RULE-LAMINATE-MALUS",
            rule_title="High Malus Composite Laminate Requires Re-specification",
            severity=IssueSeverity.WARNING,
            entity_type="PackagingComponent",
            entity_id="COMP-PHIL-02",
            field_name="material",
            current_value="Other Composite / Multi-Material",
            description=(
                "Peelable foil lid on Philadelphia tub is flagged as non-separable composite, attracting CITEO "
                "disruptor penalty of €890/tonne (+50% malus). Monomaterial PP or separable peelable seal would save €42,000/yr."
            ),
            suggested_source_action="Evaluate monomaterial PP heat-seal film in Trace One Devex #DEV-7740 to eliminate composite tariff.",
            source_spec_reference="DEV-7740",
            status=IssueStatus.OPEN,
            assigned_to="R&D Packaging Lead (KHC Dairy)",
        )

        issue3 = DataQualityIssue(
            id="DQI-KHC-003",
            tenant_id=tenant,
            rule_code="RULE-SECONDARY-BOM-DEFICIT",
            rule_title="Kraft Mac & Cheese Secondary Packaging Unit Allocation Mismatch",
            severity=IssueSeverity.BLOCKER,
            entity_type="Product",
            entity_id="KHC-MAC-206G-BOX",
            field_name="secondary_packaging_weight",
            current_value="0.0g (Missing in Devex)",
            description=(
                "Trace One PLM spec DEV-6512 does not include secondary corrugated case distribution BOM. "
                "EPR audits require complete reporting of secondary transit trays placed on the French market."
            ),
            suggested_source_action="Link SAP ERP Secondary Packaging BOM #SAP-SEC-MAC-24 to Devex spec #DEV-6512",
            source_spec_reference="DEV-6512",
            status=IssueStatus.OPEN,
            assigned_to="Data Steward (KHC Enterprise)",
        )

        self.quality_issues[tenant][issue1.id] = issue1
        self.quality_issues[tenant][issue2.id] = issue2
        self.quality_issues[tenant][issue3.id] = issue3

    def create_tenant(self, data: TenantCreate) -> TenantResponse:
        """Create and provision a new tenant workspace."""
        with self._lock:
            tenant_res = TenantResponse(
                id=data.id,
                name=data.name,
                sector=data.sector,
                tier=data.tier,
                primary_jurisdiction=data.active_jurisdictions[0][:2] if data.active_jurisdictions else "GB",
                source_systems=["Trace One (Devex PLM)", "Snowflake Data Cloud", "CSV Bulk Importer"],
                active_products_count=0,
                open_quality_issues_count=0,
            )
            self.tenants[data.id] = tenant_res
            if data.id not in self.products:
                self.products[data.id] = {}
            if data.id not in self.sales:
                self.sales[data.id] = []
            if data.id not in self.batches:
                self.batches[data.id] = []
            if data.id not in self.quality_issues:
                self.quality_issues[data.id] = {}
            if data.id not in self.correction_tickets:
                self.correction_tickets[data.id] = []
            if data.id not in self.runs:
                self.runs[data.id] = []
            return tenant_res


# Singleton instance
data_store = DataStore()

