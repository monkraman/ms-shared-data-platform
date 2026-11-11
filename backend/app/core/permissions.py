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
    PLATFORM_USERS_MANAGE = "platform.users.manage"
    PLATFORM_DATAPOINTS_READ = "platform.datapoints.read"  # screen 3
    PLATFORM_RULES_MANAGE = "platform.rules.manage"  # screen 6

    # Tenant permissions
    WORKSPACE_READ = "workspace.read"
    JOBS_READ = "jobs.read"
    AUDIT_READ = "audit.read"
    USERS_MANAGE = "users.manage"
    PRODUCTS_READ = "products.read"  # screen 4
    PRODUCTS_MANAGE = "products.manage"
    IMPORTS_MANAGE = "imports.manage"  # screen 5
    GAPS_READ = "gaps.read"  # screen 7
    GAPS_RESOLVE = "gaps.resolve"
    DATA_READ = "data.read"  # screen 8
    COMPLIANCE_READ = "compliance.read"  # screen 12: EPR results, PPWR declarations
    ACTIONS_MANAGE = "actions.manage"  # screen 14: action items from recommendations


PLATFORM_ADMIN_PERMISSIONS: frozenset[str] = frozenset(
    {
        Perm.PLATFORM_TENANTS_READ,
        Perm.PLATFORM_TENANTS_MANAGE,
        Perm.PLATFORM_AUDIT_READ,
        Perm.PLATFORM_USERS_MANAGE,
        Perm.PLATFORM_DATAPOINTS_READ,
        Perm.PLATFORM_RULES_MANAGE,
    }
)

_READ = {Perm.WORKSPACE_READ, Perm.PRODUCTS_READ, Perm.GAPS_READ, Perm.DATA_READ, Perm.COMPLIANCE_READ}
_WORK = _READ | {Perm.JOBS_READ, Perm.PRODUCTS_MANAGE, Perm.IMPORTS_MANAGE, Perm.GAPS_RESOLVE, Perm.ACTIONS_MANAGE}

TENANT_ROLE_PERMISSIONS: dict[TenantRole, frozenset[str]] = {
    TenantRole.ORG_ADMIN: frozenset(_WORK | {Perm.AUDIT_READ, Perm.USERS_MANAGE}),
    TenantRole.ANALYST: frozenset(_WORK),
    TenantRole.VIEWER: frozenset(_READ),
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
