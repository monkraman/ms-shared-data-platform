import { PLATFORM_PERMISSIONS, TENANT_PERMISSIONS, withMockPermissions } from './session-mock';

describe('withMockPermissions', () => {
  const me = (admin: boolean, tenant: unknown, permissions: string[] = ['workspace.read']) => ({
    user: { is_platform_admin: admin },
    active_tenant: tenant,
    permissions,
  });

  it('adds the mocked screens’ permissions to a workspace user', () => {
    const out = withMockPermissions(me(false, { id: 't1' }));
    expect(out.permissions).toEqual([...new Set(['workspace.read', ...TENANT_PERMISSIONS])].sort());
    expect(out.permissions.some((p) => p.startsWith('platform.'))).toBe(false);
  });

  it('adds nothing for a user without a workspace', () => {
    expect(withMockPermissions(me(false, null)).permissions).toEqual(['workspace.read']);
  });

  it('gives platform admins the platform screens and the demo data', () => {
    const out = withMockPermissions(me(true, null, ['platform.audit.read']));
    for (const p of [...PLATFORM_PERMISSIONS, ...TENANT_PERMISSIONS]) expect(out.permissions).toContain(p);
    expect(out.permissions).toContain('platform.audit.read');
  });
});
