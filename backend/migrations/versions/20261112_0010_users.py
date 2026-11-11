"""Users and access: a consultant role (Monk Spaces staff assigned to chosen client
workspaces) and each user's last sign-in time.

Revision ID: 0010_users
Revises: 0009_horizon
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0010_users"
down_revision: str | None = "0009_horizon"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_memberships_tenant_role", "memberships", type_="check")
    op.create_check_constraint(
        "ck_memberships_tenant_role", "memberships", "role IN ('org_admin', 'consultant', 'analyst', 'viewer')"
    )
    op.add_column("users", sa.Column("last_sign_in_at", sa.DateTime(timezone=True)))


def downgrade() -> None:
    op.drop_column("users", "last_sign_in_at")
    op.execute("UPDATE memberships SET role = 'analyst' WHERE role = 'consultant'")
    op.drop_constraint("ck_memberships_tenant_role", "memberships", type_="check")
    op.create_check_constraint(
        "ck_memberships_tenant_role", "memberships", "role IN ('org_admin', 'analyst', 'viewer')"
    )
