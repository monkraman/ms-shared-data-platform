"""Named permissions and the roles that grant them.

Endpoints never check roles directly; they ask for a permission with
``require_permission("...")``. Each screen adds the permissions it needs here
(modules will register their own, for example ``epr.filing.submit``).
"""

from __future__ import annotations

from app.platform.models import TenantRole


class Perm:
    # Platform-wide (SuperAdmin) permissions
    PLATFORM_TENANTS_READ = "platform.tenants.read"
    PLATFORM_TENANTS_MANAGE = "platform.tenants.manage"
    PLATFORM_AUDIT_READ = "platform.audit.read"

    # Tenant permissions
    WORKSPACE_READ = "workspace.read"
    JOBS_READ = "jobs.read"
    AUDIT_READ = "audit.read"
    USERS_MANAGE = "users.manage"


PLATFORM_ADMIN_PERMISSIONS: frozenset[str] = frozenset(
    {Perm.PLATFORM_TENANTS_READ, Perm.PLATFORM_TENANTS_MANAGE, Perm.PLATFORM_AUDIT_READ}
)

TENANT_ROLE_PERMISSIONS: dict[TenantRole, frozenset[str]] = {
    TenantRole.ORG_ADMIN: frozenset({Perm.WORKSPACE_READ, Perm.JOBS_READ, Perm.AUDIT_READ, Perm.USERS_MANAGE}),
    TenantRole.ANALYST: frozenset({Perm.WORKSPACE_READ, Perm.JOBS_READ}),
    TenantRole.VIEWER: frozenset({Perm.WORKSPACE_READ}),
}

ALL_TENANT_PERMISSIONS: frozenset[str] = frozenset().union(*TENANT_ROLE_PERMISSIONS.values())


def permissions_for(*, is_platform_admin: bool, tenant_role: TenantRole | None, has_tenant: bool) -> frozenset[str]:
    perms: set[str] = set()
    if is_platform_admin:
        perms |= PLATFORM_ADMIN_PERMISSIONS
        if has_tenant:
            # A platform admin working inside a workspace may do what its org admin can.
            perms |= ALL_TENANT_PERMISSIONS
    if tenant_role is not None:
        perms |= TENANT_ROLE_PERMISSIONS.get(tenant_role, frozenset())
    return frozenset(perms)
