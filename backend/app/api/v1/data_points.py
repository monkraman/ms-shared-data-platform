"""Screen 3: the data point dictionary, and the field catalogue screens use for labels."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select

from app.catalog import reference
from app.catalog.models import DataPoint
from app.core.auth import CurrentPrincipal, PlatformDB, Principal, require_permission
from app.core.permissions import Perm
from app.platform.reference import COUNTRIES

router = APIRouter(tags=["Data points"])

SourceId = Literal["erp", "supplier", "plm", "man"]
OutputId = Literal["rep", "fee", "doc", "lab", "evid", "dpp"]


class DataPointOut(BaseModel):
    code: str
    name: str
    description: str
    source: SourceId
    system_field: str | None
    outputs: list[OutputId]
    countries: list[str]
    applies_from: str | None


class OutputInfo(BaseModel):
    name: str
    regulation: str


class CountryOut(BaseModel):
    code: str
    name: str
    eu: bool


class DataPointDictionary(BaseModel):
    data_points: list[DataPointOut]
    sources: dict[SourceId, str]
    outputs: dict[OutputId, OutputInfo]
    countries: list[CountryOut]


class FieldInfo(BaseModel):
    label: str
    dp: str | None
    level: str
    type: str
    allowed: str | None


@router.get("/admin/data-points", response_model=DataPointDictionary, summary="Data point dictionary")
async def get_dictionary(
    _: Annotated[Principal, Depends(require_permission(Perm.PLATFORM_DATAPOINTS_READ))], db: PlatformDB
) -> DataPointDictionary:
    rows = (await db.scalars(select(DataPoint).order_by(DataPoint.code))).all()
    ref = reference.dictionary()
    return DataPointDictionary(
        data_points=[
            DataPointOut(
                code=d.code,
                name=d.name,
                description=d.description,
                source=d.source,
                system_field=d.system_field,
                outputs=list(d.outputs),
                countries=list(d.countries),
                applies_from=d.applies_from,
            )
            for d in rows
        ],
        sources=ref["sources"],
        outputs=ref["outputs"],
        countries=COUNTRIES,
    )


@router.get("/reference/fields", response_model=dict[str, FieldInfo], summary="Field catalogue")
async def get_fields(_: CurrentPrincipal) -> dict[str, dict[str, object]]:
    return reference.fields()
