"""Pydantic schemas for Layer 1: Canonical Product & Packaging Data Foundation."""

from datetime import datetime, timezone
from enum import Enum
from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class PackagingLevel(str, Enum):
    PRIMARY = "primary"        # Direct contact with food/liquid (e.g. bottle, pouch, jar, tub)
    SECONDARY = "secondary"    # Grouping/multipack (e.g. cardboard box, shrink sleeve)
    TERTIARY = "tertiary"      # Transport/pallet (e.g. wooden pallet, stretch film)


class MaterialCategory(str, Enum):
    GLASS = "Glass"
    PET_CLEAR = "PET (Clear / Light Blue)"
    PET_OPAQUE = "PET (Opaque / Colored)"
    HDPE = "HDPE (Rigid)"
    PP = "PP (Polypropylene)"
    FLEXIBLE_PE = "Flexible PE (LDPE/LLDPE)"
    PAPER_CARDBOARD = "Paper / Corrugated Board"
    ALUMINUM = "Aluminum"
    STEEL_TINPLATE = "Steel / Tinplate"
    COMPOSITE_BEVERAGE = "Liquid Packaging Board (Tetra Pak / Composite)"
    OTHER_COMPOSITE = "Other Composite / Multi-Material"


class SourceSystemType(str, Enum):
    TRACE_ONE_DEVEX = "Trace One (Devex PLM)"
    SAP_ERP = "SAP ERP"
    SNOWFLAKE = "Snowflake Data Lake"
    SUPPLIER_EXCEL = "Supplier Spreadsheet / CSV"
    MANUAL_PROVISIONAL = "Monkspaces Provisional Entry"


class SourceLineage(BaseModel):
    source_system: SourceSystemType = SourceSystemType.TRACE_ONE_DEVEX
    source_record_id: str = Field(..., description="External source ID, e.g. Trace One spec #DEV-8821")
    import_batch_id: str = Field(..., description="Batch ID in which this was ingested")
    ingested_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    raw_payload_checksum: Optional[str] = None
    is_source_of_truth: bool = True
    last_verified_at: Optional[datetime] = None


class PackagingComponentBase(BaseModel):
    id: str = Field(..., description="Unique component ID, e.g. COMP-5001")
    name: str = Field(..., description="Component descriptor, e.g. 500ml Clear PET Bottle Body")
    level: PackagingLevel = Field(..., description="Packaging hierarchy level")
    material: MaterialCategory = Field(..., description="Controlled vocabulary material category")
    weight_grams: float = Field(..., gt=0, description="Gross weight per component in grams")
    recycled_content_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="Post-consumer recycled content % (PCR)")
    is_recyclable: bool = Field(default=True, description="Conforms to standard recycling stream")
    recyclability_notes: Optional[str] = None
    separable_by_consumer: bool = Field(default=True, description="Easily detached by consumer prior to disposal")
    has_disruptor_pigment: bool = Field(default=False, description="E.g. Carbon black or heavy opacity inhibiting NIR sortation")
    source_lineage: Optional[SourceLineage] = None



class PPWREnrichmentData(BaseModel):
    recyclass_cert_id: Optional[str] = Field(default=None, description="CEN/RecyClass DfR Lab Certificate ID")
    pcr_cert_id: Optional[str] = Field(default=None, description="EuCertPlast / ISO 14021 Recycled Content Certificate ID")
    pfas_free_declaration: bool = Field(default=True, description="Conforms to EU 2024 PPWR Article 5 PFAS ban (<25ppb)")
    heavy_metals_pass: bool = Field(default=True, description="Pb/Cd/Hg/Cr VI combined sum <100 ppm")
    lab_test_date: Optional[str] = Field(default=None, description="Accredited lab assessment date")
    reusable_packaging: bool = Field(default=False, description="Complies with Annex VI reuse rotation criteria")


class DPPEnrichmentData(BaseModel):
    gtin: Optional[str] = Field(default=None, description="14-digit GS1 GTIN barcode (e.g. 05000157024672)")
    gs1_domain: Optional[str] = Field(default="id.monkspaces.com", description="GS1 Digital Link resolver domain")
    brand_landing_url: Optional[str] = Field(default=None, description="Brand consumer sustainability landing page")
    disposal_instructions: List[str] = Field(default_factory=list, description="Multilingual consumer disposal steps")
    harmonised_label: Optional[str] = Field(default="Triman / OPRL Standard", description="Harmonised sorting mark")


class LCAEnrichmentData(BaseModel):
    renewable_energy_pct: float = Field(default=0.0, ge=0.0, le=100.0, description="% converter plant green electricity (PPA/REGO)")
    transport_distance_km: float = Field(default=350.0, ge=0.0, description="Supplier to packaging filler haulage distance (km)")
    epd_registration_id: Optional[str] = Field(default=None, description="Verified Environmental Product Declaration (ISO 14025 / EN 15804)")
    grid_intensity_override: Optional[float] = Field(default=None, description="Custom grid emission factor (kg CO2e/kWh)")


class EPREnrichmentData(BaseModel):
    activity_type: Optional[str] = Field(default="Brand Owner", description="Defra / DPA Producer Packaging Activity")
    organisation_size: Optional[str] = Field(default="Large Producer", description="Statutory organisation threshold tier")
    reuse_system_active: bool = Field(default=False, description="Statutory reusable system in place")


class ProductBase(BaseModel):
    sku: str = Field(..., description="Unique product SKU code, e.g. KHC-00452")
    brand: str = Field(..., description="Brand name, e.g. Heinz, Kraft, Philadelphia")
    name: str = Field(..., description="Product commercial name, e.g. Heinz Tomato Ketchup 500g")
    category: str = Field(..., description="Commercial category, e.g. Condiments & Sauces")
    unit_volume_ml: Optional[float] = None
    net_content_grams: Optional[float] = None
    status: str = Field(default="active", description="Lifecycle status: active, pending_validation, archived")
    components: List[PackagingComponentBase] = Field(default_factory=list)
    source_lineage: Optional[SourceLineage] = None
    ppwr_enrichment: Optional[PPWREnrichmentData] = None
    dpp_enrichment: Optional[DPPEnrichmentData] = None
    lca_enrichment: Optional[LCAEnrichmentData] = None
    epr_enrichment: Optional[EPREnrichmentData] = None


class ProductResponse(ProductBase):
    tenant_id: str
    total_packaging_weight_grams: float = 0.0
    primary_material_summary: str = ""
    has_quality_issues: bool = False
    open_issue_count: int = 0


class PlacedOnMarketSales(BaseModel):
    id: str
    tenant_id: str
    sku: str
    jurisdiction: str = Field(..., description="Country code (FR, DE, UK, etc.)")
    reporting_year: int = Field(..., description="Reporting calendar year, e.g. 2025")
    units_sold: int = Field(..., ge=0, description="Number of sales units placed on market")
    sales_channel: str = Field(default="Retail / B2C", description="Retail B2C vs FoodService / B2B")
    source_system: str = Field(default="SAP ERP / Snowflake")


class IngestionBatch(BaseModel):
    id: str
    tenant_id: str
    source_type: SourceSystemType
    source_reference: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    status: str = Field(default="completed", description="pending, validating, completed, failed")
    records_received: int = 0
    records_normalized: int = 0
    quality_issues_detected: int = 0
    message: Optional[str] = None


class SkuImportItem(BaseModel):
    sku: str = Field(..., description="Unique product SKU code")
    name: str = Field(..., description="Product commercial name")
    brand: Optional[str] = Field(default="Standard", description="Brand name")
    category: Optional[str] = Field(default="General Goods", description="Product category")
    material: Optional[str] = Field(default=None, description="Packaging material category")
    packaging_weight_grams: Optional[float] = Field(default=None, description="Gross packaging weight in grams")
    recycled_content_pct: Optional[float] = Field(default=0.0, description="Post-consumer recycled content %")
    is_recyclable: Optional[bool] = Field(default=True, description="Conforms to recycling stream")
    units_sold: Optional[int] = Field(default=None, description="Annual units placed on market")
    jurisdiction: Optional[str] = Field(default="FR", description="Target market country code")


class SkuImportPayload(BaseModel):
    tenant_id: str = Field(..., description="Target company/tenant ID")
    source_name: str = Field(default="CSV / ERP File Import", description="Source document reference")
    items: List[SkuImportItem] = Field(..., description="List of SKU records to ingest")


class SkuImportResponse(BaseModel):
    tenant_id: str
    batch_id: str
    records_received: int
    records_imported: int
    quality_issues_detected: int
    issues_summary: List[str] = Field(default_factory=list)
    message: str

