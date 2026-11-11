"""Screen 2: workspace details (sector, branding, countries, modules) and legal entities.

Also copies the prototype's workspaces from ``platform.tenants`` (when that table exists,
as on the shared Neon database) so clients created in the old onboarding keep working.

Revision ID: 0004_workspaces
Revises: 0003_sign_in
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.tenancy import RLS_ROLE, disable_tenant_rls, enable_tenant_rls

revision: str = "0004_workspaces"
down_revision: str | None = "0003_sign_in"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("tenants", sa.Column("sector", sa.String(64), nullable=False, server_default="Other"))
    op.add_column("tenants", sa.Column("brand_color", sa.String(7), nullable=False, server_default="#1b3c6d"))
    op.add_column("tenants", sa.Column("logo_url", sa.Text()))
    op.add_column("tenants", sa.Column("countries", sa.ARRAY(sa.String(2)), nullable=False, server_default="{}"))
    op.add_column("tenants", sa.Column("modules", sa.ARRAY(sa.String(8)), nullable=False, server_default="{}"))
    op.create_check_constraint("ck_tenants_brand_color", "tenants", "brand_color ~ '^#[0-9a-fA-F]{6}$'")

    op.create_table(
        "legal_entities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("tenant_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
        sa.Column("registration_number", sa.String(64), nullable=False, server_default=""),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id", name="pk_legal_entities"),
        sa.ForeignKeyConstraint(
            ["tenant_id"], ["tenants.id"], ondelete="CASCADE", name="fk_legal_entities_tenant_id_tenants"
        ),
    )
    op.create_index("ix_legal_entities_tenant_id", "legal_entities", ["tenant_id"])
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON legal_entities TO {RLS_ROLE}")
    enable_tenant_rls(op, "legal_entities")

    # Prototype workspaces (raw psycopg table in schema "platform"); skipped where absent.
    op.execute(
        """
        DO $$
        BEGIN
          IF to_regclass('platform.tenants') IS NOT NULL THEN
            INSERT INTO tenants (id, slug, name, status, sector, countries, modules, created_at, updated_at)
            SELECT gen_random_uuid(), lower(p.id), p.name, 'active', COALESCE(NULLIF(p.sector, ''), 'Other'),
                   CASE WHEN upper(p.primary_jurisdiction) IN ('GB', 'UK') THEN ARRAY['UK']
                        WHEN p.primary_jurisdiction IS NULL THEN ARRAY[]::varchar[]
                        ELSE ARRAY[upper(left(p.primary_jurisdiction, 2))] END,
                   ARRAY['EPR'], now(), now()
            FROM platform.tenants p
            WHERE COALESCE(p.is_active, TRUE)
            ON CONFLICT (slug) DO UPDATE SET
              sector = CASE WHEN tenants.sector = 'Other' THEN EXCLUDED.sector ELSE tenants.sector END,
              countries = CASE WHEN tenants.countries = '{}' THEN EXCLUDED.countries ELSE tenants.countries END,
              modules = CASE WHEN tenants.modules = '{}' THEN EXCLUDED.modules ELSE tenants.modules END;
          END IF;
        EXCEPTION WHEN undefined_column OR undefined_table THEN
          RAISE NOTICE 'Prototype workspaces not copied: %', SQLERRM;
        END $$;
        """
    )
    # Branding the prototype showed for its two demo clients.
    op.execute(
        "UPDATE tenants SET logo_url = 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/"
        "Kraft_Heinz_Logo.svg/320px-Kraft_Heinz_Logo.svg.png', brand_color = '#1b3c6d' "
        "WHERE slug = 'khc-europe' AND logo_url IS NULL"
    )
    op.execute(
        "UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1527061011665-3652c757a4d4"
        "?w=120&auto=format&fit=crop&q=80', brand_color = '#0e2340' "
        "WHERE slug = 'nordhavn-spirits' AND logo_url IS NULL"
    )


def downgrade() -> None:
    disable_tenant_rls(op, "legal_entities")
    op.drop_table("legal_entities")
    op.drop_constraint("ck_tenants_brand_color", "tenants", type_="check")
    for column in ("modules", "countries", "logo_url", "brand_color", "sector"):
        op.drop_column("tenants", column)
