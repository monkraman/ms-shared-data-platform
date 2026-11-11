"""Estimable gaps: each gap rule says whether its gap may be filled with an estimate, and how.

``estimate`` is ``{"method": "similar_average"}`` (average of the same field on components
of the same material and packaging level) or ``{"method": "fixed", "value": "0"}``; NULL
means the gap needs real data. Missing weights become estimable; a new rule flags missing
recycled content, estimated conservatively as 0%.

Revision ID: 0007_gap_estimates
Revises: 0006_data_sources
Create Date: 2026-11-12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0007_gap_estimates"
down_revision: str | None = "0006_data_sources"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("gap_rules", sa.Column("estimate", postgresql.JSONB()))
    op.execute("""UPDATE gap_rules SET estimate = '{"method": "similar_average"}' WHERE id = 'GR-008'""")
    op.execute(
        """
        INSERT INTO gap_rules (id, name, data_point, field, "check", severity, modules, countries, active, estimate)
        VALUES ('GR-010', 'Recycled content missing', 'DP13', 'recycled_content_pct', '{"kind": "missing"}',
                'warning', ARRAY['PPWR', 'EPR'], '{}', true, '{"method": "fixed", "value": "0"}')
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute("DELETE FROM gap_rules WHERE id = 'GR-010'")
    op.drop_column("gap_rules", "estimate")
