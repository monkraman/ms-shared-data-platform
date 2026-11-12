"""Recreate the restricted RLS role and its privileges when a database lacks them.

Roles are not part of a database dump, so a database restored or copied into a new Postgres
project has every table (and an up-to-date alembic version) but no ``compliance_rls``; every
request then fails at ``SET LOCAL ROLE``. This repeats migration 0002 idempotently.

Revision ID: 0011_ensure_rls_role
Revises: 0010_users
Create Date: 2026-11-12
"""

from collections.abc import Sequence

from alembic import op

from app.core.tenancy import RLS_ROLE

revision: str = "0011_ensure_rls_role"
down_revision: str | None = "0010_users"
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
    op.execute(
        f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO {RLS_ROLE}"
    )
    op.execute(f"ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO {RLS_ROLE}")


def downgrade() -> None:
    # Nothing to undo: the role belongs to migration 0002.
    pass
