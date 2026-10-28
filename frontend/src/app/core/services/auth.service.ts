import { Injectable, signal, computed } from '@angular/core';

export type UserRole = 'superadmin' | 'org_admin' | 'analyst' | 'viewer' | 'supplier_contact';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organisationId: string;
  organisationSlug: string;
  organisationName: string;
  avatarInitials: string;
}

/**
 * AuthService — Single Source of Truth for authentication state.
 * In production this would validate JWT tokens from the backend.
 * For prototype: mock users are used to demonstrate role-based routing.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // Mock user database — replaces real JWT validation in production
  private readonly MOCK_USERS: Record<string, AuthUser> = {
    'superadmin@monkspaces.com': {
      id: 'usr-sa-001',
      email: 'superadmin@monkspaces.com',
      fullName: 'Platform Admin',
      role: 'superadmin',
      organisationId: 'monkspaces-internal',
      organisationSlug: 'monkspaces',
      organisationName: 'Monkspaces Ltd',
      avatarInitials: 'SA',
    },
    'compliance.officer@kraftheinz.com': {
      id: 'usr-khc-001',
      email: 'compliance.officer@kraftheinz.com',
      fullName: 'Sarah Mitchell',
      role: 'org_admin',
      organisationId: 'khc-europe',
      organisationSlug: 'khc-europe',
      organisationName: 'Kraft Heinz Europe',
      avatarInitials: 'SM',
    },
    'analyst@kraftheinz.com': {
      id: 'usr-khc-002',
      email: 'analyst@kraftheinz.com',
      fullName: 'James Patel',
      role: 'analyst',
      organisationId: 'khc-europe',
      organisationSlug: 'khc-europe',
      organisationName: 'Kraft Heinz Europe',
      avatarInitials: 'JP',
    },
    'admin@aurora-pack.com': {
      id: 'usr-aur-001',
      email: 'admin@aurora-pack.com',
      fullName: 'Elena Rossi',
      role: 'org_admin',
      organisationId: 'aurora-pack',
      organisationSlug: 'aurora-pack',
      organisationName: 'Aurora Packaging Group',
      avatarInitials: 'ER',
    },
  };

  private readonly _currentUser = signal<AuthUser | null>(null);
  private readonly _isAuthenticating = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAuthenticating = this._isAuthenticating.asReadonly();
  readonly isSuperAdmin = computed(() => this._currentUser()?.role === 'superadmin');
  readonly currentOrgSlug = computed(() => this._currentUser()?.organisationSlug ?? '');

  /**
   * Authenticate with email + password.
   * Returns: 'superadmin' | 'client' | null (on failure)
   */
  login(email: string, _password: string): Promise<'superadmin' | 'client' | null> {
    this._isAuthenticating.set(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        const user = this.MOCK_USERS[email.toLowerCase()];
        if (user) {
          this._currentUser.set(user);
          this._isAuthenticating.set(false);
          resolve(user.role === 'superadmin' ? 'superadmin' : 'client');
        } else {
          // Default: treat unknown email as a KHC analyst for demo
          const fallbackUser: AuthUser = {
            id: 'usr-demo-001',
            email,
            fullName: email.split('@')[0],
            role: 'analyst',
            organisationId: 'khc-europe',
            organisationSlug: 'khc-europe',
            organisationName: 'Kraft Heinz Europe',
            avatarInitials: email.substring(0, 2).toUpperCase(),
          };
          this._currentUser.set(fallbackUser);
          this._isAuthenticating.set(false);
          resolve('client');
        }
      }, 600);
    });
  }

  loginWithSso(provider: string, orgSlug: string): Promise<'superadmin' | 'client'> {
    this._isAuthenticating.set(true);
    return new Promise((resolve) => {
      setTimeout(() => {
        // SSO always lands as org_admin for the demo
        const ssoUser: AuthUser = {
          id: 'usr-sso-001',
          email: `sso-user@${orgSlug}.com`,
          fullName: `SSO User (${provider})`,
          role: 'org_admin',
          organisationId: orgSlug,
          organisationSlug: orgSlug,
          organisationName: orgSlug === 'khc-europe' ? 'Kraft Heinz Europe' : 'Aurora Packaging',
          avatarInitials: 'SU',
        };
        this._currentUser.set(ssoUser);
        this._isAuthenticating.set(false);
        resolve('client');
      }, 700);
    });
  }

  logout(): void {
    this._currentUser.set(null);
  }
}

