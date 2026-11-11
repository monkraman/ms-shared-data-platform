"""Action items (tenant RLS): recommendations turned into tasks with an owner, due date and status.

Revision ID: 0008_action_items
Revises: 0007_gap_estimates
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.tenancy import RLS_ROLE, disable_tenant_rls, enable_tenant_rls

revision: str = "0008_action_items"
down_revision: str | None = "0007_gap_estimates"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "action_items",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE", name="fk_action_items_tenant_id_tenants"),
            nullable=False,
            index=True,
        ),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("detail", sa.Text(), nullable=False, server_default=""),
        sa.Column("recommendation_id", sa.String(160), index=True),
        sa.Column("kind", sa.String(32), nullable=False, server_default="manual"),
        sa.Column("regime", sa.String(16)),
        sa.Column("sku", sa.String(64)),
        sa.Column("impact_value", sa.Float()),
        sa.Column("impact_label", sa.String(64)),
        sa.Column("currency", sa.String(3)),
        sa.Column("owner", sa.String(255), nullable=False, server_default=""),
        sa.Column("due_date", sa.Date()),
        sa.Column("status", sa.String(16), nullable=False, server_default="open"),
        sa.Column(
            "created_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_action_items_created_by_users"),
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint("status IN ('open', 'in_progress', 'done')", name="ck_action_items_status"),
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON action_items TO {RLS_ROLE}")
    enable_tenant_rls(op, "action_items")


def downgrade() -> None:
    disable_tenant_rls(op, "action_items")
    op.drop_table("action_items")
