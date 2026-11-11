"""Horizon scanning: each workspace's lead time (months before a requirement applies that its
data collection starts), default 3.

Revision ID: 0009_horizon
Revises: 0008_action_items
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0009_horizon"
down_revision: str | None = "0008_action_items"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("horizon_lead_months", sa.Integer(), nullable=False, server_default="3"))
    op.create_check_constraint("ck_tenants_horizon_lead_months", "tenants", "horizon_lead_months BETWEEN 0 AND 24")


def downgrade() -> None:
    op.drop_constraint("ck_tenants_horizon_lead_months", "tenants", type_="check")
    op.drop_column("tenants", "horizon_lead_months")
