"""API Router for Layer 1: Canonical Shared Product & Packaging Data Foundation."""

from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.security import get_current_tenant_id
from app.schemas.canonical import IngestionBatch, ProductBase, ProductResponse, SkuImportPayload, SkuImportResponse
from app.services.layer1_foundation import Layer1FoundationService

router = APIRouter(prefix="/foundation", tags=["Layer 1: Shared Data Foundation"])


@router.get("/products", response_model=List[ProductResponse])
def list_products(
    tenant_id: str = Depends(get_current_tenant_id),
) -> List[ProductResponse]:
    """Retrieve canonical product master catalog and packaging BOM summaries for the tenant."""
    return Layer1FoundationService.get_products(tenant_id)


@router.get("/products/{sku}", response_model=ProductResponse)
def get_product_detail(
    sku: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> ProductResponse:
    """Retrieve full packaging BOM hierarchy, components, materials, and source lineage for a SKU."""
    product = Layer1FoundationService.get_product_by_sku(tenant_id, sku)
    if not product:
        raise HTTPException(status_code=404, detail=f"Product with SKU '{sku}' not found.")
    return product


@router.get("/batches", response_model=List[IngestionBatch])
def list_ingestion_batches(
    tenant_id: str = Depends(get_current_tenant_id),
) -> List[IngestionBatch]:
    """Retrieve source ingestion batches, lineage, and validation summaries."""
    return Layer1FoundationService.get_batches(tenant_id)


@router.post("/sync/traceone", response_model=IngestionBatch)
def trigger_traceone_sync(
    spec_id: str = Query("DEV-8821", description="Trace One PLM specification ID to synchronize"),
    tenant_id: str = Depends(get_current_tenant_id),
) -> IngestionBatch:
    """Simulate on-demand read-only delta sync from KHC Trace One PLM (Devex)."""
    return Layer1FoundationService.simulate_trace_one_sync(tenant_id, spec_id)


@router.post("/sync/snowflake", response_model=IngestionBatch)
def trigger_snowflake_sync(
    query_id: str = Query("QRY-SNOW-9921", description="Snowflake query / pipeline run ID"),
    tenant_id: str = Depends(get_current_tenant_id),
) -> IngestionBatch:
    """Simulate on-demand ETL pipeline sync from Snowflake Data Cloud warehouse."""
    return Layer1FoundationService.simulate_snowflake_sync(tenant_id, query_id)


@router.post("/import", response_model=SkuImportResponse, status_code=201)
def import_sku_catalog(payload: SkuImportPayload) -> SkuImportResponse:
    """Import flat SKU catalog, resolve packaging components, and register data quality gaps."""
    return Layer1FoundationService.import_skus(payload)


@router.post("/products", response_model=ProductResponse, status_code=201)
def create_manual_product(
    payload: ProductBase,
    tenant_id: str = Depends(get_current_tenant_id),
) -> ProductResponse:
    """Manually create a new SKU with packaging BOM components directly in database."""
    return Layer1FoundationService.create_or_update_product(tenant_id, payload)


@router.put("/products/{sku}", response_model=ProductResponse)
def update_manual_product(
    sku: str,
    payload: ProductBase,
    tenant_id: str = Depends(get_current_tenant_id),
) -> ProductResponse:
    """Manually update an existing SKU and its packaging components in database."""
    payload.sku = sku
    return Layer1FoundationService.create_or_update_product(tenant_id, payload)

