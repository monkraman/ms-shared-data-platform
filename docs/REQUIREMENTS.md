# Requirements and Acceptance Criteria

## MVP objective
Demonstrate one end-to-end EPR workflow on a reusable, tenant-isolated data foundation.

## In scope
- Tenant/workspace setup and consultant-to-client assignments.
- Product, packaging specification, component, material and supplier records.
- CSV/Excel upload, preview, mapping, validation errors and import history.
- Source lineage and supplier evidence.
- Data-quality issue ownership, correction and review.
- One EPR workflow for one selected jurisdiction and period.
- Traceable outputs, export, audit history and role-based access.
- Automated tenant-isolation tests.

## Defer
Full PPWR and DPP workflows; multiple EPR jurisdictions in first delivery; live ERP/PLM connectors before access is verified; bidirectional write-back; AI compliance decisions; microservices.

## Acceptance criteria
- Two tenants operate independently; consultants only access assigned tenants.
- Representative data imports without direct database edits.
- Import errors identify row/field and reason.
- Normalised values retain source, unit and mapping lineage.
- Packaging changes do not silently alter prior approved runs.
- Results reconcile to an independently verified reference case.
- API, search, export, file and background-job tenant-boundary tests pass.
- Known limitations are documented.

Regulatory requirements must be verified against authoritative jurisdiction-specific sources and reviewed by a qualified domain expert. This is not legal advice.
