# Compliance Hub: guide for developers and AI agents

Start here. This page says how the repository is laid out, the rules every change follows, and where to find the rest. `CLAUDE.md` points here.

## What this is

A multi-tenant SaaS for packaging compliance. Clients' product and packaging data is collected once (ERP, supplier, PLM, files, manual entry), checked for gaps, and reused by compliance modules: national EPR, EU PPWR, the Digital Product Passport (DPP) and LCA. Roles today: **platform admin** (Monk Spaces, manages every client workspace) and **org admin** (one client).

## How it is being built

The prototype is being rebuilt **screen by screen** on a secure foundation. See [docs/SCREEN_BY_SCREEN_BUILD_PLAN.md](docs/SCREEN_BY_SCREEN_BUILD_PLAN.md) for the order, each screen's status and the definition of done. One screen is in build at a time. Finished screens are frozen; later changes go in small tickets.

| Part | Where | State |
| --- | --- | --- |
| Foundation (DB, RLS, permissions, audit, jobs, API client, shell) | `backend/app/core`, `frontend/src/app/core` | Done (Step 0) |
| Screen 1: secure sign-in | `backend/app/platform/sign_in.py`, `api/v1/auth.py`, `frontend/src/app/core/session`, `features/auth` | In review (Playwright test and staging demo open) |
| Screen 2: client workspaces | `backend/app/api/v1/workspaces.py`, `frontend/src/app/screens/workspaces` | Backend built (Postgres, RLS on legal entities, audit); in review |
| Screen 9 (part): users | `frontend/src/app/screens/users`, `GET/POST /api/v1/auth/users` | Platform admins list and add users; org-admin Team view next |
| Screens 3–8 (data points → data overview) | `backend/app/{catalog,ingestion,quality}`, `frontend/src/app/screens/*` | Backend built, CI-tested and live on `main` |
| Screens 12–13 (part): compliance | `backend/app/modules`, `api/v1/compliance.py`, `frontend/src/app/screens/compliance` | EPR UK / Denmark / SB 54 fees and PPWR Denmark Declarations of Conformity (Danish and English) on real data |
| Screen 14 (part): hotspots, scenarios, actions | `backend/app/modules/insights.py`, `api/v1/insights.py`, `frontend/src/app/screens/{insights,actions}` | Fee hotspots with their why, rule-based recommendations, what-if scenarios, action items |
| Horizon scanning | `backend/app/modules/horizon.py`, `api/v1/horizon.py`, `frontend/src/app/screens/horizon` | Upcoming requirements, collection lead time per workspace, readiness per milestone; gaps carry their phase |
| Screen 18 (part): data sources | `backend/app/api/v1/data_sources.py`, `frontend/src/app/screens/data-sources` | Connect ERP/PLM once, saved mapping, auto-approve, sync history (simulated systems) |
| Prototype pages | `frontend/src/app/features/*`, `backend/app/services/store.py` | Live until each screen replaces them |

## Repository map

```text
backend/                     FastAPI, Python 3.12
  app/core/                  config, db session, tenancy (RLS), auth + permissions, audit, jobs, errors
  app/platform/              tenants, users, memberships (models, repository, passwords)
  app/api/v1/                endpoints (new ones use require_permission + TenantDB)
  app/services/store.py      PROTOTYPE in-memory store. New code must not import it.
  migrations/                Alembic; every tenant table gets enable_tenant_rls()
  seeds/demo/                demo fixtures for `python -m app.seed demo`
  tests/                     pytest; DB tests need TEST_DATABASE_URL (CI provides Postgres)
frontend/                    Angular 22, standalone components, signals
  src/app/core/api/          ApiClient (typed from OpenAPI), contracts.ts (names for schema types), platform-api.ts
  src/app/core/session/      SessionService: sign-in, refresh, workspace switch, idle sign-out, permissions
  src/app/core/navigation/   sidebar groups and items, each with a permission
  src/app/screens/           rebuilt screens (2–8), one folder each
  src/app/shared/ui/         shared components: table, drawer, dialog, form field, chips, states
  src/app/features/          PROTOTYPE pages, replaced screen by screen
docs/                        plans, architecture, foundation guide (index: docs/README.md)
reference-docs-teams/        reference material and data sets (input, not app code)
```

## Rules every change follows

1. **Improve the existing code; never rebuild from scratch.** Reuse layouts, styles and services and replace the plumbing underneath.
2. **Tenant safety.** The workspace comes from the signed token only, never a header or browser storage. Tenant tables use Postgres RLS. Every endpoint uses `require_permission("...")`.
3. **API contract first.** A screen's endpoints are agreed before code. Planned ones live in `frontend/src/app/core/api/contracts.ts`; built ones are in the OpenAPI schema (`npm run api:generate`, checked in CI).
4. **No data in components.** Screens call `PlatformApi` or `ApiClient`. Demo data lives in `backend/seeds` and `backend/app/catalog/reference` (used by the simulated ERP/PLM sync).
5. **UI: simple like Linear or Apple Notes.** Labels and data only. No taglines, helper text or secondary labels; if a screen needs them, fix the layout. Use the platform tokens in `styles.css` (`.platform`) and the shared UI pieces.
6. **Docs move with the code.** Update this file, `docs/README.md`, the foundation guide and the build plan status in the same change.

## Sign-in and session (screen 1)

- `POST /api/v1/auth/sign-in` returns a 15-minute access token and sets an 8-hour httpOnly refresh cookie (`ch_refresh`). The frontend keeps the access token in sessionStorage only, never localStorage.
- On a 401, `session.interceptor.ts` refreshes once and retries; if that fails the user signs in again and returns to the same page. After 30 minutes without input the session ends.
- Switching workspace (`POST /auth/switch-tenant`) issues a new token; the workspace is never sent as a header (except by platform admins on prototype admin pages).
- Production builds call the API on the same origin (`/api`, proxied by `vercel.json`) so the refresh cookie is first-party. Do not set `API_BASE_URL` to the Render URL.
- Prototype pages read the user through `AuthService`, which now wraps `SessionService`.

## Client data: products, import, gaps (screens 3–8)

Screens 3–8 run on the backend (there is no mock API any more):

- **Data points and fields** (`app/catalog`): the dictionary is in the `data_points` table (seeded by migration 0005); the field catalogue and the sample client's products are JSON in `app/catalog/reference/`, generated by `node backend/scripts/make_reference_data.js` from `reference-docs-teams/datapoints-epr-ppwr-main/src`.
- **Products** are stored as field maps (`{"weight_g": {"dp": "DP09", "value": "26"}}`) on `products`, `product_components` and `product_sales`, all with tenant RLS. Totals and completeness are computed on read (`catalog/service.py`).
- **Import** (`app/ingestion`): CSV upload and the simulated ERP (SAP S/4HANA) and PLM (Trace One) syncs share one pipeline: draft → mapping (preview with checks) → approve, which runs the `ingestion.import` job. A sync sends only the fields whose data point comes from that system. Only SKU, product name and component are required; other missing values become gaps.
- **Gaps** (`app/quality`): the rule library (`gap_rules`, platform data) runs over the products on every read (`engine.py`); only people's decisions are stored (`gap_states`, tenant RLS). A workspace sees only rules for its modules and (when a rule names countries) its countries. Fixing a gap with a value writes it into the product. A rule's `estimate` makes its gaps **estimable** (`similar_average` of the same material and level, or a `fixed` value); others **need data**. `POST /gaps/estimate` writes the proposed values, marks weights `Estimated` and records the basis (`app/quality/estimates.py`).
- **Data sources** (`app/ingestion/sources.py`): a connected ERP or PLM keeps the mapping of its last approved import, so the next sync maps itself; with auto-approve on, a sync without row errors imports straight away. A CSV with the same columns as an earlier file reuses that file's mapping. `GET /imports` is the sync history.
- **Compliance** (`app/modules`, under `/api/v1/modules` because the prototype owns `/compliance`): EPR fees = units on the market (placed − exported) × component weight per unit, by material, × the regime's rate for the channels it charges (UK: household only). Rates are in `app/modules/reference/regimes.json`: UK uses the published 2025/26 base fees, Denmark and SB 54 are placeholders and the screen says so. The PPWR declaration is built from the product's fields and checks substances, recyclability, recycled content, minimisation and labelling; Danish text needs a native review before legal use.
- **Hotspots and scenarios** (`app/modules/insights.py`): hotspots are the components, products and materials carrying the fee, each with its arithmetic. Recommendations: lightweight (heavier than similar components of the same kind and material, per ml for primary containers), measure (fee on estimated weights), recyclability, recycled content. A scenario recalculates the fee with changed weights or materials without saving (`epr.calculate(..., overrides)`). Recommendations become action items (`action_items`, tenant RLS, one per recommendation).
- **Horizon scanning** (`app/modules/horizon.py`): milestones in `app/modules/reference/horizon.json` group data points by their dictionary date (`applies_from`). Rule: a workspace collects a requirement's data from `horizon_lead_months` (default 3, org admins change it) before it applies. Every gap has a `phase`: `now` (in force), `collecting` (inside the lead time) or `upcoming`; the Gaps screen shows due gaps first.
- **Improvements we postponed** are listed in [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md).
- **Platform admins** open a client's workspace from Client workspaces (Open workspace) to see its products, imports and gaps; their token then carries that workspace.

## Run and test

```bash
# backend (from backend/)
pip install -r requirements.txt
alembic upgrade head                 # needs DATABASE_URL
uvicorn app.main:app --reload
python -m pytest                     # DB tests need TEST_DATABASE_URL

# frontend (from frontend/)
npm ci
npm start                            # http://localhost:4200
npm run test:ci
npm run build                        # production build (runs scripts/set-env.js)
```

Sign in with a demo user from `backend/app/services/store.py`: on first sign-in the user is copied into the database with an Argon2 hash (`app/platform/legacy_import.py`). Platform admins land on Client workspaces, org admins on Products; users in several workspaces choose one first.

## Deploys

`main` deploys automatically: the API to Render (`render.yaml`; it runs `alembic upgrade head` before start) and the frontend to Vercel (`vercel.json` proxies `/api` to Render). Work happens on branches (`step-*/…`, `screen/NN-name`); CI must be green before merging to `main`.

## More

- [docs/README.md](docs/README.md): index of all documentation
- [docs/FOUNDATION_GUIDE.md](docs/FOUNDATION_GUIDE.md): how a screen uses the foundation, step by step
- [docs/TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md](docs/TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md): the target design
