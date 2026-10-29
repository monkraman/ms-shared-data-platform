"""API Endpoints for dynamic, configurable regulatory rules, sectors, countries, and data points."""

from typing import List, Optional
from fastapi import APIRouter, Query

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

router = APIRouter(prefix="/config", tags=["Regulatory Configuration Engine"])


@router.get("/masters", response_model=MasterDataResponse)
def get_master_data() -> MasterDataResponse:
    """Retrieve full master catalog: sectors, countries, regulations, versioned tariffs, and user roles."""
    return regulatory_service.get_master_data()


@router.get("/tariffs", response_model=List[TariffRate])
def get_tariffs() -> List[TariffRate]:
    """Retrieve official versioned base fee schedules and RAM eco-modulation multipliers."""
    return regulatory_service.get_all_tariffs()


@router.get("/roles", response_model=List[UserRoleConfig])
def get_user_roles() -> List[UserRoleConfig]:
    """Retrieve platform authorization roles and permission profiles."""
    return regulatory_service.get_all_user_roles()


@router.get("/sectors", response_model=List[SectorConfig])
def get_sectors() -> List[SectorConfig]:
    """Retrieve all available industry sectors and default material categories."""
    return regulatory_service.get_all_sectors()


@router.get("/countries", response_model=List[CountryConfig])
def get_countries() -> List[CountryConfig]:
    """Retrieve all supported countries and EPR jurisdictions with required data point counts."""
    return regulatory_service.get_all_countries()


@router.get("/regulations", response_model=List[RegulationConfig])
def get_regulations(country_code: Optional[str] = Query(None, description="Filter by ISO 3166-1 alpha-2 country")) -> List[RegulationConfig]:
    """Retrieve applicable regulations, statutory instruments, and fee systems."""
    return regulatory_service.get_regulations(country_code=country_code)


@router.get("/data-points", response_model=List[DataPointDefinition])
def get_data_points(countries: Optional[List[str]] = Query(None, description="Filter by country codes, e.g. UK, FR")) -> List[DataPointDefinition]:
    """Retrieve the canonical DP01 to DP45 regulatory data point definitions."""
    return regulatory_service.get_data_points(country_codes=countries)


@router.post("/calculate-matrix", response_model=ComplianceMatrixResponse)
def calculate_compliance_matrix(request: ComplianceMatrixRequest) -> ComplianceMatrixResponse:
    """Dynamically compute the required regulations, data points, national reports, and source systems
    for an onboarded organization based on its chosen sectors and target operating markets."""
    return regulatory_service.calculate_compliance_matrix(
        sector_ids=request.sector_ids,
        country_codes=request.country_codes,
    )
