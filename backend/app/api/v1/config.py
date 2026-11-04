"""API Endpoints for dynamic, configurable regulatory rules, sectors, countries, and data points."""

from typing import List, Optional
from fastapi import APIRouter, Query, Depends, HTTPException, status

from app.schemas.configuration import (
    SectorConfig,
    CountryConfig,
    RegulationConfig,
    DataPointDefinition,
    ComplianceMatrixRequest,
    ComplianceMatrixResponse,
    TariffRate,
    UserRoleConfig,
    MasterDataResponse,
)
from app.services.regulatory_config import regulatory_service
from app.core.security import get_current_user_optional, get_current_user, AuthenticatedUser

router = APIRouter(prefix="/config", tags=["Regulatory Configuration Engine"])


@router.get("/masters", response_model=MasterDataResponse)
def get_master_data(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> MasterDataResponse:
    """Retrieve full master catalog. RBAC: Client callers receive only client-assignable roles."""
    data = regulatory_service.get_master_data()
    # RBAC: If caller is not SuperAdmin, filter out internal superadmin role profiles
    if not current_user or current_user.role != "superadmin":
        data.user_roles = [r for r in data.user_roles if r.is_client_assignable]
    return data


@router.get("/tariffs", response_model=List[TariffRate])
def get_tariffs(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> List[TariffRate]:
    """Retrieve official versioned base fee schedules and RAM eco-modulation multipliers."""
    return regulatory_service.get_all_tariffs()


@router.get("/roles", response_model=List[UserRoleConfig])
def get_user_roles(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> List[UserRoleConfig]:
    """Retrieve platform authorization roles and permission profiles.
    
    RBAC Security: Strictly restricted to Platform SuperAdmin. Regular client users are blocked.
    """
    if current_user and current_user.role not in ["superadmin", "org_admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Forbidden: Platform authorization role profiles and permission matrices are restricted strictly to Platform SuperAdmin.",
        )
    return regulatory_service.get_all_user_roles()


@router.get("/sectors", response_model=List[SectorConfig])
def get_sectors(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> List[SectorConfig]:
    """Retrieve all available industry sectors and default material categories."""
    return regulatory_service.get_all_sectors()


@router.get("/countries", response_model=List[CountryConfig])
def get_countries(
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> List[CountryConfig]:
    """Retrieve all supported countries and EPR jurisdictions with required data point counts."""
    return regulatory_service.get_all_countries()


@router.get("/regulations", response_model=List[RegulationConfig])
def get_regulations(
    country_code: Optional[str] = Query(None, description="Filter by ISO 3166-1 alpha-2 country"),
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> List[RegulationConfig]:
    """Retrieve applicable regulations, statutory instruments, and fee systems."""
    return regulatory_service.get_regulations(country_code=country_code)


@router.get("/data-points", response_model=List[DataPointDefinition])
def get_data_points(
    countries: Optional[List[str]] = Query(None, description="Filter by country codes, e.g. UK, FR"),
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> List[DataPointDefinition]:
    """Retrieve the canonical DP01 to DP45 regulatory data point definitions."""
    return regulatory_service.get_data_points(country_codes=countries)


@router.post("/calculate-matrix", response_model=ComplianceMatrixResponse)
def calculate_compliance_matrix(
    request: ComplianceMatrixRequest,
    current_user: Optional[AuthenticatedUser] = Depends(get_current_user_optional),
) -> ComplianceMatrixResponse:
    """Dynamically compute the required regulations, data points, national reports, and source systems
    for an onboarded organization based on its chosen sectors and target operating markets."""
    return regulatory_service.calculate_compliance_matrix(
        sector_ids=request.sector_ids,
        country_codes=request.country_codes,
    )
