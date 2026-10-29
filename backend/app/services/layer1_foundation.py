"""Service layer for Layer 1: Canonical Shared Product & Packaging Data Foundation."""

from datetime import datetime, timezone
from typing import Dict, List, Optional
from uuid import uuid4

from app.schemas.canonical import (
    IngestionBatch,
    MaterialCategory,
    PackagingComponentBase,
    PackagingLevel,
    PlacedOnMarketSales,
    ProductBase,
    ProductResponse,
    SkuImportItem,
    SkuImportPayload,
    SkuImportResponse,
    SourceLineage,
    SourceSystemType,
)
from app.schemas.quality import (
    DataQualityIssue,
    IssueSeverity,
    IssueStatus,
)
from app.services.store import data_store


class Layer1FoundationService:
    """Manages multi-tenant products, packaging specifications, BOM lines, and source lineage."""

    @staticmethod
    def get_products(tenant_id: str) -> List[ProductResponse]:
        """Fetch all canonical products with packaging summaries for the given tenant."""
        with data_store._lock:
            tenant_prods = data_store.products.get(tenant_id, {})
            # Enrich with current open issue counts
            tenant_issues = data_store.quality_issues.get(tenant_id, {})
            result = []
            for prod in tenant_prods.values():
                p_copy = prod.model_copy()
                issues_for_prod = [
                    i for i in tenant_issues.values()
                    if (i.entity_id == p_copy.sku or any(i.entity_id == c.id for c in p_copy.components))
                    and i.status in ["open", "pending_source_update"]
                ]
                p_copy.has_quality_issues = len(issues_for_prod) > 0
                p_copy.open_issue_count = len(issues_for_prod)
                result.append(p_copy)
            return sorted(result, key=lambda x: x.sku)

    @staticmethod
    def get_product_by_sku(tenant_id: str, sku: str) -> Optional[ProductResponse]:
        """Fetch a specific product by SKU."""
        with data_store._lock:
            tenant_prods = data_store.products.get(tenant_id, {})
            prod = tenant_prods.get(sku)
            if not prod:
                return None
            p_copy = prod.model_copy()
            tenant_issues = data_store.quality_issues.get(tenant_id, {})
            issues_for_prod = [
                i for i in tenant_issues.values()
                if (i.entity_id == p_copy.sku or any(i.entity_id == c.id for c in p_copy.components))
                and i.status in ["open", "pending_source_update"]
            ]
            p_copy.has_quality_issues = len(issues_for_prod) > 0
            p_copy.open_issue_count = len(issues_for_prod)
            return p_copy

    @staticmethod
    def get_batches(tenant_id: str) -> List[IngestionBatch]:
        """Fetch ingestion history and source batch lineage."""
        with data_store._lock:
            return list(reversed(data_store.batches.get(tenant_id, [])))

    @staticmethod
    def simulate_trace_one_sync(tenant_id: str, spec_id: str) -> IngestionBatch:
        """Simulate a read-only delta sync from KHC Trace One (Devex PLM)."""
        batch_id = f"BATCH-SYNC-{uuid4().hex[:8].upper()}"
        with data_store._lock:
            batch = IngestionBatch(
                id=batch_id,
                tenant_id=tenant_id,
                source_type=SourceSystemType.TRACE_ONE_DEVEX,
                source_reference=f"Trace One Devex Delta Sync: Spec {spec_id}",
                created_at=datetime.now(timezone.utc),
                status="completed",
                records_received=1,
                records_normalized=1,
                quality_issues_detected=0,
                message=f"Successfully synchronized packaging BOM updates from Trace One PLM specification {spec_id}.",
            )
            if tenant_id not in data_store.batches:
                data_store.batches[tenant_id] = []
            data_store.batches[tenant_id].append(batch)
            return batch

    @staticmethod
    def import_skus(payload: SkuImportPayload) -> SkuImportResponse:
        """Batch-import flat SKU packaging and sales records into canonical foundation."""
        tenant_id = payload.tenant_id
        batch_id = f"BATCH-IMP-{uuid4().hex[:8].upper()}"
        issues_summary: List[str] = []
        new_issues_count = 0

        with data_store._lock:
            # Ensure tenant structures exist
            if tenant_id not in data_store.products:
                data_store.products[tenant_id] = {}
            if tenant_id not in data_store.quality_issues:
                data_store.quality_issues[tenant_id] = {}
            if tenant_id not in data_store.sales:
                data_store.sales[tenant_id] = []
            if tenant_id not in data_store.batches:
                data_store.batches[tenant_id] = []

            for item in payload.items:
                sku = item.sku.strip()
                if not sku:
                    continue

                # Material resolution
                resolved_material = MaterialCategory.OTHER_COMPOSITE
                if item.material:
                    mat_str = item.material.strip().lower()
                    for cat in MaterialCategory:
                        if cat.value.lower() == mat_str or mat_str in cat.value.lower() or cat.name.lower() in mat_str:
                            resolved_material = cat
                            break

                weight = float(item.packaging_weight_grams) if (item.packaging_weight_grams is not None and item.packaging_weight_grams > 0) else 0.0
                pcr_pct = float(item.recycled_content_pct or 0.0)

                # Flag quality gaps
                has_gap = False
                if weight <= 0:
                    has_gap = True
                    new_issues_count += 1
                    issue_id = f"DQI-{uuid4().hex[:6].upper()}"
                    msg = f"SKU {sku} ({item.name}) lacks verified packaging weight in grams."
                    issues_summary.append(f"[{sku}] Missing packaging weight (Blocker)")
                    data_store.quality_issues[tenant_id][issue_id] = DataQualityIssue(
                        id=issue_id,
                        tenant_id=tenant_id,
                        rule_code="RULE-MISSING-WEIGHT",
                        rule_title="Missing Packaging Component Weight",
                        severity=IssueSeverity.BLOCKER,
                        entity_type="PackagingComponent",
                        entity_id=f"COMP-{sku}-01",
                        field_name="weight_grams",
                        current_value="0.0g (Unspecified)",
                        description=f"{msg} Tare weight is mandatory for statutory EPR fee schedules.",
                        suggested_source_action=f"Update packaging tare weight for SKU {sku} in ERP / PLM source catalog.",
                        source_spec_reference=sku,
                        status=IssueStatus.OPEN,
                        assigned_to="Compliance Data Steward",
                    )

                if not item.material or item.material.strip() == "" or item.material.lower() in ["unknown", "n/a", "other"]:
                    has_gap = True
                    new_issues_count += 1
                    issue_id = f"DQI-{uuid4().hex[:6].upper()}"
                    issues_summary.append(f"[{sku}] Packaging material unclassified (Blocker)")
                    data_store.quality_issues[tenant_id][issue_id] = DataQualityIssue(
                        id=issue_id,
                        tenant_id=tenant_id,
                        rule_code="RULE-POLYMER-UNMAPPED",
                        rule_title="Packaging Material Classification Missing",
                        severity=IssueSeverity.BLOCKER,
                        entity_type="PackagingComponent",
                        entity_id=f"COMP-{sku}-01",
                        field_name="material",
                        current_value=item.material or "Unspecified",
                        description=f"SKU {sku} has no controlled polymer or substrate specification assigned.",
                        suggested_source_action=f"Assign official material category to SKU {sku} in ERP.",
                        source_spec_reference=sku,
                        status=IssueStatus.OPEN,
                        assigned_to="Packaging Engineer",
                    )

                if pcr_pct > 0:
                    new_issues_count += 1
                    issue_id = f"DQI-{uuid4().hex[:6].upper()}"
                    issues_summary.append(f"[{sku}] PCR content claimed without certificate (Warning)")
                    data_store.quality_issues[tenant_id][issue_id] = DataQualityIssue(
                        id=issue_id,
                        tenant_id=tenant_id,
                        rule_code="RULE-PCR-UNVERIFIED",
                        rule_title="Post-Consumer Recycled (PCR) Content Certificate Missing",
                        severity=IssueSeverity.WARNING,
                        entity_type="PackagingComponent",
                        entity_id=f"COMP-{sku}-01",
                        field_name="recycled_content_pct",
                        current_value=f"{pcr_pct}% Claimed (Unverified)",
                        description=f"Claimed {pcr_pct}% PCR lacks accredited lab certificate (ISO 14021 / EN 15343). Eco-modulation discounts will not apply.",
                        suggested_source_action=f"Upload supplier recycled content certificate for SKU {sku}.",
                        source_spec_reference=sku,
                        status=IssueStatus.OPEN,
                        assigned_to="Procurement Specialist",
                    )

                # Create canonical packaging component
                comp = PackagingComponentBase(
                    id=f"COMP-{sku}-01",
                    name=f"{item.name} - Primary Container",
                    level=PackagingLevel.PRIMARY,
                    material=resolved_material,
                    weight_grams=weight if weight > 0 else 0.01,
                    recycled_content_pct=pcr_pct,
                    is_recyclable=item.is_recyclable if item.is_recyclable is not None else True,
                    separable_by_consumer=True,
                    source_lineage=SourceLineage(
                        source_system=SourceSystemType.SUPPLIER_EXCEL,
                        source_record_id=sku,
                        import_batch_id=batch_id,
                        is_source_of_truth=True,
                    ),
                )

                # Create canonical product
                prod = ProductResponse(
                    sku=sku,
                    brand=item.brand or "Standard",
                    name=item.name,
                    category=item.category or "General Goods",
                    tenant_id=tenant_id,
                    status="active",
                    components=[comp],
                    total_packaging_weight_grams=weight,
                    primary_material_summary=resolved_material.value,
                    has_quality_issues=has_gap,
                    open_issue_count=0,
                    source_lineage=SourceLineage(
                        source_system=SourceSystemType.SUPPLIER_EXCEL,
                        source_record_id=sku,
                        import_batch_id=batch_id,
                        is_source_of_truth=True,
                    ),
                )
                data_store.products[tenant_id][sku] = prod

                # Record sales if provided
                if item.units_sold is not None and item.units_sold > 0:
                    data_store.sales[tenant_id].append(
                        PlacedOnMarketSales(
                            id=f"SALES-{sku}-2025",
                            tenant_id=tenant_id,
                            sku=sku,
                            jurisdiction=item.jurisdiction or "FR",
                            reporting_year=2025,
                            units_sold=int(item.units_sold),
                            sales_channel="Retail / B2C",
                            source_system="CSV Bulk Importer",
                        )
                    )

            # Record batch
            batch = IngestionBatch(
                id=batch_id,
                tenant_id=tenant_id,
                source_type=SourceSystemType.SUPPLIER_EXCEL,
                source_reference=payload.source_name,
                created_at=datetime.now(timezone.utc),
                status="completed",
                records_received=len(payload.items),
                records_normalized=len(payload.items),
                quality_issues_detected=new_issues_count,
                message=f"Successfully ingested {len(payload.items)} SKUs from '{payload.source_name}'. Identified {new_issues_count} data quality gaps.",
            )
            data_store.batches[tenant_id].append(batch)

            # Update tenant counts
            if tenant_id in data_store.tenants:
                t = data_store.tenants[tenant_id]
                t.active_products_count = len(data_store.products[tenant_id])
                t.open_quality_issues_count = len([
                    i for i in data_store.quality_issues[tenant_id].values()
                    if i.status in [IssueStatus.OPEN, IssueStatus.PENDING_SOURCE_UPDATE]
                ])

            return SkuImportResponse(
                tenant_id=tenant_id,
                batch_id=batch_id,
                records_received=len(payload.items),
                records_imported=len(payload.items),
                quality_issues_detected=new_issues_count,
                issues_summary=issues_summary[:5],
                message=f"Successfully stored {len(payload.items)} SKUs in database. {new_issues_count} quality gaps flagged for source correction.",
            )

