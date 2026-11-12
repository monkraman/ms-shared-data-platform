# Compliance Hub — Screen-by-Screen Build Plan

Nov 11, 2026 · Owner: Raman

> Source of truth while editing: the Claude doc "Compliance Hub — Screen-by-Screen Build Plan". This Markdown copy is kept in the repo for reference; update the Status column here as screens move forward.
> Companion doc: [TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md](TARGET_ARCHITECTURE_AND_IMPROVEMENT_PLAN.md).

## Approach

We build one screen at a time, fully finished in backend and frontend, in the order the data flows. Before screen 1 there is a short foundation step (about 1–2 weeks); skipping it would mean every screen is built on the old in-memory store and rebuilt later.

Each screen is a **vertical slice**: database tables, API, permissions, UI, tests and audit logging, all done together. We do not start the next screen until the current one passes the definition of done. The companion doc, *Compliance Hub — Target Architecture & Improvement Plan*, explains the design behind these choices.

> **Build status (11 Nov 2026):** screens 1–8 run on the backend and are live (no mock API any more); data sources (part of 18) are on branch `screen/18-data-sources`. Postponed improvements: [IMPROVEMENTS.md](IMPROVEMENTS.md).

## Rules that prevent rework

1. **Foundation first, once.** Database, migrations, login, tenant isolation and the generated API client exist before any screen. No screen talks to `store.py`.
2. **Build in data-flow order.** A screen is built only after the screens that create its data. Products come before imports, imports before gaps, gaps before module results.
3. **API contract before code.** For each screen we agree the endpoints and payloads first, in OpenAPI. Frontend and backend then build against the same contract.
4. **No mock data in finished screens.** Demo data comes from seed fixtures loaded through the real API, never hard-coded in components.
5. **Reuse the UI, replace the plumbing.** Current Angular layouts and styles are kept where they fit; their services are rewired to the generated client.
6. **Shared pieces are built once, when first needed.** Tables, forms, file upload, status chips and empty states go into a shared component library the first time a screen needs them.
7. **A finished screen is frozen.** Later changes to it go through a small ticket, not a rewrite. If we discover a design flaw, we fix it in the foundation, then update affected screens together.
8. **The old demo stays available.** It lives on a `demo` branch until the new screens replace it.

## Screen order

There are 22 screens after the foundation step; the first 14 make the platform pilot-ready for one client on EPR. Sizes assume one backend and one frontend developer working on the same screen: S is about 2–3 days, M about 1 week, L about 2 weeks. At that pace screens 0–14 take roughly 5 months.

Status values: Not started · Spec agreed · In build · In review · Done.

| # | Screen | Role | Needs | Reuse from today | Size | Status |
| --- | --- | --- | --- | --- | --- | --- |
| 0 | Foundation (not a screen) | Both | — | Schema drafts, test suite | L | In review (sign-in lands with screen 1; EU staging open) |
| 1 | Sign-in and session | Both | 0 | Sign-in layout and styles | M | In review (Playwright test, staging demo and sign-off open) |
| 2 | Client workspaces and setup wizard | SuperAdmin | 1 | Workspace cards, onboarding steps 1–2, theme engine | L | In review (backend built; invitation emails wait for the email service) |
| 3 | Data point dictionary | SuperAdmin | 2 | Data points page, `REGULATORY_DATA_DICTIONARY_SPEC.csv` | M | In review (backend live; Data explorer shows the team's explorer; Playwright test and sign-off open) |
| 4 | Products and packaging (list, detail, BOM tree, manual entry) | Org Admin | 3 | SKU table, manual SKU modal, packaging BOM form | L | In review (editing, lineage, history and validation added) |
| 5 | Import: upload, map, review, approve | Org Admin | 4 | CSV dropzone, bulk import modal | L | In review (backend live; Playwright test and sign-off open) |
| 6 | Gap rule library | SuperAdmin | 3 | Rule library page | M | In review (backend live; Playwright test and sign-off open) |
| 7 | Gap worklist and gap fix | Org Admin | 5, 6 | Quality worklist, vendor declaration, worklist export | L | In review (backend live; estimable vs needs-data gaps and Fill estimates added) |
| 8 | Data overview | Org Admin | 7 | Data point map | M | In review (backend live; Playwright test and sign-off open) |
| 9 | Users and access, and Team | Both | 1 | IAM directory | M | In review (users, consultants, roles, disable, temporary passwords, team; emails wait for the email service) |
| 10 | Organisation settings (legal entities, countries, source priority) | Org Admin | 2 | Onboarding markets step | S | Not started |
| 11 | Tariffs and rule packs | SuperAdmin | 3 | Tariff library, seeded tariffs | M | Not started |
| 12 | EPR results: runs, explanations, simulator (module SDK built here) | Org Admin | 7, 10, 11 | Simulator page, EPR engine | L | In build (EPR UK, Denmark and SB 54 fees, hotspots, recommendations, scenarios and action items on real data) |
| 13 | Sign-off and exports (Defra RPD CSV first) | Org Admin | 12 | Board pack export | M | In build (PPWR Denmark declaration in Danish and English, print to PDF; RPD CSV next) |
| 14 | Dashboard | Org Admin | 7, 12 | Dashboard KPI layout | M | Not started |
| 15 | Audit log | SuperAdmin | 1 | — | S | Not started |
| 16 | Ingestion monitor | SuperAdmin | 5 | Batches page | S | Not started |
| 17 | Module registry and entitlements | SuperAdmin | 12 | Module toggles | S | In build (workspace modules gate screens and APIs as module.<id> permissions) |
| 18 | Data sources: API keys and connectors | Org Admin | 5 | Sync endpoints, mock ERP/PLM service | L | In build (connect, saved mapping, auto-approve and history done on simulated systems; schedules and real connectors next) |
| 19 | PPWR results | Org Admin | 12 | PPWR service | M | Not started |
| 20 | DPP results and public passport | Org Admin | 19 | DPP service | M | Not started |
| 21 | LCA results | Org Admin | 12 | ISO 14067 engine | M | Not started |

The dashboard comes late on purpose: it summarises the other screens, so building it early means rebuilding it. Until then, the current dashboard stays on the demo branch. Screen 22, support mode, follows the audit log once real clients are live.

## Definition of done

A screen is done only when every item below is true; a screen that looks finished but fails one of them is still "In review". Copy this list into each screen's pull request.

**Backend**

- Tables created through an Alembic migration, with `tenant_id` and Row-Level Security on tenant data.
- Endpoints documented in OpenAPI, with request and response schemas and examples.
- Every endpoint checks login and a named permission; none falls back to a default tenant.
- Data changes write audit events (who, what, before, after).
- Long work (imports, calculations, exports) runs as a background job with status.

**Frontend**

- Uses the generated API client; no hand-written HTTP calls, no hard-coded data.
- Has loading, empty, error and no-permission states.
- Validation messages match the backend's rules and show next to the field.
- Works at 1280 px and on a tablet; keyboard usable; passes an automated accessibility check.
- Shared parts (tables, forms, upload, chips) live in the shared component library.

**Tests**

- Backend unit tests for the logic and API tests for every endpoint.
- A tenant-isolation test: a user of tenant A gets nothing from tenant B on every new endpoint.
- Frontend component tests for the main interactions.
- One Playwright end-to-end test of the screen's main journey.
- CI is green.

**Sign-off**

- Demo seed data updated so the screen shows real-looking content.
- Deployed to staging and shown in a short demo.
- Product owner accepts it against the screen spec's acceptance criteria.
- Status in the screen order table set to Done.

## Step 0: foundation slice

Step 0 builds the plumbing every screen reuses, so no screen has to invent its own database access, login check or API call pattern. It takes about 1–2 weeks and ends with an empty but secure app that a user can sign in to.

### Backend

- [x] Remove secrets from code; settings read only from environment variables. *(Neon password rotation still to do in the Neon console.)*
- [x] New folder layout (`core`, `platform`, `data`, `ingestion`, `quality`, `modules`); `store.py` is no longer imported by new code. *(`app/data` is still the prototype's JSON folder; the shared data core moves in with screen 4.)*
- [x] SQLAlchemy 2.0 async session and Alembic, with a first migration for tenants, users and memberships.
- [x] Tenant context per request and Row-Level Security helper, so every new table gets isolation by default.
- [x] One `require_permission("...")` dependency used on every endpoint.
- [x] Audit event helper and `audit_events` table.
- [x] Background job runner skeleton (Celery + Redis) with a job status endpoint.
- [x] Seed command (`python -m app.seed demo`) that loads demo data through repositories, not code constants.
- [x] Standard error format (problem details) and request ID on every log line.

### Frontend

- [x] Generated TypeScript API client from OpenAPI, regenerated in CI.
- [x] App shell: layout, sidebar built from the user's permissions, tenant name from the API. *(Branding arrives with screen 2.)*
- [x] Auth interceptor reads the token only; the tenant comes from the token, and the API-URL override is removed. *(The legacy interceptor still serves prototype pages until each screen moves over.)*
- [x] Shared component library started: page header, data table, form field, status chip, empty state, error state, toast.
- [x] Global error handling: 401 goes to sign-in, 403 shows a no-permission page.

### Delivery

- [x] Docker Compose for API, worker, Postgres, Redis and object storage.
- [x] GitHub Actions: lint, type check, backend and frontend tests, secret scan, build, API contract check.
- [ ] Staging environment in an EU region, deployed from `main`.
- [x] Current app tagged (`demo-2026-11-11`) and kept on a `demo` branch.

See [FOUNDATION_GUIDE.md](FOUNDATION_GUIDE.md) for how screens use the foundation.

**Exit criteria:** CI green; staging runs the new stack; a seeded SuperAdmin can sign in and sees an empty shell; a test proves a user of tenant A cannot read tenant B.

## Screen specs: the first two

Screens 1 and 2 are specified in full so building can start right after Step 0; later screens get the same treatment one at a time, using the template below.

### Screen 1: Sign-in and session

**Purpose.** Let SuperAdmins and Org Admins sign in securely and land in the right place with the right tenant.

**User stories**

- As any user, I sign in with my work email and land on my home screen (SuperAdmin → Client workspaces; Org Admin → Products until the dashboard exists).
- As a user with access to several workspaces, I pick the workspace after sign-in and can switch later.
- As a user, I am signed out after inactivity and told why; I can sign out myself.
- As an Org Admin, I can never see or switch to another client's workspace.

**How login works.** Recommended: the chosen OIDC provider hosts the login page (password, MFA, later SSO); our screen handles the redirect, callback and session. If the provider is not chosen in time, we ship email and password with Argon2 hashing behind the same `AuthProvider` interface, so switching later changes the backend adapter, not the screen.

**API**

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/auth/me` | Profile, memberships, active tenant, permissions |
| `POST /api/v1/auth/switch-tenant` | Issue a token for another tenant the user belongs to |
| `POST /api/v1/auth/sign-out` | Revoke the refresh token |
| `POST /api/v1/auth/login`, `/password-reset` | Interim local login only |

**Screens and states.** Sign-in page (reuse current layout), workspace picker, session-expired dialog, no-permission page, sign-out.

**Rules.** Access token 15 minutes, refresh token 8 hours; 5 failed attempts lock the account for 15 minutes (local login); every sign-in, failure and switch is audited.

**Acceptance criteria**

- Seeded SuperAdmin and Org Admin each land on their home screen.
- An Org Admin calling any endpoint with another tenant's ID gets 403, and the UI offers no way to try.
- An expired session returns the user to sign-in and back to the page they were on afterwards.
- No token or tenant ID can be changed through `localStorage` to reach other data.

**Out of scope.** SSO federation and SCIM (Phase 3), self-service sign-up.

### Screen 2: Client workspaces and setup wizard

**Purpose.** Let the SuperAdmin create and manage client workspaces, including which countries and modules each client has.

**User stories**

- As a SuperAdmin, I see all workspaces with status, countries, modules, user count and last activity, and can search and filter them.
- As a SuperAdmin, I create a workspace in four steps: organisation and branding; legal entities; countries and modules; first Org Admin invite.
- As a SuperAdmin, I edit a workspace, change its modules or countries, and suspend or reactivate it.
- As an invited Org Admin, I receive an email, set up my login and arrive in my empty workspace.

**Data.** Tables `tenants`, `legal_entities`, `tenant_module_subscriptions` (module, countries, valid from/to), `tenant_branding`, `invitations`. Logos stored in object storage.

**API**

| Endpoint | Purpose |
| --- | --- |
| `GET /api/v1/admin/tenants`, `POST` | List with filters; create |
| `GET /api/v1/admin/tenants/{id}`, `PATCH` | Detail; edit name, sector, branding, status |
| `PUT /api/v1/admin/tenants/{id}/legal-entities` | Add or edit legal entities |
| `PUT /api/v1/admin/tenants/{id}/subscriptions` | Set modules and countries |
| `POST /api/v1/admin/tenants/{id}/invitations` | Invite a user by email |
| `GET /api/v1/reference/countries`, `/reference/modules` | Options for the wizard |

**Rules.** Workspace slug is unique; at least one legal entity, one country and one module before activation; no modules are switched on by default; invitations expire after 7 days; passwords are never shown on screen (the current cards that display provisioned credentials are removed); every change is audited.

**Acceptance criteria**

- A SuperAdmin creates a workspace end to end, and the invited Org Admin signs in to it.
- The workspace's countries and modules drive which regulations the wizard shows (reuses today's step-2 logic).
- Suspending a workspace blocks its users at the next request.
- Branding (logo, colours) shows in the client's app shell.

**Reuse.** Workspace card layout, wizard steps 1–2, theme engine. Today's step 3 (data journey flowchart) and step 4 (connect systems) move to the Data sources screen (18).

**As built (Nov 2026).** Countries and modules are columns on `tenants` (not a separate subscriptions table yet); logos are an https link or an uploaded image under 300 KB stored with the workspace until object storage exists; the first org admin is added as an invited user, and the invitation email follows once the email service is chosen. Prototype workspaces in Neon's `platform.tenants` are copied by migration 0004.

**Out of scope.** Billing and plans, bulk workspace import.

## Spec template for later screens

Each later screen gets a one-page spec in this shape before any code is written; agreeing it moves the screen to "Spec agreed".

```markdown
### Screen N: <name>

**Purpose.** One sentence: who uses it and what they get done.

**User stories.** 3–6 "As a <role>, I …" lines.

**Data.** Tables and data points it reads and writes; new migrations.

**API.** Table of endpoints and their purpose; permissions needed.

**Screens and states.** Main view, detail, dialogs; loading, empty, error, no permission.

**Rules.** Validation, limits, who may do what, what is audited.

**Acceptance criteria.** 3–6 testable statements; these become the end-to-end test.

**Reuse.** What is kept from today's UI and code.

**Out of scope.** What is deliberately left for later, and which screen picks it up.
```

## Working rhythm

Every screen goes through the same six steps, usually in one to two weeks, and only one screen is in build at a time.

1. **Spec (half a day).** Fill the template; agree it with the product owner. Status: Spec agreed.
2. **API contract (half a day).** Write the endpoints and schemas in FastAPI with stub responses; generate the TypeScript client. Frontend can start now.
3. **Build (most of the time).** Backend and frontend in parallel on one branch, `screen/NN-name`. Status: In build.
4. **Test.** Unit, API, isolation, component and end-to-end tests from the acceptance criteria.
5. **Review and demo.** Pull request with the definition-of-done checklist; deploy to staging; 15-minute demo. Status: In review.
6. **Accept and freeze.** Merge to `main`, update the demo seed, set status to Done.

A short weekly check-in covers the screen in build, the next spec, and any foundation changes the screen revealed. Bugs found in finished screens get small tickets and are fixed between screens, not by reopening the screen.

## Decisions needed before we start

These four choices affect Step 0 and Screen 1; deciding them now avoids building something twice.

- [x] **Login provider:** interim local login (Argon2) shipped with Screen 1; an OIDC provider can replace it later behind the same endpoints. Needed before Screen 1.
- [ ] **Hosting for staging and production:** stay on Render and Neon for now (moving to an EU region), or move to AWS or Azure now. Needed during Step 0.
- [ ] **Email service for invitations:** for example Amazon SES or Postmark. Needed before Screen 2.
- [ ] **Who builds:** confirm whether one person builds both backend and frontend with AI help, or a pair. This changes the timeline, not the order.
