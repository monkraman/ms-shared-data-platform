import { db } from './mock-db';

/**
 * Until screen 1 (secure sign-in) ships, the prototype sign-in issues the session. This
 * mock answers `GET /api/v1/auth/me` from that signed-in user so the platform shell knows
 * who is working and what they may see. Platform admins work inside the first workspace.
 */

interface LegacyUser {
  email: string;
  fullName: string;
  role: string;
  organisationSlug?: string | null;
}

export const PLATFORM_PERMISSIONS = ['platform.tenants.read', 'platform.tenants.manage', 'platform.datapoints.read', 'platform.rules.manage'];
export const TENANT_PERMISSIONS = ['workspace.read', 'products.read', 'products.manage', 'imports.manage', 'gaps.read', 'gaps.resolve', 'data.read', 'jobs.read'];

function legacyUser(): LegacyUser | null {
  try {
    const raw = localStorage.getItem('compliance_hub_auth_user');
    return raw ? (JSON.parse(raw) as LegacyUser) : null;
  } catch {
    return null;
  }
}

export function mockMe() {
  const user = legacyUser();
  if (!user) return null;
  const isAdmin = user.role === 'superadmin';
  const workspaces = db().workspaces;
  const ws = isAdmin ? workspaces[0] : (workspaces.find((w) => w.slug === user.organisationSlug) ?? workspaces[0]);
  const tenant = { id: ws.id, slug: ws.slug, name: ws.name, status: ws.status };
  return {
    user: { id: user.email, email: user.email, full_name: user.fullName, is_platform_admin: isAdmin },
    active_tenant: tenant,
    permissions: isAdmin ? [...PLATFORM_PERMISSIONS, ...TENANT_PERMISSIONS] : TENANT_PERMISSIONS,
    memberships: isAdmin ? [] : [{ tenant, role: user.role }],
  };
}

