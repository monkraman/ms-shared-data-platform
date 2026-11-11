# Foundation guide (Step 0)

How every new screen uses the foundation. The prototype (`app/services/store.py` and the old `/api/v1` routes) stays as it is until each screen replaces it; new code never imports `store.py`.

## Run it

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head            # needs DATABASE_URL
python -m app.seed demo         # demo tenants and users; prints a password once (or set SEED_PASSWORD)
uvicorn app.main:app --reload
```

Tests: `python -m pytest`. Database tests need `TEST_DATABASE_URL` (a Postgres URL whose user may create roles and databases); without it they are skipped locally. CI always runs them.

## Adding a tenant table (every screen)

1. Model in the domain package (for example `app/data/products/models.py`), with `tenant_id: Mapped[uuid.UUID]`, and import it in `app/models.py`.
2. `alembic revision --autogenerate -m "screen 4 products"`, review the file, then add `enable_tenant_rls(op, "products")` after `create_table`.
3. Endpoints take `Depends(require_permission(Perm.X))` first and `session: TenantDB` after it (FastAPI resolves them in order, so the permission check runs first). Never filter by tenant by hand and never take a tenant from the request: RLS does the filtering, and the tenant comes from the token.
4. Changes call `record_audit(session, principal=..., action=..., before=..., after=...)` in the same transaction.
5. Add the screen's permissions to `app/core/permissions.py` and the roles that get them.
6. Add a tenant-isolation test: data created in tenant A is invisible (404) to tenant B's user.

## Pieces

| Need | Use |
| --- | --- |
| Who is calling | `require_permission(...)` returns a `Principal` (user, tenant, permissions) |
| Database | `TenantDB` (one tenant), `PlatformDB` (platform admins, all tenants) |
| Errors | `raise ProblemError(404, "Product not found.")` returns RFC 9457 problem details |
| Long work | `@job_handler("kind")`, then `await enqueue(session, principal, "kind", payload)` and return 202 with the job ID; UI polls `GET /api/v1/jobs/{id}` |
| Audit | `record_audit(...)` |
| Seed data | JSON in `seeds/demo/`, loaded by `app/seed.py` through repositories |

## Frontend

Platform screens live under `/app` in the new shell (`features/shell`); prototype pages keep their old layout until their screen is rebuilt.

| Need | Use |
| --- | --- |
| Call the API | `inject(ApiClient).get('/api/v1/...', { path, query, body })`, typed from `core/api/schema.ts` |
| After backend changes | `npm run api:generate` (CI fails if the committed client is out of date) |
| Errors | `toProblem(err)` → `detail` for the page, `fields[name]` next to form fields |
| Who is signed in | `inject(SessionService)`: `me()`, `can('perm')`, `workspaceName()` |
| Navigation | Add an entry to `core/navigation/nav-items.ts` with its permission |
| Route access | `canActivate: [permissionGuard], data: { permission: '...' }` under the `/app` route |
| UI pieces | `shared/ui`: page header, data table, form field, status chip, empty state, error state, toast outlet; buttons are `btn btn-primary|btn-secondary|btn-ghost` |

401 sends the user to sign in (and back afterwards); a 403 on a page load shows the no-permission page. The platform interceptor never sends a tenant: the workspace comes from the token.

Design rules: labels and data only, with no taglines, helper text or secondary labels. If a screen needs them to make sense, change the layout. Use one primary action per view, and existing tokens from `styles.css`.

## Security notes

- Every transaction runs `SET LOCAL ROLE compliance_rls` (migration 0002), a role that cannot bypass RLS, so isolation holds even though Neon's login role has BYPASSRLS. The migration user needs CREATEROLE. Never connect as a Postgres superuser: a superuser can switch roles freely and skips RLS anyway.
- Access tokens from the new auth (`ver: 2`) last 15 minutes. Prototype tokens are refused by new endpoints.
- `app.platform_access` is set only by `PlatformDB` after checking the user is a platform admin.

## Deploys

`main` deploys automatically to Render (API) and Vercel (frontend). Render runs `alembic upgrade head` before starting; if a migration fails, the deploy fails and the previous version keeps serving. Jobs run in the API process until `REDIS_URL` is set and a Celery worker (`celery -A app.worker worker`) is added.
