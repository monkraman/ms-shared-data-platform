"""Restricted role that every app transaction switches to, so RLS always applies.

Hosted Postgres (for example Neon) often gives the login role BYPASSRLS, which would
silently skip tenant isolation. Each transaction therefore runs ``SET LOCAL ROLE
compliance_rls``: a role with table privileges but no BYPASSRLS.

The migration user needs CREATEROLE (Neon's owner role has it).

Revision ID: 0002_rls_role
Revises: 0001_foundation
Create Date: 2026-11-11
"""

from collections.abc import Sequence

from alembic import op

from app.core.tenancy import RLS_ROLE

revision: str = "0002_rls_role"
down_revision: str | None = "0001_foundation"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        f"""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '{RLS_ROLE}') THEN
                CREATE ROLE {RLS_ROLE} NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
            END IF;
        END
        $$;
        """
    )
    op.execute(f"GRANT {RLS_ROLE} TO CURRENT_USER")
    op.execute(f"GRANT USAGE ON SCHEMA public TO {RLS_ROLE}")
    op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO {RLS_ROLE}")
    op.execute(f"GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO {RLS_ROLE}")
    # Tables that later migrations create get the same privileges automatically.
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {RLS_ROLE}"
    )
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {RLS_ROLE}")


def downgrade() -> None:
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM {RLS_ROLE}")
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM {RLS_ROLE}")
    op.execute(f"REVOKE ALL ON ALL TABLES IN SCHEMA public FROM {RLS_ROLE}")
    op.execute(f"REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM {RLS_ROLE}")
    op.execute(f"REVOKE USAGE ON SCHEMA public FROM {RLS_ROLE}")
    # The role is cluster-wide and may serve other databases, so it is not dropped.
