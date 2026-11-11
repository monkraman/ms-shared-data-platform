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
3. Endpoints take `session: TenantDB` and `Depends(require_permission(Perm.X))`. Never filter by tenant by hand and never take a tenant from the request: RLS does the filtering, and the tenant comes from the token.
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

## Security notes

- The app must connect as a Postgres role that is not a superuser and has no BYPASSRLS; otherwise RLS is silently skipped. Neon's default owner role qualifies.
- Access tokens from the new auth (`ver: 2`) last 15 minutes. Prototype tokens are refused by new endpoints.
- `app.platform_access` is set only by `PlatformDB` after checking the user is a platform admin.

## Deploys

`main` deploys automatically to Render (API) and Vercel (frontend). Render runs `alembic upgrade head` before starting; if a migration fails, the deploy fails and the previous version keeps serving. Jobs run in the API process until `REDIS_URL` is set and a Celery worker (`celery -A app.worker worker`) is added.
