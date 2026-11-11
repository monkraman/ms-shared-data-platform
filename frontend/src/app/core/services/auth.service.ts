import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { APP_CONFIG } from '../config/client-theme.config';
import { Profile, SessionService } from '../session/session.service';

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

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  organisation_id?: string | null;
  organisation_slug?: string | null;
  organisation_name?: string | null;
  avatar_initials?: string | null;
}

/**
 * The signed-in user for the PROTOTYPE pages (`features/*`), read from SessionService.
 * Sign-in, tokens and sign-out live in SessionService; nothing is kept in localStorage.
 * Screen 9 (Users and access) replaces the user directory calls below.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly session = inject(SessionService);
  private readonly baseUrl = APP_CONFIG.apiBaseUrl;

  readonly currentUser = computed(() => toUser(this.session.profile()));
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isSuperAdmin = computed(() => this.currentUser()?.role === 'superadmin');
  readonly currentOrgSlug = computed(() => this.currentUser()?.organisationSlug ?? '');

  getToken(): string | null {
    return this.session.token();
  }

  /** Ends the session; callers then go to the sign-in page. */
  logout(): void {
    void this.session.signOut();
  }

  getUsers(): Observable<AuthUser[]> {
    return this.http
      .get<UserRow[]>(`${this.baseUrl}/api/v1/auth/users`)
      .pipe(map((users) => users.map((u) => toUser(u)!)));
  }

  provisionUser(payload: {
    email: string;
    fullName: string;
    role: string;
    tenantId: string;
    organisationName: string;
    password?: string;
  }): Observable<AuthUser> {
    const body = {
      email: payload.email,
      full_name: payload.fullName,
      role: payload.role,
      tenant_id: payload.tenantId,
      organisation_name: payload.organisationName,
      password: payload.password,
    };
    return this.http.post<UserRow>(`${this.baseUrl}/api/v1/auth/users`, body).pipe(map((u) => toUser(u)!));
  }
}

function toUser(u: Profile | UserRow | null): AuthUser | null {
  if (!u) return null;
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role as UserRole,
    organisationId: u.organisation_id,
    organisationSlug: u.organisation_slug,
    organisationName: u.organisation_name,
    avatarInitials: u.avatar_initials || 'U',
  };
}
