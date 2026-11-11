"""Import every SQLAlchemy model so Alembic and the app see the full schema.

Add each new domain's models module here when a screen introduces tables.
"""

from app.catalog.models import Component, DataPoint, Product, SalesLine
from app.core.audit import AuditEvent
from app.core.db import Base
from app.core.jobs import Job
from app.ingestion.models import ImportBatch
from app.platform.models import LegalEntity, Membership, RefreshToken, Tenant, User
from app.quality.models import GapRule, GapState

__all__ = [
    "AuditEvent",
    "Base",
    "Component",
    "DataPoint",
    "GapRule",
    "GapState",
    "ImportBatch",
    "Job",
    "LegalEntity",
    "Membership",
    "Product",
    "RefreshToken",
    "SalesLine",
    "Tenant",
    "User",
]
