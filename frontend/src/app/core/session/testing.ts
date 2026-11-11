import type { Me, SignInResponse } from './session.service';

/** Test fixtures for the session (used by specs only). */

export const signInResponse = (role = 'org_admin', token = 'access-1'): SignInResponse => ({
  access_token: token,
  token_type: 'bearer',
  expires_in_seconds: 900,
  redirect_url: '/dashboard',
  requires_mfa: false,
  user: {
    id: 'u1',
    email: 'ana@acme.test',
    full_name: 'Ana Lima',
    role: role as SignInResponse['user']['role'],
    organisation_id: 'acme',
    organisation_slug: 'acme',
    organisation_name: 'Acme Foods',
    avatar_initials: 'AL',
    mfa_enabled: false,
  },
});

export const meWith = (memberships: Me['memberships'] = [], admin = false): Me => ({
  user: { id: 'u1', email: 'ana@acme.test', full_name: 'Ana Lima', is_platform_admin: admin },
  active_tenant: memberships[0]?.tenant ?? null,
  permissions: ['workspace.read'],
  memberships,
});

export const membership = (id: string, name: string): Me['memberships'][number] => ({
  tenant: { id, slug: id, name, status: 'active' },
  role: 'org_admin',
});
