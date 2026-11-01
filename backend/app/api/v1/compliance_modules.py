"""API router for multi-module compliance outcomes: PPWR Technical File and DPP."""

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_tenant_id
from app.schemas.ppwr_dpp import DigitalProductPassport, PPWRDeclarationOfConformity
from app.services.layer4_ppwr_dpp import Layer4PPWRDPPService

router = APIRouter(prefix="/compliance/modules", tags=["Compliance Modules: PPWR & DPP"])


@router.get("/ppwr/{sku}", response_model=PPWRDeclarationOfConformity)
def get_ppwr_declaration_of_conformity(
    sku: str,
    tenant_id: str = Depends(get_current_tenant_id),
) -> PPWRDeclarationOfConformity:
    """Generate EU PPWR Article 6 Declaration of Conformity and Recyclability Scorecard from Devex specs."""
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
    try:
        return Layer4PPWRDPPService.generate_dpp(tenant_id, sku)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

