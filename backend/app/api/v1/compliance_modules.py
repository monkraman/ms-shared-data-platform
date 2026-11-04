"""API router for multi-module compliance outcomes: EPR, PPWR Technical File, DPP, and LCA Carbon Engine."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_tenant_id
from app.schemas.ppwr_dpp import DigitalProductPassport, PPWRDeclarationOfConformity
from app.schemas.canonical import PPWREnrichmentData, DPPEnrichmentData, LCAEnrichmentData, EPREnrichmentData
from app.schemas.lca import LcaAssessmentResponse
from app.services.layer4_ppwr_dpp import Layer4PPWRDPPService
from app.services.layer4_lca import calculate_lca_assessment
from app.services.store import data_store

router = APIRouter(prefix="/compliance/modules", tags=["Compliance Modules: EPR, PPWR, DPP, LCA"])


@router.get("/entitlement")
def get_module_entitlement(
    tenant_id: str = Depends(get_current_tenant_id),
) -> Dict[str, Any]:
    """Retrieve active module entitlements (EPR, PPWR, DPP, LCA) for the authenticated tenant."""
    with data_store._lock:
        tenant = data_store.tenants.get(tenant_id)
        if not tenant:
            return {
                "tenant_id": tenant_id,
                "tenant_name": "Default Workspace",
                "active_modules": ["epr", "ppwr", "dpp", "lca"],
            }
        return {
            "tenant_id": tenant.id,
            "tenant_name": tenant.name,
            "active_modules": tenant.active_modules or ["epr", "ppwr", "dpp", "lca"],
        }


@router.get("/ppwr/{sku}", response_model=PPWRDeclarationOfConformity)
def get_ppwr_declaration_of_conformity(
    sku: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> PPWRDeclarationOfConformity:
    """Generate EU PPWR Article 6 Declaration of Conformity and Recyclability Scorecard from Devex specs."""
    with data_store._lock:
        tenant = data_store.tenants.get(tenant_id)
        if tenant and "ppwr" not in (tenant.active_modules or []):
            raise HTTPException(
                status_code=403,
                detail=f"PPWR Compliance Module is not activated for tenant '{tenant_id}'. Contact SuperAdmin.",
            )
    try:
        return Layer4PPWRDPPService.generate_ppwr_doc(tenant_id, sku)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/dpp/{sku}", response_model=DigitalProductPassport)
def get_digital_product_passport(
    sku: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> DigitalProductPassport:
    """Generate Digital Product Passport (DPP) QR Carrier and GS1 Digital Link payload."""
    with data_store._lock:
        tenant = data_store.tenants.get(tenant_id)
        if tenant and "dpp" not in (tenant.active_modules or []):
            raise HTTPException(
                status_code=403,
                detail=f"DPP Digital Product Passport Module is not activated for tenant '{tenant_id}'. Contact SuperAdmin.",
            )
    try:
        return Layer4PPWRDPPService.generate_dpp(tenant_id, sku)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/lca/{sku}", response_model=LcaAssessmentResponse)
def get_lca_assessment(
    sku: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> LcaAssessmentResponse:
    """Generate Cradle-to-Gate Life Cycle Assessment (LCA) and Scope 3 Packaging Carbon Footprint."""
    with data_store._lock:
        tenant = data_store.tenants.get(tenant_id)
        if tenant and "lca" not in (tenant.active_modules or []):
            raise HTTPException(
                status_code=403,
                detail=f"LCA Carbon & Scope 3 Module is not activated for tenant '{tenant_id}'. Contact SuperAdmin to activate.",
            )
        products = data_store.products.get(tenant_id, {})
        product = products.get(sku)
        if not product:
            product = data_store.products.get("khc-europe", {}).get(sku)
            if not product:
                raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found for tenant '{tenant_id}'")

        sales = data_store.sales.get(tenant_id, [])
        annual_units = sum(s.units_sold for s in sales if s.sku == sku) or 150000

        return calculate_lca_assessment(product, annual_units=annual_units)


@router.post("/enrichment/{sku}/ppwr", response_model=PPWRDeclarationOfConformity)
def enrich_ppwr_module_data(
    sku: str,
    payload: PPWREnrichmentData,
    tenant_id: str = Depends(get_current_tenant_id),
) -> PPWRDeclarationOfConformity:
    """Attach module-specific PPWR lab certificates, PCR audits, and PFAS declarations."""
    prod = data_store.enrich_product_ppwr(tenant_id, sku, payload)
    if not prod:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found.")
    return Layer4PPWRDPPService.generate_ppwr_doc(tenant_id, sku)


@router.post("/enrichment/{sku}/lca", response_model=LcaAssessmentResponse)
def enrich_lca_module_data(
    sku: str,
    payload: LCAEnrichmentData,
    tenant_id: str = Depends(get_current_tenant_id),
) -> LcaAssessmentResponse:
    """Attach module-specific LCA data: converter green energy mix %, haulage km, and EPD cert."""
    prod = data_store.enrich_product_lca(tenant_id, sku, payload)
    if not prod:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found.")
    sales = data_store.sales.get(tenant_id, [])
    annual_units = sum(s.units_sold for s in sales if s.sku == sku) or 150000
    return calculate_lca_assessment(prod, annual_units=annual_units)


@router.post("/enrichment/{sku}/dpp", response_model=DigitalProductPassport)
def enrich_dpp_module_data(
    sku: str,
    payload: DPPEnrichmentData,
    tenant_id: str = Depends(get_current_tenant_id),
) -> DigitalProductPassport:
    """Configure custom GS1 Digital Link domain, GTIN barcode, and multilingual disposal instructions."""
    prod = data_store.enrich_product_dpp(tenant_id, sku, payload)
    if not prod:
        raise HTTPException(status_code=404, detail=f"SKU '{sku}' not found.")
    return Layer4PPWRDPPService.generate_dpp(tenant_id, sku)
