# Compliance Hub: guide for developers and AI agents

Start here. This page says how the repository is laid out, the rules every change follows, and where to find the rest. `CLAUDE.md` points here.

## What this is

A multi-tenant SaaS for packaging compliance. Clients' product and packaging data is collected once (ERP, supplier, PLM, files, manual entry), checked for gaps, and reused by compliance modules: national EPR, EU PPWR, the Digital Product Passport (DPP) and LCA. Roles today: **platform admin** (Monk Spaces, manages every client workspace) and **org admin** (one client).

## How it is being built

The platform is built **screen by screen** on a secure foundation (the old prototype is gone). See [docs/SCREEN_BY_SCREEN_BUILD_PLAN.md](docs/SCREEN_BY_SCREEN_BUILD_PLAN.md) for the order, each screen's status and the definition of done. One screen is in build at a time. Finished screens are frozen; later changes go in small tickets.

| Part | Where | State |
| --- | --- | --- |
| Foundation (DB, RLS, permissions, audit, jobs, API client, shell) | `backend/app/core`, `frontend/src/app/core` | Done (Step 0) |
| Screen 1: secure sign-in | `backend/app/platform/sign_in.py`, `api/v1/auth.py`, `frontend/src/app/core/session`, `features/auth` | In review (Playwright test and staging demo open) |
| Screen 2: client workspaces | `backend/app/api/v1/workspaces.py`, `frontend/src/app/screens/workspaces` | Backend built (Postgres, RLS on legal entities, audit); in review |
| Screen 9: users and team | `backend/app/api/v1/users.py`, `frontend/src/app/screens/{users,team}` | Platform admins manage every user (workspaces, roles, consultants, disable, temporary passwords); org admins manage their team |
| Screens 3–8 (data points → data overview) | `backend/app/{catalog,ingestion,quality}`, `frontend/src/app/screens/*` | Backend built, CI-tested and live on `main` |
| Screens 12–13 (part): compliance | `backend/app/modules`, `api/v1/compliance.py`, `frontend/src/app/screens/compliance` | EPR UK / Denmark / SB 54 fees and PPWR Denmark Declarations of Conformity (Danish and English) on real data |
| Screen 14 (part): hotspots, scenarios, actions | `backend/app/modules/insights.py`, `api/v1/insights.py`, `frontend/src/app/screens/{insights,actions}` | Fee hotspots with their why, rule-based recommendations, what-if scenarios, action items |
| Horizon scanning | `backend/app/modules/horizon.py`, `api/v1/horizon.py`, `frontend/src/app/screens/horizon` | Upcoming requirements, collection lead time per workspace, readiness per milestone; gaps carry their phase |
| Screen 18 (part): data sources | `backend/app/api/v1/data_sources.py`, `frontend/src/app/screens/data-sources` | Connect ERP/PLM once, saved mapping, auto-approve, sync history (simulated systems) |

## Repository map

```text
backend/                     FastAPI, Python 3.12
  app/core/                  config, db session, tenancy (RLS), auth + permissions, audit, jobs, errors
  app/platform/              tenants, users, memberships (models, repository, passwords)
  app/api/v1/                endpoints (new ones use require_permission + TenantDB)
  app/catalog, ingestion,    data points, products, imports and syncs, gaps, EPR/PPWR/insights/horizon
  app/quality, modules/
  migrations/                Alembic; every tenant table gets enable_tenant_rls()
  seeds/demo/                demo fixtures for `python -m app.seed demo`
  tests/                     pytest; DB tests need TEST_DATABASE_URL (CI provides Postgres)
frontend/                    Angular 22, standalone components, signals
  src/app/core/api/          ApiClient (typed from OpenAPI), contracts.ts (names for schema types), platform-api.ts
  src/app/core/session/      SessionService: sign-in, refresh, workspace switch, idle sign-out, permissions
  src/app/core/navigation/   sidebar groups and items, each with a permission (or a list: any of them)
  src/app/screens/           rebuilt screens (2–8), one folder each
  src/app/shared/ui/         shared components: table, drawer, dialog, form field, chips, states
  src/app/features/          sign-in, workspace picker and the app shell
docs/                        plans, architecture, foundation guide (index: docs/README.md)
reference-docs-teams/        reference material and data sets (input, not app code); datapoints-epr-ppwr-main
                             is also published as-is at /datapoints/ (platform admin "Data explorer")
```

## Rules every change follows

1. **Improve the existing code; never rebuild from scratch.** Reuse layouts, styles and services and replace the plumbing underneath.
2. **Tenant safety.** The workspace comes from the signed token only, never a header or browser storage. Tenant tables use Postgres RLS. Every endpoint uses `require_permission("...")`.
3. **API contract first.** A screen's endpoints are agreed before code. Planned ones live in `frontend/src/app/core/api/contracts.ts`; built ones are in the OpenAPI schema (`npm run api:generate`, checked in CI).
4. **No data in components.** Screens call `PlatformApi` or `ApiClient`. Demo data lives in `backend/seeds` and `backend/app/catalog/reference` (used by the simulated ERP/PLM sync).
5. **UI: simple like Linear or Apple Notes.** Labels and data only. No taglines, helper text or secondary labels; if a screen needs them, fix the layout. Use the platform tokens in `styles.css` (`.platform`) and the shared UI pieces.
6. **Docs move with the code.** Update this file, `docs/README.md`, the foundation guide, the build plan status and [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md) (the HLD: storage, import and re-sync rules, validation, gaps, compliance) in the same change.

## Sign-in and session (screen 1)

- `POST /api/v1/auth/sign-in` returns a 15-minute access token and sets an 8-hour httpOnly refresh cookie (`ch_refresh`). The frontend keeps the access token in sessionStorage only, never localStorage.
- On a 401, `session.interceptor.ts` refreshes once and retries; if that fails the user signs in again and returns to the same page. After 30 minutes without input the session ends.
- Switching workspace (`POST /auth/switch-tenant`) issues a new token; the workspace is never sent as a header .
- **Demo accounts on the sign-in page (temporary):** while `environment.demoSignIn` is on, the page shows the platform admin and the Kraft Heinz org admin with their email and password; a click signs in. Anyone with the link can then sign in, so set `DEMO_SIGN_IN=false` in Vercel and rebuild before real client data, and change those passwords.
- Production builds call the API on the same origin (`/api`, proxied by `vercel.json`) so the refresh cookie is first-party. Do not set `API_BASE_URL` to the Render URL.

## Navigation (names follow the client-approved mockup)

The sidebar (`core/navigation/nav-items.ts`) shows only what the user's permissions and the workspace's modules allow:

- **Platform** (Monk Spaces): Client workspaces, Users, Data points, Data explorer, Gap rules.
- **Overview:** Home (`/app/home`, where org users land), Setup (`/app/setup`: tabs Data connections and People).
- **Data:** Data collection (`/app/data`: tabs Overview, Import and Data point map, the team's explorer), Data gaps, Data validation, SKU library (`/app/products`).
- **Comply:** Compliance.
- **Insights:** Hotspots (`/app/insights`), Scenarios (`/app/scenarios`, the same component with `data.view`; the scenario in progress is shared through `ScenarioDraft`), Horizon scanning, Actions.

A page made of existing screens uses `TabbedPageComponent` (`shared/ui`) via `tabbedPage()` in `app.routes.ts`; earlier addresses (`/app/team`, `/app/data-sources`, `/app/import`, `/app/data-overview`) redirect.

## What each client can configure (SaaS)

Per workspace, without code changes:

- **Identity:** name, logo, brand colour (the app shell shows them), legal entities, countries.
- **Modules (plug-ins):** EPR, PPWR, DPP, LCA. Each module the workspace has becomes a `module.<id>` permission for its members (`app/core/permissions.py`); module screens and endpoints require it, so switching a module off removes it for that client at once. A workspace with no modules set gets all of them.
- **People:** members and roles (org admin, analyst, viewer; Monk Spaces consultants are assigned by platform admins and see only their assigned workspaces).
- **Data sources:** which systems are connected, their saved column mappings, auto-approve.
- **Gap rules** apply by the workspace's modules and countries; the rule library itself is platform-wide.
- **Horizon:** how many months ahead data collection starts.

Not yet per client (see [docs/IMPROVEMENTS.md](docs/IMPROVEMENTS.md)): its own gap rules, EPR rates, field catalogue and terminology.

## Client data: products, import, gaps (screens 3–8)

Screens 3–8 run on the backend (there is no mock API any more):

- **Data points and fields** (`app/catalog`): the dictionary is in the `data_points` table (seeded by migration 0005); the field catalogue and the sample client's products are JSON in `app/catalog/reference/`, generated by `node backend/scripts/make_reference_data.js` from `reference-docs-teams/datapoints-epr-ppwr-main/src`.
- **Products** are stored as field maps (`{"weight_g": {"dp": "DP09", "value": "26"}}`) on `products`, `product_components` and `product_sales`, all with tenant RLS. Totals and completeness are computed on read (`catalog/service.py`).
- **Import** (`app/ingestion`): CSV upload and the simulated ERP (SAP S/4HANA) and PLM (Trace One) syncs share one pipeline: draft → mapping (preview with checks) → approve, which runs the `ingestion.import` job. A sync sends only the fields whose data point comes from that system. Only SKU, product name and component are required; other missing values become gaps.
- **Gaps** (`app/quality`): the rule library (`gap_rules`, platform data) runs over the products on every read (`engine.py`); only people's decisions are stored (`gap_states`, tenant RLS). A workspace sees only rules for its modules and (when a rule names countries) its countries. Fixing a gap with a value writes it into the product. A rule's `estimate` makes its gaps **estimable** (`similar_average` of the same material and level, or a `fixed` value); others **need data**. `POST /gaps/estimate` writes the proposed values, marks weights `Estimated` and records the basis (`app/quality/estimates.py`).
- **Editing and lineage:** products, passport values and components are edited on the product page (`PATCH /products/{sku}`, `/components/{code}`); every stored value records its `source` (csv, erp, plm, manual, estimate, correction), every edit is audited per field and shown as the product's history.
- **Validation** (`app/quality/validation.py`): values are checked against the field catalogue (type, allowed values, ranges, dates, URLs, GTIN check digit) with a suggested correction where one can be worked out. Edits are refused with "Did you mean …?"; imports accept such values as warnings; `GET /validation` lists them by source system, `POST /validation/apply` corrects them, and the screen exports the list for each source system.
- **Data sources** (`app/ingestion/sources.py`): a connected ERP or PLM keeps the mapping of its last approved import, so the next sync maps itself; with auto-approve on, a sync without row errors imports straight away. A CSV with the same columns as an earlier file reuses that file's mapping. `GET /imports` is the sync history.
- **Compliance** (`app/modules`, under `/api/v1/modules`): EPR fees = units on the market (placed − exported) × component weight per unit, by material, × the regime's rate for the channels it charges (UK: household only), counting only sales lines in the regime's country (`market`; blank counts everywhere) and modulated by the component's RAM rating where the regime sets `modulation`. Rates are in `app/modules/reference/regimes.json`: UK uses the published 2025/26 base fees, Denmark and SB 54 are placeholders and the screen says so. The PPWR declaration is built from the product's fields and checks substances, recyclability, recycled content, minimisation and labelling; Danish text needs a native review before legal use.
- **Per-SKU rules** (`app/modules/assessment.py`, `skus.py`, rules in `reference/assessment.json`): UK RAM rating per component, PPWR recyclability grade A–E per packaging unit, 2030 recycled-content targets per unit, markets, fee per regime and a status with reasons. `GET /products` returns them (the SKU library) and each component carries its `assessment`; the PPWR declaration uses the same rules.
- **Hotspots and scenarios** (`app/modules/insights.py`): hotspots are the components, products and materials carrying the fee, each with its arithmetic. Recommendations: lightweight (heavier than similar components of the same kind and material, per ml for primary containers), measure (fee on estimated weights), recyclability, recycled content. A scenario recalculates the fee with changed weights or materials without saving (`epr.calculate(..., overrides)`). Recommendations become action items (`action_items`, tenant RLS, one per recommendation).
- **Horizon scanning** (`app/modules/horizon.py`): milestones in `app/modules/reference/horizon.json` group data points by their dictionary date (`applies_from`). Rule: a workspace collects a requirement's data from `horizon_lead_months` (default 3, org admins change it) before it applies. Every gap has a `phase`: `now` (in force), `collecting` (inside the lead time) or `upcoming`; the Gaps screen shows due gaps first.
- **Home** (`app/modules/home.py`, `GET /home`): fees per EPR regime with the fee's split by RAM rating, PPWR declarations ready and SKUs failing 2030, data health (stored values verified, estimated or flagged by validation; open gaps), the top hotspots with their best recommendation, savings in open actions, and what waits (corrections, gaps due, declarations to review, open actions). All from the same engines as the screens. Filing obligations come later, with the filing work.
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

Demo accounts are listed with Argon2 hashes in `backend/seeds/bootstrap_users.json` and created on their first sign-in (`app/platform/bootstrap.py`); `python -m app.seed demo` loads full demo workspaces. To give a workspace products, sync SAP and Trace One on Data sources, then import `backend/seeds/demo/vendor-declarations.csv` and `compliance-register.csv` on Import (vendor data and the client's own entries, with a few values left out so gaps show; rebuilt by `python backend/scripts/make_demo_csvs.py`). Platform admins land on Client workspaces, org admins on Home; users in several workspaces choose one first.

## Deploys

`main` deploys automatically: the API to Render (`render.yaml`; it runs `alembic upgrade head` before start) and the frontend to Vercel (`vercel.json` proxies `/api` to Render). Work happens on branches (`step-*/…`, `screen/NN-name`); CI must be green before merging to `main`.

## More

- [docs/SYSTEM_DESIGN.md](docs/SYSTEM_DESIGN.md): **system design (HLD)** — architecture, how data is stored, imported, re-synced, validated and used
- [docs/README.md](docs/README.md): index of all documentation
- [docs/FOUNDATION_GUIDE.md](docs/FOUNDATION_GUIDE.md): how a screen uses the foundation, step by step
- [docs/TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md](docs/TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md): the target design
