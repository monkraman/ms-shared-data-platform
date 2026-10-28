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
    SourceLineage,
    SourceSystemType,
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
