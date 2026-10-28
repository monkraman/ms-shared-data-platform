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
    """Retrieve all active tenant workspaces."""
    with data_store._lock:
        return list(data_store.tenants.values())


@router.get("/{tenant_id}", response_model=TenantResponse)
def get_tenant(tenant_id: str) -> TenantResponse:
    """Retrieve metadata and source systems for a specific tenant workspace."""
    with data_store._lock:
        tenant = data_store.tenants.get(tenant_id)
        if not tenant:
            raise HTTPException(status_code=404, detail=f"Tenant '{tenant_id}' not found.")
        return tenant

