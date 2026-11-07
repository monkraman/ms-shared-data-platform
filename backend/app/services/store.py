"""Thread-safe multi-tenant memory store and seed fixtures for KHC demo prototype."""

import copy
import json
import os
from datetime import datetime
from pathlib import Path
from threading import RLock
from typing import Dict, List, Optional
from uuid import uuid4
import psycopg

from app.schemas.tenancy import TenantBase, TenantCreate, TenantResponse, TenantTier
from app.schemas.canonical import (
    PPWREnrichmentData,
    DPPEnrichmentData,
    LCAEnrichmentData,
    EPREnrichmentData,
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


PERSISTENCE_DIR = Path(__file__).resolve().parent.parent / "data"
PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_tenants.json"
USER_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_users.json"
PRODUCT_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_products.json"
ISSUE_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_issues.json"
BATCH_PERSISTENCE_FILE = PERSISTENCE_DIR / "persisted_batches.json"


class DataStore:
    """Thread-safe multi-tenant data store pre-seeded with KHC Kraft Heinz demo portfolio."""

    def __init__(self) -> None:
        self._lock = RLock()
        self.tenants: Dict[str, TenantResponse] = {}
        self.products: Dict[str, Dict[str, ProductResponse]] = {}  # tenant_id -> sku -> ProductResponse
        self.sales: Dict[str, List[PlacedOnMarketSales]] = {}      # tenant_id -> list of PlacedOnMarketSales
        self.batches: Dict[str, List[IngestionBatch]] = {}         # tenant_id -> list of IngestionBatch
        self.quality_issues: Dict[str, Dict[str, DataQualityIssue]] = {} # tenant_id -> issue_id -> DataQualityIssue
        self.correction_tickets: Dict[str, List[SourceCorrectionTicket]] = {} # tenant_id -> list of SourceCorrectionTicket
        self.rule_sets: Dict[str, JurisdictionRuleSet] = {}        # rule_set_id -> JurisdictionRuleSet
        self.runs: Dict[str, List[CalculationRunResponse]] = {}    # tenant_id -> list of CalculationRunResponse
        self.users: Dict[str, dict] = {}                          # email -> user record

        self._seed_users()
        self._seed_tenants()
        self._seed_rule_sets()
        self._seed_khc_data()
        self._load_persisted_tenants()
        self._load_persisted_users()
        self._load_persisted_products()
        self._load_persisted_issues()
        self._load_persisted_batches()

    def _load_persisted_tenants(self) -> None:
        """Load any custom workspaces created by users across reboots."""
        if not PERSISTENCE_FILE.exists():
            return
        try:
            with open(PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
                for item in records:
                    t = TenantResponse(**item)
                    if not t.logo_url:
                        if t.id == "khc-europe" or "kraft" in t.name.lower():
                            t.logo_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png"
                        elif t.id == "nordhavn-spirits" or "nordhavn" in t.name.lower():
                            t.logo_url = "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=120&auto=format&fit=crop&q=80"
                    self.tenants[t.id] = t
                    if t.id not in self.products:
                        self.products[t.id] = {}
                    if t.id not in self.sales:
                        self.sales[t.id] = []
                    if t.id not in self.batches:
                        self.batches[t.id] = []
                    if t.id not in self.quality_issues:
                        self.quality_issues[t.id] = {}
                    if t.id not in self.correction_tickets:
                        self.correction_tickets[t.id] = []
                    if t.id not in self.runs:
                        self.runs[t.id] = []
        except Exception as e:
            print(f"[DataStore] Failed loading persisted tenants: {e}")

    def _save_persisted_tenant(self, tenant: TenantResponse) -> None:
        """Persist custom provisioned tenant to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = []
            if PERSISTENCE_FILE.exists():
                with open(PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = []
            existing = [item for item in existing if item.get("id") != tenant.id]
            existing.append(tenant.model_dump(mode="json"))
            with open(PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted tenant: {e}")

    def _load_persisted_users(self) -> None:
        """Load any custom provisioned users across reboots."""
        if not USER_PERSISTENCE_FILE.exists():
            return
        try:
            with open(USER_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                records = json.load(f)
                for item in records:
                    email = item.get("email", "").lower().strip()
                    if email:
                        self.users[email] = item
        except Exception as e:
            print(f"[DataStore] Failed loading persisted users: {e}")


    def _load_persisted_products(self) -> None:
        """Load any custom or newly imported products across reboots."""
        if not PRODUCT_PERSISTENCE_FILE.exists():
            return
        try:
            with open(PRODUCT_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for tid, prods in data.items():
                    if tid not in self.products:
                        self.products[tid] = {}
                    for sku, p_dict in prods.items():
                        self.products[tid][sku] = ProductResponse(**p_dict)
        except Exception as e:
            print(f"[DataStore] Failed loading persisted products: {e}")

    def save_persisted_products(self, tenant_id: Optional[str] = None) -> None:
        """Persist products to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = {}
            if PRODUCT_PERSISTENCE_FILE.exists():
                with open(PRODUCT_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = {}
            with self._lock:
                targets = [tenant_id] if tenant_id else list(self.products.keys())
                for tid in targets:
                    existing[tid] = {
                        sku: prod.model_dump(mode="json")
                        for sku, prod in self.products.get(tid, {}).items()
                    }
            with open(PRODUCT_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted products: {e}")

    def _load_persisted_issues(self) -> None:
        """Load any custom or remediated quality issues across reboots."""
        if not ISSUE_PERSISTENCE_FILE.exists():
            return
        try:
            with open(ISSUE_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for tid, issues in data.items():
                    if tid not in self.quality_issues:
                        self.quality_issues[tid] = {}
                    for iid, i_dict in issues.items():
                        self.quality_issues[tid][iid] = DataQualityIssue(**i_dict)
        except Exception as e:
            print(f"[DataStore] Failed loading persisted issues: {e}")

    def save_persisted_issues(self, tenant_id: Optional[str] = None) -> None:
        """Persist quality issues to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = {}
            if ISSUE_PERSISTENCE_FILE.exists():
                with open(ISSUE_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = {}
            with self._lock:
                targets = [tenant_id] if tenant_id else list(self.quality_issues.keys())
                for tid in targets:
                    existing[tid] = {
                        iid: issue.model_dump(mode="json")
                        for iid, issue in self.quality_issues.get(tid, {}).items()
                    }
            with open(ISSUE_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted issues: {e}")

    def _load_persisted_batches(self) -> None:
        """Load any custom ingestion batches across reboots."""
        if not BATCH_PERSISTENCE_FILE.exists():
            return
        try:
            with open(BATCH_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                for tid, b_list in data.items():
                    if tid not in self.batches:
                        self.batches[tid] = []
                    for b_dict in b_list:
                        # Avoid duplicates
                        existing_ids = {b.id for b in self.batches[tid]}
                        if b_dict.get("id") not in existing_ids:
                            self.batches[tid].append(IngestionBatch(**b_dict))
        except Exception as e:
            print(f"[DataStore] Failed loading persisted batches: {e}")

    def save_persisted_batches(self, tenant_id: Optional[str] = None) -> None:
        """Persist ingestion batches to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = {}
            if BATCH_PERSISTENCE_FILE.exists():
                with open(BATCH_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = {}
            with self._lock:
                targets = [tenant_id] if tenant_id else list(self.batches.keys())
                for tid in targets:
                    existing[tid] = [
                        b.model_dump(mode="json")
                        for b in self.batches.get(tid, [])
                    ]
            with open(BATCH_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted batches: {e}")

    def _save_persisted_user(self, user_data: dict) -> None:
        """Persist user record to disk."""
        try:
            PERSISTENCE_DIR.mkdir(parents=True, exist_ok=True)
            existing = []
            if USER_PERSISTENCE_FILE.exists():
                with open(USER_PERSISTENCE_FILE, "r", encoding="utf-8") as f:
                    try:
                        existing = json.load(f)
                    except Exception:
                        existing = []
            email = user_data["email"].lower().strip()
            existing = [u for u in existing if u.get("email", "").lower().strip() != email]
            existing.append(user_data)
            with open(USER_PERSISTENCE_FILE, "w", encoding="utf-8") as f:
                json.dump(existing, f, indent=2)
        except Exception as e:
            print(f"[DataStore] Failed saving persisted user: {e}")

    def _seed_users(self) -> None:
        self.users["superadmin@monkspaces.com"] = {
            "id": "usr-sa-001",
            "email": "superadmin@monkspaces.com",
            "password": "password123",
            "full_name": "Platform Administrator",
            "role": "superadmin",
            "tenant_id": None,
            "organisation_name": "Compliance Hub Platform",
            "avatar_initials": "SA",
        }
        self.users["compliance.officer@kraftheinz.com"] = {
            "id": "usr-khc-001",
            "email": "compliance.officer@kraftheinz.com",
            "password": "password123",
            "full_name": "Sarah Mitchell",
            "role": "org_admin",
            "tenant_id": "khc-europe",
            "organisation_name": "The Kraft Heinz Company Europe",
            "avatar_initials": "SM",
        }
        self.users["packaging.lead@kraftheinz.com"] = {
            "id": "usr-khc-002",
            "email": "packaging.lead@kraftheinz.com",
            "password": "password123",
            "full_name": "David Warner",
            "role": "analyst",
            "tenant_id": "khc-europe",
            "organisation_name": "The Kraft Heinz Company Europe",
            "avatar_initials": "DW",
        }
        self.users["esg.director@kraftheinz.com"] = {
            "id": "usr-khc-003",
            "email": "esg.director@kraftheinz.com",
            "password": "password123",
            "full_name": "Claire Dupont",
            "role": "viewer",
            "tenant_id": "khc-europe",
            "organisation_name": "The Kraft Heinz Company Europe",
            "avatar_initials": "CD",
        }
        self.users["admin@nordhavn-spirits.com"] = {
            "id": "usr-nord-001",
            "email": "admin@nordhavn-spirits.com",
            "password": "password123",
            "full_name": "Jonas Møller",
            "role": "org_admin",
            "tenant_id": "nordhavn-spirits",
            "organisation_name": "Nordhavn Spirits ApS",
            "avatar_initials": "JM",
        }

    def _get_pg_conn(self):
        """Establish direct connection to PostgreSQL database."""
        raw_url = os.environ.get("DATABASE_URL") or "postgresql://neondb_owner:npg_uzClgGiQ7b1E@ep-muddy-bird-b47a9kq9-pooler.c-6.us-east-2.aws.neon.tech/neondb?sslmode=require"
        clean_url = raw_url.replace("&channel_binding=require", "").replace("channel_binding=require", "").replace("postgresql+asyncpg://", "postgresql://")
        if "?" in clean_url:
            clean_url += "&connect_timeout=8"
        else:
            clean_url += "?connect_timeout=8"
        return psycopg.connect(clean_url)

    def _seed_tenants(self) -> None:
        nordhavn_dk = TenantResponse(
            id="nordhavn-spirits",
            name="Nordhavn Spirits ApS",
            sector="Spirits & Beverages",
            tier=TenantTier.ENTERPRISE,
            primary_jurisdiction="DK",
            active_modules=["epr", "ppwr"],
            source_systems=["ERP Master Data", "Devex PLM Spec", "Supplier Portal"],
            active_products_count=1,
            open_quality_issues_count=1,
        )
        khc_eu = TenantResponse(
            id="khc-europe",
            name="The Kraft Heinz Company (Europe & UK)",
            sector="Food & Beverage / FMCG",
            tier=TenantTier.ENTERPRISE,
            primary_jurisdiction="GB",
            logo_url="https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png",
            active_modules=["epr", "ppwr", "dpp", "lca"],
            source_systems=["Trace One (Devex PLM)", "SAP ERP S/4HANA", "Snowflake Analytics"],
            active_products_count=12,
            open_quality_issues_count=4,
        )
        self.tenants[nordhavn_dk.id] = nordhavn_dk
        self.tenants[khc_eu.id] = khc_eu

        # Sync & load all tenants directly from PostgreSQL
        try:
            with self._get_pg_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        INSERT INTO platform.tenants (id, name, sector, tier, primary_currency, primary_jurisdiction)
                        VALUES 
                            ('nordhavn-spirits', 'Nordhavn Spirits ApS', 'Spirits & Beverages', 'enterprise', 'EUR', 'DK'),
                            ('khc-europe', 'The Kraft Heinz Company (Europe & UK)', 'Food & Beverage / FMCG', 'enterprise', 'EUR', 'GB')
                        ON CONFLICT (id) DO NOTHING;
                    """)
                    conn.commit()

                    cur.execute("""
                        SELECT id, name, sector, tier, primary_currency, primary_jurisdiction
                        FROM platform.tenants
                        WHERE is_active = TRUE
                        ORDER BY created_at ASC;
                    """)
                    rows = cur.fetchall()
                    for r in rows:
                        t_id, t_name, t_sec, t_tier, t_curr, t_jur = r
                        tier_enum = TenantTier.ENTERPRISE if (t_tier or "").lower() == "enterprise" else TenantTier.MID_MARKET
                        existing_mods = self.tenants[t_id].active_modules if t_id in self.tenants else ["epr", "ppwr", "dpp", "lca"]
                        existing_logo = getattr(self.tenants[t_id], "logo_url", None) if t_id in self.tenants else None
                        if not existing_logo and t_id == "khc-europe":
                            existing_logo = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png"
                        elif not existing_logo and t_id == "nordhavn-spirits":
                            existing_logo = "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=120&auto=format&fit=crop&q=80"

                        t_obj = TenantResponse(
                            id=t_id,
                            name=t_name,
                            sector=t_sec or "FMCG / General",
                            tier=tier_enum,
                            primary_jurisdiction=t_jur or "GB",
                            logo_url=existing_logo,
                            active_modules=existing_mods,
                            source_systems=["Trace One (Devex PLM)", "Snowflake Analytics", "CSV Importer"],
                            active_products_count=12 if t_id == "khc-europe" else (0 if t_id not in self.tenants else self.tenants[t_id].active_products_count),
                            open_quality_issues_count=4 if t_id == "khc-europe" else (0 if t_id not in self.tenants else self.tenants[t_id].open_quality_issues_count),
                        )
                        self.tenants[t_id] = t_obj
                        if t_id not in self.products:
                            self.products[t_id] = {}
                        if t_id not in self.sales:
                            self.sales[t_id] = []
                        if t_id not in self.batches:
                            self.batches[t_id] = []
                        if t_id not in self.quality_issues:
                            self.quality_issues[t_id] = {}
                        if t_id not in self.correction_tickets:
                            self.correction_tickets[t_id] = []
                        if t_id not in self.runs:
                            self.runs[t_id] = []
        except Exception as e:
            print(f"[PostgreSQL] Notice: Failed to sync tenants from PostgreSQL at startup: {e}")

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

        # SKU 5 (The Golden Thread Hero): Heinz Tartar Sauce Pouch 250g
        sku5_comps = [
            PackagingComponentBase(
                id="COMP-POUCH-01",
                name="Multi-layer Barrier Laminate Film (PET/ALU/PE)",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.OTHER_COMPOSITE,
                weight_grams=10.6,
                recycled_content_pct=0.0,
                is_recyclable=False,
                recyclability_notes="Multi-layer laminate pouch foil: Non-recyclable Grade E under EU PPWR Article 6",
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-POUCH-250",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-POUCH-02",
                name="Rigid PE Spout and Tamper-Evident Screw Cap",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.HDPE,
                weight_grams=2.4,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-POUCH-SPOUT",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p5 = ProductResponse(
            sku="KHC-POUCH-250G",
            brand="Heinz",
            name="Heinz Tartar Sauce Pouch 250g",
            category="Condiments & Sauces",
            net_content_grams=250.0,
            status="active",
            components=sku5_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku5_comps),
            primary_material_summary="Composite Barrier Film (10.6g), HDPE Cap (2.4g)",
            has_quality_issues=True,
            open_issue_count=1,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-POUCH-250",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p5.sku] = p5

        # SKU 6: Heinz Baked Beanz 415g Tin Can
        sku6_comps = [
            PackagingComponentBase(
                id="COMP-BEANZ-01",
                name="Electrolytic Tinplate Steel Food Can Body",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.STEEL_TINPLATE,
                weight_grams=48.0,
                recycled_content_pct=55.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CAN-415",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-BEANZ-02",
                name="Easy-Open Steel Ring-Pull End Lid",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.STEEL_TINPLATE,
                weight_grams=9.5,
                recycled_content_pct=55.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CAN-LID",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-BEANZ-03",
                name="Paper Wrap-Around Label (FSC Certified)",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PAPER_CARDBOARD,
                weight_grams=3.2,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CAN-LBL",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p6 = ProductResponse(
            sku="KHC-BEANZ-415G-CAN",
            brand="Heinz",
            name="Heinz Baked Beanz in Tomato Sauce 415g Tin Can",
            category="Canned Foods & Legumes",
            net_content_grams=415.0,
            status="active",
            components=sku6_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku6_comps),
            primary_material_summary="Steel Tinplate (57.5g), Paper (3.2g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-BEANZ-CAN",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p6.sku] = p6

        # SKU 7: Heinz Seriously Good Mayonnaise 400ml Glass Jar
        sku7_comps = [
            PackagingComponentBase(
                id="COMP-MAYO-01",
                name="Flint Glass Wide-Mouth Jar 400ml",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.GLASS,
                weight_grams=210.0,
                recycled_content_pct=35.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-JAR-400",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-MAYO-02",
                name="Litho Printed Steel Lug Twist Closure 70mm",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.STEEL_TINPLATE,
                weight_grams=12.8,
                recycled_content_pct=25.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-LUG-70",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-MAYO-03",
                name="Self-Adhesive Coated Paper Body Label",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PAPER_CARDBOARD,
                weight_grams=2.4,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-JAR-LBL",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p7 = ProductResponse(
            sku="KHC-MAYO-400ML-GL",
            brand="Heinz",
            name="Heinz [Seriously] Good Mayonnaise 400ml Glass Jar",
            category="Condiments & Sauces",
            net_content_grams=395.0,
            status="active",
            components=sku7_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku7_comps),
            primary_material_summary="Glass (210g), Steel (12.8g), Paper (2.4g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-MAYO-JAR",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p7.sku] = p7

        # SKU 8: Heinz Classic Barbecue Sauce 400g Top-Down Squeezy
        sku8_comps = [
            PackagingComponentBase(
                id="COMP-BBQ-01",
                name="PET Transparent Squeezy Bottle Body",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PET_CLEAR,
                weight_grams=31.0,
                recycled_content_pct=25.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-BBQ-BTL",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-BBQ-02",
                name="PP Dual-Action Flip Dispensing Cap with Silicone Valve",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=14.0,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-CAP-BBQ",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p8 = ProductResponse(
            sku="KHC-BBQ-400G-SQ",
            brand="Heinz",
            name="Heinz Classic Barbecue Sauce 400g Squeezy Bottle",
            category="Condiments & Sauces",
            net_content_grams=400.0,
            status="active",
            components=sku8_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku8_comps),
            primary_material_summary="PET Clear (31g), PP (14g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-BBQ-400",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p8.sku] = p8

        # SKU 9: Heinz Cream of Tomato Soup 400g Tin Can
        sku9_comps = [
            PackagingComponentBase(
                id="COMP-SOUP-01",
                name="Tinplate Steel Soup Can Body",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.STEEL_TINPLATE,
                weight_grams=47.5,
                recycled_content_pct=55.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-SOUP-CAN",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-SOUP-02",
                name="Easy Open Ring Pull Can Lid",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.STEEL_TINPLATE,
                weight_grams=9.5,
                recycled_content_pct=55.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-SOUP-LID",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p9 = ProductResponse(
            sku="KHC-SOUP-400G-CAN",
            brand="Heinz",
            name="Heinz Classics Cream of Tomato Soup 400g Tin Can",
            category="Canned Foods & Soups",
            net_content_grams=400.0,
            status="active",
            components=sku9_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku9_comps),
            primary_material_summary="Steel Tinplate (57.0g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-SOUP-400",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p9.sku] = p9

        # SKU 10: Heinz Yellow Mustard Mild 240g Squeezy Bottle
        sku10_comps = [
            PackagingComponentBase(
                id="COMP-MUST-01",
                name="Yellow Pigmented HDPE Squeezy Bottle",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.HDPE,
                weight_grams=24.0,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-MUST-BTL",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-MUST-02",
                name="Red PP Dispensing Flip Top Cap",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=11.5,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-MUST-CAP",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p10 = ProductResponse(
            sku="KHC-MUST-240G-SQ",
            brand="Heinz",
            name="Heinz Yellow Mustard Mild 240g Squeezy Bottle",
            category="Condiments & Sauces",
            net_content_grams=240.0,
            status="active",
            components=sku10_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku10_comps),
            primary_material_summary="HDPE (24g), PP (11.5g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-MUST-240",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p10.sku] = p10

        # SKU 11: HP Brown Sauce 285g Classic Glass Bottle
        sku11_comps = [
            PackagingComponentBase(
                id="COMP-HP-01",
                name="Rectangular Flint Glass Sauce Bottle 285g",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.GLASS,
                weight_grams=215.0,
                recycled_content_pct=30.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-HP-GL",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-HP-02",
                name="Blue PP Continuous Thread Screw Closure",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=6.5,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-HP-CAP",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p11 = ProductResponse(
            sku="KHC-HP-285G-GL",
            brand="HP",
            name="HP Brown Sauce 285g Classic Glass Bottle",
            category="Condiments & Sauces",
            net_content_grams=285.0,
            status="active",
            components=sku11_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku11_comps),
            primary_material_summary="Glass (215g), PP (6.5g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-HP-285",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p11.sku] = p11

        # SKU 12: Heinz Salad Cream 415g Top-Down Squeezy Bottle
        sku12_comps = [
            PackagingComponentBase(
                id="COMP-SC-01",
                name="Clear PET Top-Down Squeezy Bottle Body",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PET_CLEAR,
                weight_grams=33.0,
                recycled_content_pct=25.0,
                is_recyclable=True,
                separable_by_consumer=False,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-SC-BTL",
                    import_batch_id=batch1.id,
                ),
            ),
            PackagingComponentBase(
                id="COMP-SC-02",
                name="Yellow PP Dispensing Closure with Clean Valve",
                level=PackagingLevel.PRIMARY,
                material=MaterialCategory.PP,
                weight_grams=14.0,
                recycled_content_pct=0.0,
                is_recyclable=True,
                separable_by_consumer=True,
                source_lineage=SourceLineage(
                    source_system=SourceSystemType.TRACE_ONE_DEVEX,
                    source_record_id="DEV-SPEC-SC-CAP",
                    import_batch_id=batch1.id,
                ),
            ),
        ]
        p12 = ProductResponse(
            sku="KHC-SALAD-415G-SQ",
            brand="Heinz",
            name="Heinz Salad Cream 415g Top-Down Squeezy Bottle",
            category="Condiments & Sauces",
            net_content_grams=415.0,
            status="active",
            components=sku12_comps,
            tenant_id=tenant,
            total_packaging_weight_grams=sum(c.weight_grams for c in sku12_comps),
            primary_material_summary="PET Clear (33g), PP (14g)",
            has_quality_issues=False,
            open_issue_count=0,
            source_lineage=SourceLineage(
                source_system=SourceSystemType.TRACE_ONE_DEVEX,
                source_record_id="DEV-SPEC-SC-415",
                import_batch_id=batch1.id,
            ),
        )
        self.products[tenant][p12.sku] = p12

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
            # UK & Denmark Sales for Hero Pouch
            PlacedOnMarketSales(
                id="SALE-UK-POUCH-01",
                tenant_id=tenant,
                sku="KHC-POUCH-250G",
                jurisdiction="UK",
                reporting_year=2025,
                units_sold=5_100_000,
                sales_channel="Retail / B2C (Tesco, Sainsbury's, Asda)",
                source_system="Snowflake Data Cloud",
            ),
            PlacedOnMarketSales(
                id="SALE-DK-POUCH-01",
                tenant_id=tenant,
                sku="KHC-POUCH-250G",
                jurisdiction="DK",
                reporting_year=2025,
                units_sold=850_000,
                sales_channel="Retail / B2C (Netto, Salling Group)",
                source_system="Snowflake Data Cloud",
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

        issue_pouch = DataQualityIssue(
            id="DQI-KHC-POUCH-001",
            tenant_id=tenant,
            rule_code="RULE-WEIGHT-CONFLICT",
            rule_title="Source Tare Weight Conflict: Supplier Spec Sheet vs Devex Record",
            severity=IssueSeverity.BLOCKER,
            entity_type="PackagingComponent",
            entity_id="COMP-POUCH-01",
            field_name="packaging_weight_grams",
            current_value="10.6g (Supplier spec) vs 9.8g (Devex record)",
            description=(
                "Film Supplier A technical spec sheet indicates 10.6g laminate film tare weight, while Trace One Devex "
                "record DEV-SPEC-POUCH-250 specifies 9.8g. Fee liability discrepancy: ±£5,100 across UK and Denmark."
            ),
            suggested_source_action="Confirm 10.6g certified spec and dispatch CR-1187 change request into Devex PLM",
            source_spec_reference="CR-1187",
            status=IssueStatus.OPEN,
            assigned_to="Packaging Lead (KHC Europe)",
        )

        self.quality_issues[tenant][issue1.id] = issue1
        self.quality_issues[tenant][issue2.id] = issue2
        self.quality_issues[tenant][issue3.id] = issue3
        self.quality_issues[tenant][issue_pouch.id] = issue_pouch

    def enrich_product_ppwr(self, tenant_id: str, sku: str, data: PPWREnrichmentData):
        with self._lock:
            prods = self.products.get(tenant_id, {})
            p = prods.get(sku) or (self.products.get("khc-europe", {}).get(sku))
            if not p:
                return None
            p.ppwr_enrichment = data
            return p

    def enrich_product_dpp(self, tenant_id: str, sku: str, data: DPPEnrichmentData):
        with self._lock:
            prods = self.products.get(tenant_id, {})
            p = prods.get(sku) or (self.products.get("khc-europe", {}).get(sku))
            if not p:
                return None
            p.dpp_enrichment = data
            return p

    def enrich_product_lca(self, tenant_id: str, sku: str, data: LCAEnrichmentData):
        with self._lock:
            prods = self.products.get(tenant_id, {})
            p = prods.get(sku) or (self.products.get("khc-europe", {}).get(sku))
            if not p:
                return None
            p.lca_enrichment = data
            return p

    def enrich_product_epr(self, tenant_id: str, sku: str, data: EPREnrichmentData):
        with self._lock:
            prods = self.products.get(tenant_id, {})
            p = prods.get(sku) or (self.products.get("khc-europe", {}).get(sku))
            if not p:
                return None
            p.epr_enrichment = data
            return p

    def update_tenant(self, tenant_id: str, update_dict: dict):
        """Update metadata, branding, and modules for an existing tenant workspace."""
        with self._lock:
            if tenant_id not in self.tenants:
                return None
            tenant = self.tenants[tenant_id]
            for key, val in update_dict.items():
                if val is not None and hasattr(tenant, key):
                    setattr(tenant, key, val)
            if not tenant.logo_url:
                if tenant.id == "khc-europe" or "kraft" in tenant.name.lower():
                    tenant.logo_url = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png"
                elif tenant.id == "nordhavn-spirits" or "nordhavn" in tenant.name.lower():
                    tenant.logo_url = "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=120&auto=format&fit=crop&q=80"
            self._save_persisted_tenant(tenant)
            return tenant

    def update_tenant_modules(self, tenant_id: str, modules: list[str]):
        """Toggle active compliance and intelligence modules for a tenant workspace."""
        with self._lock:
            if tenant_id not in self.tenants:
                return None
            tenant = self.tenants[tenant_id]
            tenant.active_modules = modules
            return tenant

    def create_tenant(self, data: TenantCreate) -> TenantResponse:
        """Create and provision a new tenant workspace."""
        with self._lock:
            resolved_logo = data.logo_url
            if not resolved_logo:
                if data.id == "khc-europe" or "kraft" in data.name.lower():
                    resolved_logo = "https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png"
                elif data.id == "nordhavn-spirits" or "nordhavn" in data.name.lower():
                    resolved_logo = "https://images.unsplash.com/photo-1527061011665-3652c757a4d4?w=120&auto=format&fit=crop&q=80"

            tenant_res = TenantResponse(
                id=data.id,
                name=data.name,
                sector=data.sector,
                tier=data.tier,
                primary_jurisdiction=data.active_jurisdictions[0][:2] if data.active_jurisdictions else "GB",
                active_modules=data.active_modules if (data.active_modules and len(data.active_modules) > 0) else ["epr", "ppwr", "dpp", "lca"],
                logo_url=resolved_logo,
                theme_color=data.theme_color or "#111827",
                source_systems=["Trace One (Devex PLM)", "Snowflake Data Cloud", "CSV Bulk Importer"],
                active_products_count=12,
                open_quality_issues_count=4,
            )
            self.tenants[data.id] = tenant_res

            # Clone starter catalog portfolio if newly provisioned workspace has no products
            ref_tenant = "khc-europe"
            if data.id not in self.products or len(self.products[data.id]) == 0:
                if ref_tenant in self.products:
                    self.products[data.id] = copy.deepcopy(self.products[ref_tenant])
                    self.sales[data.id] = copy.deepcopy(self.sales[ref_tenant])
                    self.batches[data.id] = copy.deepcopy(self.batches[ref_tenant])
                    self.quality_issues[data.id] = copy.deepcopy(self.quality_issues[ref_tenant])
                    self.correction_tickets[data.id] = copy.deepcopy(self.correction_tickets[ref_tenant])
                else:
                    self.products[data.id] = {}
                    self.sales[data.id] = []
                    self.batches[data.id] = []
                    self.quality_issues[data.id] = {}
                    self.correction_tickets[data.id] = []
            if data.id not in self.runs:
                self.runs[data.id] = []

            # 1. Register admin user in memory if provided
            if data.admin_email and data.admin_email.strip():
                admin_email = data.admin_email.lower().strip()
                initials = "".join([part[0].upper() for part in (data.admin_name or data.name).split()[:2]]) or "AD"
                new_admin = {
                    "id": f"usr-{data.id[:4]}-{uuid4().hex[:4]}",
                    "email": admin_email,
                    "password": data.admin_password or "password123",
                    "full_name": data.admin_name or f"{data.name} Administrator",
                    "role": "org_admin",
                    "tenant_id": data.id,
                    "organisation_name": data.name,
                    "avatar_initials": initials,
                }
                self.users[admin_email] = new_admin
                self._save_persisted_user(new_admin)

            # 2. Persist to PostgreSQL database platform.tenants table
            try:
                tier_str = data.tier.value if hasattr(data.tier, "value") else str(data.tier or "enterprise")
                with self._get_pg_conn() as conn:
                    with conn.cursor() as cur:
                        cur.execute("""
                            INSERT INTO platform.tenants (id, name, sector, tier, primary_currency, organisation_size, primary_jurisdiction, is_active)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, TRUE)
                            ON CONFLICT (id) DO UPDATE SET
                                name = EXCLUDED.name,
                                sector = EXCLUDED.sector,
                                tier = EXCLUDED.tier,
                                primary_currency = EXCLUDED.primary_currency,
                                organisation_size = EXCLUDED.organisation_size,
                                primary_jurisdiction = EXCLUDED.primary_jurisdiction,
                                updated_at = CURRENT_TIMESTAMP;
                        """, (
                            data.id,
                            data.name,
                            data.sector,
                            tier_str,
                            data.primary_currency or "EUR",
                            data.organisation_size or "L",
                            data.active_jurisdictions[0][:2] if data.active_jurisdictions else "GB",
                        ))

                        if data.admin_email and data.admin_email.strip():
                            cur.execute("""
                                INSERT INTO platform.users (email, hashed_password, full_name, is_active)
                                VALUES (%s, %s, %s, TRUE)
                                ON CONFLICT (email) DO UPDATE SET
                                    full_name = EXCLUDED.full_name;
                            """, (
                                data.admin_email.lower().strip(),
                                data.admin_password or "password123",
                                data.admin_name or f"{data.name} Administrator",
                            ))
                        conn.commit()
                        print(f"[PostgreSQL] Successfully stored new tenant '{data.id}' into PostgreSQL platform.tenants table.")
            except Exception as e:
                print(f"[PostgreSQL] Notice: Could not write tenant to PostgreSQL: {e}")

            self._save_persisted_tenant(tenant_res)
            return tenant_res

    def authenticate_user(self, email: str, password: str) -> Optional[dict]:
        """Authenticate user credentials and return user profile dict."""
        with self._lock:
            user = self.users.get(email.lower().strip())
            if not user:
                return None
            if user["password"] != password:
                return None
            return user

    def get_user(self, email: str) -> Optional[dict]:
        """Retrieve user record by email."""
        with self._lock:
            return self.users.get(email.lower().strip())

    def create_user(self, user_data: dict) -> dict:
        """Register a new user under a specific organization or platform role."""
        with self._lock:
            email = user_data["email"].lower().strip()
            self.users[email] = user_data
            self._save_persisted_user(user_data)
            return user_data

    def list_users(self, tenant_id: Optional[str] = None) -> List[dict]:
        """List registered users, optionally filtered by tenant."""
        with self._lock:
            if not tenant_id:
                return list(self.users.values())
            return [u for u in self.users.values() if u.get("tenant_id") == tenant_id]



# Singleton instance
data_store = DataStore()

