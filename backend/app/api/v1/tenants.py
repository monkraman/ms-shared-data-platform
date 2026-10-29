"""API Router for Tenant Management and Context."""

from typing import List
from fastapi import APIRouter, HTTPException

from app.schemas.tenancy import TenantCreate, TenantResponse
from app.services.store import data_store

router = APIRouter(prefix="/tenants", tags=["Multi-Tenancy"])


@router.post("", response_model=TenantResponse, status_code=201)
def create_tenant(payload: TenantCreate) -> TenantResponse:
    """Provision a new client tenant workspace from onboarding wizard."""
    return data_store.create_tenant(payload)


@router.get("", response_model=List[TenantResponse])
def list_tenants() -> List[TenantResponse]:
    """Retrieve all active tenant workspaces with live product and quality gap counts."""
    with data_store._lock:
        tenants = []
        for t in data_store.tenants.values():
            t_copy = t.model_copy()
            prods = data_store.products.get(t.id, {})
            issues = data_store.quality_issues.get(t.id, {})
            open_count = sum(1 for i in issues.values() if i.status in ["open", "pending_source_update"])
            t_copy.active_products_count = len(prods)
            t_copy.open_quality_issues_count = open_count
            tenants.append(t_copy)
        return tenants



@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: str) -> TenantResponse:
    """Retrieve metadata and source systems for a specific tenant workspace."""
    with data_store._lock:
        tenant = data_store.tenants.get(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found.")
        return tenant

