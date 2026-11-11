/**
 * Screen 1 (secure sign-in) is real: `GET /api/v1/auth/me` comes from the backend. The
 * backend only knows the permissions of the screens it has built, so while screens 2-8
 * are served by the mock API, the mock adds theirs to the real answer. Delete a screen's
 * permissions here when its backend (and its entries in `app/core/permissions.py`) ships.
 */

// platform.tenants.* come from the backend since screen 2 shipped.
export const PLATFORM_PERMISSIONS = ['platform.datapoints.read', 'platform.rules.manage'];
export const TENANT_PERMISSIONS = ['workspace.read', 'products.read', 'products.manage', 'imports.manage', 'gaps.read', 'gaps.resolve', 'data.read', 'jobs.read'];

interface MeLike {
  user: { is_platform_admin: boolean };
  active_tenant: unknown;
  permissions: string[];
}

/** Adds the mocked screens' permissions. Platform admins also work in the demo data. */
export function withMockPermissions<T extends MeLike>(me: T): T {
  const extra = me.user.is_platform_admin
    ? [...PLATFORM_PERMISSIONS, ...TENANT_PERMISSIONS]
    : me.active_tenant
      ? TENANT_PERMISSIONS
      : [];
  return { ...me, permissions: [...new Set([...me.permissions, ...extra])].sort() };
}
