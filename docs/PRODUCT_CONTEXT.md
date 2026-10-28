# Product Context

## Vision
Build a shared product and packaging data platform for Monkspaces consultants managing multiple client companies. Ingest spreadsheets, ERP/PLM exports and supplier files; normalise them into a governed model; resolve data-quality gaps; reuse the foundation across compliance modules.

## Current assumptions
- Markets: UK + EU platform direction; first workflow must specify one jurisdiction and reporting period.
- Industry: consumer goods / FMCG packaging.
- Sources: Excel/CSV, ERP/PLM exports and supplier files.
- Operating model: consultants manage assigned client workspaces; client logins are an MVP decision.
- First module: EPR. Future modules: PPWR, DPP and others.

## Principles
- Common entities are shared; jurisdiction-specific rules and outputs remain separate.
- Preserve raw and normalised values, source, unit and mapping history.
- Version packaging specifications and effective dates.
- Missing data must not silently become zero.
- Each compliance run records jurisdiction, period, rule version and reproducible input snapshot.
- All tenant-owned records, files, jobs, exports and audit events are tenant-scoped.
- Keep the first release narrow and demonstrable.
