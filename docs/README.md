# Documentation index

Start with [../AGENTS.md](../AGENTS.md) for the repository map and the rules every change follows.

## Plans (current)

| Document | What it covers |
| --- | --- |
| [SCREEN_BY_SCREEN_BUILD_PLAN.md](SCREEN_BY_SCREEN_BUILD_PLAN.md) | Screen order, status, definition of done, specs for screens 1–2 |
| [TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md](TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md) | Target architecture: modules, data model, ingestion, quality, tenancy, roadmap |
| [FOUNDATION_GUIDE.md](FOUNDATION_GUIDE.md) | How a screen uses the foundation (backend and frontend), with checklists |
| [IMPROVEMENTS.md](IMPROVEMENTS.md) | Improvements we chose to postpone, with where they live |

## Product and domain

| Document | What it covers |
| --- | --- |
| [PRODUCT_CONTEXT.md](PRODUCT_CONTEXT.md) | Who the product is for and why |
| [REQUIREMENTS.md](REQUIREMENTS.md) | Functional requirements |
| [COMPLIANCE_MODULES.md](COMPLIANCE_MODULES.md) | EPR, PPWR, DPP and LCA modules |
| [COMPLIANCE_HUB_SYSTEM_FLOW_SPEC.md](COMPLIANCE_HUB_SYSTEM_FLOW_SPEC.md) | End-to-end system flow |
| [REGULATORY_DATA_DICTIONARY_SPEC.csv](REGULATORY_DATA_DICTIONARY_SPEC.csv) | Regulatory data points |
| [INGESTION_AND_DATA_QUALITY.md](INGESTION_AND_DATA_QUALITY.md) | Ingestion channels and gap rules |
| [INTEGRATION_GUIDE_SNOWFLAKE_DEVEX.md](INTEGRATION_GUIDE_SNOWFLAKE_DEVEX.md) | Snowflake and Trace One Devex integration |

## Engineering

| Document | What it covers |
| --- | --- |
| [ARCHITECTURE.md](ARCHITECTURE.md), [SHARED_DATA_FOUNDATION_ARCHITECTURE_SPEC.md](SHARED_DATA_FOUNDATION_ARCHITECTURE_SPEC.md) | Earlier architecture notes (the target plan supersedes them where they differ) |
| [DATA_MODEL.md](DATA_MODEL.md), [DATABASE_SCHEMA_PLAN.md](DATABASE_SCHEMA_PLAN.md) | Data model drafts |
| [SECURITY_AND_TENANCY.md](SECURITY_AND_TENANCY.md) | Security and tenancy |
| [TEST_STRATEGY.md](TEST_STRATEGY.md) | Testing approach |
| [DECISIONS.md](DECISIONS.md) | Decision log |

## Code-level references

- API contracts for screens 3–8 (screen 2's types come from the OpenAPI schema): `frontend/src/app/core/api/contracts.ts`
- Client workspaces API: `backend/app/api/v1/workspaces.py`; migration `20261112_0004_workspaces.py`
- Sign-in and session: `backend/app/platform/sign_in.py`, `frontend/src/app/core/session/` (see AGENTS.md, "Sign-in and session")
- Products, import, gaps: `backend/app/catalog`, `backend/app/ingestion`, `backend/app/quality` (see AGENTS.md, "Client data")
- Permissions: `backend/app/core/permissions.py`; frontend navigation permissions: `frontend/src/app/core/navigation/nav-items.ts`
