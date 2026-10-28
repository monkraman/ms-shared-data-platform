# Architecture

## Approach
Use a modular monolith initially. Organise code by domain but deploy as one application until scale or operational needs justify otherwise.

## Components
- Angular web application
- FastAPI backend/API
- PostgreSQL
- Private object storage for source files, evidence and reports
- Monkspaces-approved OIDC identity provider
- Background processing for larger imports/reports when needed
- Docker-based development/deployment

## Domains
Tenant/access; product master; packaging specifications/components; materials/suppliers; imports/mapping; data quality/review; evidence/audit; compliance module framework; EPR first; future PPWR/DPP.

## Data flow
Source files -> staging/validation -> mapping/normalisation -> canonical model -> data-quality review -> EPR -> traceable output.

## Rules
Core entities use relational tables. JSONB is for controlled extensions, not the whole data model. Keep regulatory rules out of shared product entities. Every compliance run must be reproducible. Never assume an external API exists until verified. Record decisions in `DECISIONS.md`.
