import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';

export type UserRole = 'superadmin' | 'org_admin' | 'analyst' | 'viewer' | 'supplier_contact';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  organisationId?: string | null;
  organisationSlug?: string | null;
  organisationName?: string | null;
  avatarInitials: string;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in_seconds: number;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    organisation_id?: string | null;
    organisation_slug?: string | null;
    organisation_name?: string | null;
    avatar_initials: string;
  };
  redirect_url: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;
  private readonly TOKEN_KEY = 'compliance_hub_jwt_token';
  private readonly USER_KEY = 'compliance_hub_auth_user';

  private readonly _currentUser = signal<AuthUser | null>(this.getInitialUser());
  private readonly _isAuthenticating = signal<boolean>(false);

  readonly currentUser = this._currentUser.asReadonly();
  readonly isAuthenticated = computed(() => this._currentUser() !== null);
  readonly isAuthenticating = this._isAuthenticating.asReadonly();
  readonly isSuperAdmin = computed(() => this._currentUser()?.role === 'superadmin');
  readonly currentOrgSlug = computed(() => this._currentUser()?.organisationSlug ?? '');

  private getInitialUser(): AuthUser | null {
    try {
      const raw = localStorage.getItem(this.USER_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // Ignore parse errors
    }
    return null;
  }

  getToken(): string | null {
    try {
      return localStorage.getItem(this.TOKEN_KEY);
    } catch {
      return null;
    }
  }

  /**
   * Direct corporate sign-in via backend JWT authentication.
   * Returns: 'superadmin' | 'client' | null (on failure)
   */
  async login(email: string, password: string): Promise<'superadmin' | 'client' | null> {
    this._isAuthenticating.set(true);
    try {
      const payload = { email: email.trim(), password, remember_me: true };
      const res = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.baseUrl}/api/v1/auth/sign-in`, payload)
      );

      const authUser: AuthUser = {
        id: res.user.id,
        email: res.user.email,
        fullName: res.user.full_name,
        role: res.user.role,
        organisationId: res.user.organisation_id,
        organisationSlug: res.user.organisation_slug,
        organisationName: res.user.organisation_name,
        avatarInitials: res.user.avatar_initials || 'U',
      };

      try {
        localStorage.setItem(this.TOKEN_KEY, res.access_token);
        localStorage.setItem(this.USER_KEY, JSON.stringify(authUser));
      } catch {
        // LocalStorage sandbox fallback
      }

      this._currentUser.set(authUser);
      this._isAuthenticating.set(false);

      return authUser.role === 'superadmin' ? 'superadmin' : 'client';
    } catch (err: any) {
      this._isAuthenticating.set(false);
      return null;
    }
  }

  logout(): void {
    try {
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    } catch {
      // Ignore
    }
    this._currentUser.set(null);
  }
}
