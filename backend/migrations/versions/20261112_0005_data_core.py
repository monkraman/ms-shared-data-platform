"""Screens 3–8: data points, products with components and sales, gap rules, gap status, imports.

``data_points`` and ``gap_rules`` are platform data (one library for every client), seeded
here. Products, their components and sales lines, gap decisions and import batches are
tenant data with row-level security.

Revision ID: 0005_data_core
Revises: 0004_workspaces
Create Date: 2026-11-12
"""

import json
from collections.abc import Sequence
from pathlib import Path

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

from app.core.tenancy import RLS_ROLE, disable_tenant_rls, enable_tenant_rls

revision: str = "0005_data_core"
down_revision: str | None = "0004_workspaces"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_REFERENCE = Path(__file__).resolve().parents[2] / "app" / "catalog" / "reference" / "data-points.json"

RULES = [
    ("GR-001", "Value missing", "DP54", "registry_id", {"kind": "missing"}, "blocker", ["DPP"]),
    (
        "GR-002",
        "Passport host not decided",
        "DP53",
        "passport_host",
        {"kind": "in", "values": ["Not decided"]},
        "warning",
        ["DPP"],
    ),  # noqa: E501
    (
        "GR-003",
        "Weight taken from specification",
        "DP44",
        "weight_source",
        {"kind": "in", "values": ["Spec", "Estimated"]},
        "warning",
        ["EPR", "PPWR"],
    ),  # noqa: E501
    (
        "GR-004",
        "Limited recyclability",
        "DP12",
        "recyclability_result",
        {"kind": "in", "values": ["Limited", "Poor", "Not recyclable"]},
        "warning",
        ["PPWR", "EPR"],
    ),  # noqa: E501
    (
        "GR-005",
        "Recycled content without certificate",
        "DP14",
        "recycled_content_cert",
        {"kind": "certificate_missing"},
        "blocker",
        ["PPWR"],
    ),  # noqa: E501
    (
        "GR-006",
        "Food contact without PFAS declaration",
        "DP17",
        "pfas_declaration_ref",
        {"kind": "pfas_missing"},
        "blocker",
        ["PPWR"],
    ),  # noqa: E501
    (
        "GR-007",
        "Harmonised label not in place",
        "DP39",
        "harmonised_label_status",
        {"kind": "in", "values": ["Planned", "Not started"]},
        "warning",
        ["PPWR"],
    ),  # noqa: E501
    ("GR-008", "Component weight missing", "DP09", "weight_g", {"kind": "missing"}, "blocker", ["EPR", "PPWR"]),
    ("GR-009", "GTIN missing", "DP02", "gtin", {"kind": "missing"}, "blocker", ["EPR", "PPWR", "DPP"]),
]

TENANT_TABLES = ("products", "product_components", "product_sales", "gap_states", "import_batches")


def _timestamps() -> list[sa.Column]:
    return [
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    ]


def _tenant(table: str) -> sa.Column:
    return sa.Column(
        "tenant_id",
        sa.Uuid(),
        sa.ForeignKey("tenants.id", ondelete="CASCADE", name=f"fk_{table}_tenant_id_tenants"),
        nullable=False,
        index=True,
    )


def upgrade() -> None:
    data_points = op.create_table(
        "data_points",
        sa.Column("code", sa.String(8), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("source", sa.String(16), nullable=False),
        sa.Column("system_field", sa.String(255)),
        sa.Column("outputs", sa.ARRAY(sa.String(8)), nullable=False, server_default="{}"),
        sa.Column("countries", sa.ARRAY(sa.String(2)), nullable=False, server_default="{}"),
        sa.Column("applies_from", sa.String(32)),
        *_timestamps(),
    )
    points = json.loads(_REFERENCE.read_text(encoding="utf-8"))["data_points"]
    op.bulk_insert(
        data_points,
        [
            {
                "code": d["code"],
                "name": d["name"],
                "description": d.get("description") or "",
                "source": d["source"],
                "system_field": d.get("system_field"),
                "outputs": d.get("outputs") or [],
                "countries": d.get("countries") or [],
                "applies_from": d.get("applies_from"),
            }
            for d in points
        ],
    )

    gap_rules = op.create_table(
        "gap_rules",
        sa.Column("id", sa.String(16), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("data_point", sa.String(8), nullable=False),
        sa.Column("field", sa.String(64), nullable=False),
        sa.Column("check", postgresql.JSONB(), nullable=False),
        sa.Column("severity", sa.String(16), nullable=False),
        sa.Column("modules", sa.ARRAY(sa.String(8)), nullable=False, server_default="{}"),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        *_timestamps(),
        sa.CheckConstraint("severity IN ('blocker', 'warning')", name="ck_gap_rules_severity"),
    )
    op.bulk_insert(
        gap_rules,
        [
            {"id": i, "name": n, "data_point": dp, "field": f, "check": c, "severity": s, "modules": m, "active": True}
            for i, n, dp, f, c, s, m in RULES
        ],
    )

    op.create_table(
        "products",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant("products"),
        sa.Column("sku", sa.String(64), nullable=False),
        sa.Column("fields", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("passport", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("source", sa.String(16), nullable=False, server_default="manual"),
        *_timestamps(),
        sa.UniqueConstraint("tenant_id", "sku", name="uq_products_tenant_sku"),
    )
    for table, extra in (
        ("product_components", [sa.Column("position", sa.Integer(), nullable=False, server_default="0")]),
        ("product_sales", []),
    ):
        op.create_table(
            table,
            sa.Column("id", sa.Uuid(), primary_key=True),
            _tenant(table),
            sa.Column(
                "product_id",
                sa.Uuid(),
                sa.ForeignKey("products.id", ondelete="CASCADE", name=f"fk_{table}_product_id_products"),
                nullable=False,
                index=True,
            ),
            sa.Column("code", sa.String(80), nullable=False),
            *extra,
            sa.Column("fields", postgresql.JSONB(), nullable=False, server_default="{}"),
            *_timestamps(),
            sa.UniqueConstraint("product_id", "code", name=f"uq_{table}_product_code"),
        )

    op.create_table(
        "gap_states",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant("gap_states"),
        sa.Column("gap_id", sa.String(160), nullable=False),
        sa.Column("status", sa.String(16), nullable=False),
        sa.Column("note", sa.Text()),
        sa.Column(
            "updated_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_gap_states_updated_by_users"),
        ),
        *_timestamps(),
        sa.UniqueConstraint("tenant_id", "gap_id", name="uq_gap_states_tenant_gap"),
    )

    op.create_table(
        "import_batches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        _tenant("import_batches"),
        sa.Column("filename", sa.String(255), nullable=False),
        sa.Column("source", sa.String(16), nullable=False, server_default="csv"),
        sa.Column("status", sa.String(16), nullable=False, server_default="draft"),
        sa.Column("columns", postgresql.JSONB(), nullable=False),
        sa.Column("rows", postgresql.JSONB(), nullable=False),
        sa.Column("mapping", postgresql.JSONB(), nullable=False, server_default="{}"),
        sa.Column("extras", postgresql.JSONB()),
        sa.Column("result", postgresql.JSONB()),
        sa.Column(
            "created_by",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="SET NULL", name="fk_import_batches_created_by_users"),
        ),
        sa.Column(
            "job_id", sa.Uuid(), sa.ForeignKey("jobs.id", ondelete="SET NULL", name="fk_import_batches_job_id_jobs")
        ),
        *_timestamps(),
    )

    op.execute(f"GRANT SELECT ON data_points, gap_rules TO {RLS_ROLE}")
    op.execute(f"GRANT INSERT, UPDATE, DELETE ON gap_rules TO {RLS_ROLE}")
    for table in TENANT_TABLES:
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO {RLS_ROLE}")
        enable_tenant_rls(op, table)


def downgrade() -> None:
    for table in reversed(TENANT_TABLES):
        disable_tenant_rls(op, table)
        op.drop_table(table)
    op.drop_table("gap_rules")
    op.drop_table("data_points")
