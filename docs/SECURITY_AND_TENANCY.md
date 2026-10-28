# Security and Multi-Tenancy

## Roles
- Platform admin: platform configuration; client-data access separately authorised and audited.
- Monkspaces consultant: assigned client workspaces only.
- Client admin: tenant users/settings.
- Client contributor: permitted uploads/edits.
- Client reviewer: review/approval within scope.

## Controls
- Authenticate requests and authorise every tenant-scoped backend operation.
- Never rely on frontend filtering for isolation.
- Consider PostgreSQL Row-Level Security as defence in depth.
- Private object storage; check tenant access before file access/export.
- Scope background jobs, caches, search, logs and reports to tenant context.
- Audit privileged access and sensitive changes.
- Keep secrets out of source control and logs.
- Test cross-tenant API, search, export, file and job access.
- Define backup/restore, retention, deletion, incident response and residency before production.

Do not use real client data until tenant-boundary tests and a security review pass.
