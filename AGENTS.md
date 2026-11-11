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
| Screens 3–8 (data points → data overview) | `frontend/src/app/screens/*` | Frontend done on the **mock API**; backend per screen next |
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
  src/app/core/api/          ApiClient (typed from OpenAPI), contracts.ts (planned API), mock/ (mock API)
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
4. **No data in components.** Screens call `PlatformApi` or `ApiClient`. Demo data lives in fixtures (`core/api/mock/fixtures`, `backend/seeds`).
5. **UI: simple like Linear or Apple Notes.** Labels and data only. No taglines, helper text or secondary labels; if a screen needs them, fix the layout. Use the platform tokens in `styles.css` (`.platform`) and the shared UI pieces.
6. **Docs move with the code.** Update this file, `docs/README.md`, the foundation guide and the build plan status in the same change.

## Sign-in and session (screen 1)

- `POST /api/v1/auth/sign-in` returns a 15-minute access token and sets an 8-hour httpOnly refresh cookie (`ch_refresh`). The frontend keeps the access token in sessionStorage only, never localStorage.
- On a 401, `session.interceptor.ts` refreshes once and retries; if that fails the user signs in again and returns to the same page. After 30 minutes without input the session ends.
- Switching workspace (`POST /auth/switch-tenant`) issues a new token; the workspace is never sent as a header (except by platform admins on prototype admin pages).
- Production builds call the API on the same origin (`/api`, proxied by `vercel.json`) so the refresh cookie is first-party. Do not set `API_BASE_URL` to the Render URL.
- Prototype pages read the user through `AuthService`, which now wraps `SessionService`.

## The mock API (screens 3–8)

Screens 3–8 call real-looking endpoints (`contracts.ts`). Until a screen's backend ships, `core/api/mock/mock-api.interceptor.ts` answers them from an in-browser database seeded from fixtures. Changes persist in localStorage (`ch.mockdb.v1`). It is switched on by `environment.mockApi` (`MOCK_API=false` at build time turns it off).

To connect a screen to the backend:

1. Build the endpoints in FastAPI with the shapes in `contracts.ts`, with RLS, permissions, audit and tests.
2. Run `npm run api:generate` in `frontend/`.
3. In `core/api/platform-api.ts`, switch that screen's methods from `api.call(...)` to the typed `api.get/post(...)`.
4. Delete its routes in `core/api/mock/mock-routes.ts`. The screen components do not change.

`GET /auth/me` is real: the mock adds the permissions of the screens it still serves (`core/api/mock/session-mock.ts`). Remove a screen's permissions there when its backend adds them to `app/core/permissions.py`.

Fixtures come from `reference-docs-teams/datapoints-epr-ppwr-main/src`; regenerate them with `node scripts/make-mock-fixtures.js` in `frontend/`.

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
