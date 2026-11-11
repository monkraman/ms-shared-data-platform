import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient, ApiResponse, SKIP_SESSION_HANDLING } from '../api/api-client';

export type Me = ApiResponse<'/api/v1/auth/me', 'get'>;
export type SignInResponse = ApiResponse<'/api/v1/auth/sign-in', 'post'>;
export type Profile = SignInResponse['user'];

const TOKEN_KEY = 'ch.accessToken';
const PROFILE_KEY = 'ch.profile';
const LEGACY_KEYS = ['compliance_hub_jwt_token', 'compliance_hub_auth_user'];

/**
 * The signed-in session, in one place.
 *
 * - Access token (15 min) and the signed-in profile live in sessionStorage: a reload keeps
 *   them, a closed tab does not. The refresh token is an httpOnly cookie the page never sees.
 * - `refresh()` renews the access token from that cookie; the interceptor calls it on 401.
 * - User, workspace and permissions for platform screens come from `GET /api/v1/auth/me`.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiClient);
  private refreshing: Promise<boolean> | null = null;
  private refreshFailed = false;

  readonly token = signal<string | null>(read(TOKEN_KEY));
  readonly profile = signal<Profile | null>(parse(read(PROFILE_KEY)));
  readonly me = signal<Me | null>(null);

  readonly permissions = computed(() => new Set(this.me()?.permissions ?? []));
  readonly workspaceName = computed(() => this.me()?.active_tenant?.name ?? 'Compliance Hub');

  constructor() {
    // Tokens from before secure sign-in were kept in localStorage; drop them.
    for (const key of LEGACY_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Storage blocked.
      }
    }
  }

  can(permission: string | undefined): boolean {
    return !permission || this.permissions().has(permission);
  }

  async signIn(email: string, password: string): Promise<SignInResponse> {
    const res = await firstValueFrom(
      this.api.post('/api/v1/auth/sign-in', { body: { email, password, remember_me: true }, context: skip() }),
    );
    this.accept(res);
    return res;
  }

  /** Renews the access token from the refresh cookie. Concurrent callers share one request. */
  refresh(): Promise<boolean> {
    if (this.refreshFailed) return Promise.resolve(false);
    this.refreshing ??= firstValueFrom(this.api.post('/api/v1/auth/refresh', { context: skip() }))
      .then((res) => {
        this.accept(res);
        return true;
      })
      .catch(() => {
        this.refreshFailed = true;
        this.clear();
        return false;
      })
      .finally(() => (this.refreshing = null));
    return this.refreshing;
  }

  /** Loads `me` once; returns null when there is no valid session. */
  async load(): Promise<Me | null> {
    if (this.me()) return this.me();
    if (!this.token() && !(await this.refresh())) return null;
    try {
      const me = await firstValueFrom(this.api.get('/api/v1/auth/me'));
      this.me.set(me);
      return me;
    } catch {
      return null;
    }
  }

  async signOut(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/api/v1/auth/sign-out', { context: skip() }));
    } catch {
      // Signing out locally is enough if the server is unreachable.
    }
    this.clear();
  }

  accept(res: SignInResponse): void {
    this.refreshFailed = false;
    this.token.set(res.access_token);
    this.profile.set(res.user);
    this.me.set(null);
    write(TOKEN_KEY, res.access_token);
    write(PROFILE_KEY, JSON.stringify(res.user));
  }

  clear(): void {
    this.token.set(null);
    this.profile.set(null);
    this.me.set(null);
    write(TOKEN_KEY, null);
    write(PROFILE_KEY, null);
  }
}

function skip(): HttpContext {
  return new HttpContext().set(SKIP_SESSION_HANDLING, true);
}

function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Storage blocked: the session lasts until reload.
  }
}

function parse(raw: string | null): Profile | null {
  try {
    return raw ? (JSON.parse(raw) as Profile) : null;
  } catch {
    return null;
  }
}
