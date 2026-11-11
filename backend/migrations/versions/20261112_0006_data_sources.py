"""Data sources with saved mappings, sync history links, and gap rules scoped by country.

Revision ID: 0006_data_sources
Revises: 0005_data_core
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.core.tenancy import RLS_ROLE, disable_tenant_rls, enable_tenant_rls

revision: str = "0006_data_sources"
down_revision: str | None = "0005_data_core"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("gap_rules", sa.Column("countries", sa.ARRAY(sa.String(2)), nullable=False, server_default="{}"))

    op.create_table(
        "data_sources",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "tenant_id",
            sa.Uuid(),
            sa.ForeignKey("tenants.id", ondelete="CASCADE", name="fk_data_sources_tenant_id_tenants"),
            nullable=False,
            index=True,
        ),
        sa.Column("system", sa.String(16), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("mapping", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("auto_approve", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("last_synced_at", sa.DateTime(timezone=True)),
        sa.Column("last_status", sa.String(16)),
        sa.Column("last_result", postgresql.JSONB()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("tenant_id", "system", name="uq_data_sources_tenant_system"),
    )
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON data_sources TO {RLS_ROLE}")
    enable_tenant_rls(op, "data_sources")

    op.add_column(
        "import_batches",
        sa.Column(
            "data_source_id",
            sa.Uuid(),
            sa.ForeignKey("data_sources.id", ondelete="SET NULL", name="fk_import_batches_data_source_id_data_sources"),
        ),
    )
    op.create_index("ix_import_batches_data_source_id", "import_batches", ["data_source_id"])


def downgrade() -> None:
    op.drop_index("ix_import_batches_data_source_id", "import_batches")
    op.drop_column("import_batches", "data_source_id")
    disable_tenant_rls(op, "data_sources")
    op.drop_table("data_sources")
    op.drop_column("gap_rules", "countries")
