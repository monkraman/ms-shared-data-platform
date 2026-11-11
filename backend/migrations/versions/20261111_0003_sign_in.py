"""Sign-in: refresh tokens and the prototype's analyst and viewer roles.

Revision ID: 0003_sign_in
Revises: 0002_rls_role
Create Date: 2026-11-11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.tenancy import RLS_ROLE

revision: str = "0003_sign_in"
down_revision: str | None = "0002_rls_role"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_memberships_tenant_role", "memberships", type_="check")
    op.create_check_constraint(
        "ck_memberships_tenant_role", "memberships", "role IN ('org_admin', 'analyst', 'viewer')"
    )

    # Identity table, read before a tenant is known: no tenant RLS, only auth code touches it.
    op.create_table(
        "refresh_tokens",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid()),
        sa.Column("token_hash", sa.String(64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True)),
        sa.PrimaryKeyConstraint("id", name="pk_refresh_tokens"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="fk_refresh_tokens_user_id_users"),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE", name="fk_refresh_tokens_tenant_id_tenants"
        ),
        sa.UniqueConstraint("token_hash", name="uq_refresh_tokens_token_hash"),
    )
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])
    # Default privileges from 0002 cover new tables; granted explicitly for clarity.
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_tokens TO {RLS_ROLE}")


def downgrade() -> None:
    op.drop_table("refresh_tokens")
    op.execute("DELETE FROM memberships WHERE role <> 'org_admin'")
    op.drop_constraint("ck_memberships_tenant_role", "memberships", type_="check")
    op.create_check_constraint("ck_memberships_tenant_role", "memberships", "role IN ('org_admin')")
