import { HttpContext, HttpErrorResponse } from '@angular/common/http';
import { DOCUMENT, Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient, ApiResponse, SKIP_SESSION_HANDLING } from '../api/api-client';

export type Me = ApiResponse<'/api/v1/auth/me', 'get'>;
export type SignInResponse = ApiResponse<'/api/v1/auth/sign-in', 'post'>;
export type Profile = SignInResponse['user'];
export type Membership = Me['memberships'][number];

/** Why the user is on the sign-in page; shown there as a one-line notice. */
export type SignInReason = 'expired' | 'idle' | 'signed-out';

/** Signed out after this long without a key press, click or scroll. */
export const IDLE_MINUTES = 30;

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
 * - The workspace is part of the token; `switchWorkspace()` asks the API for a new one.
 * - After IDLE_MINUTES without input the session ends and sign-in says why.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiClient);
  private readonly router = inject(Router);
  private readonly zone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private refreshing: Promise<boolean> | null = null;
  private refreshFailed = false;

  readonly token = signal<string | null>(read(TOKEN_KEY));
  readonly profile = signal<Profile | null>(parse(read(PROFILE_KEY)));
  readonly me = signal<Me | null>(null);

  readonly permissions = computed(() => new Set(this.me()?.permissions ?? []));
  readonly workspaceName = computed(() => this.me()?.active_tenant?.name ?? 'Compliance Hub');
  /** Workspaces the user can switch between (platform admins use Client workspaces instead). */
  readonly memberships = computed(() => this.me()?.memberships ?? []);
  readonly activeTenantId = computed(() => this.me()?.active_tenant?.id ?? null);

  private lastActivity = Date.now();

  constructor() {
    this.watchIdle();
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

  /** Moves to another workspace the user belongs to; the new token carries it. */
  async switchWorkspace(tenantId: string): Promise<void> {
    const res = await firstValueFrom(this.api.post('/api/v1/auth/switch-tenant', { body: { tenant_id: tenantId } }));
    this.accept(res);
    await this.load();
  }

  /** Ends the session here at once, then revokes the refresh token on the server. */
  async signOut(): Promise<void> {
    this.clear();
    try {
      await firstValueFrom(this.api.post('/api/v1/auth/sign-out', { context: skip() }));
    } catch {
      // Signing out locally is enough if the server is unreachable.
    }
  }

  /** Home screen for the signed-in user: workspaces for platform admins, products otherwise. */
  home(): string {
    return this.profile()?.role === 'superadmin' ? '/app/workspaces' : '/app/products';
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

  private watchIdle(): void {
    const win = this.document.defaultView;
    if (!win) return;
    this.zone.runOutsideAngular(() => {
      const touch = () => (this.lastActivity = Date.now());
      for (const event of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
        win.addEventListener(event, touch, { passive: true });
      }
      win.setInterval(() => {
        if (this.token() && Date.now() - this.lastActivity > IDLE_MINUTES * 60_000) {
          this.zone.run(() => void this.endIdleSession());
        }
      }, 60_000);
    });
  }

  private async endIdleSession(): Promise<void> {
    await this.signOut();
    await this.router.navigate(['/sign-in'], { queryParams: { reason: 'idle' satisfies SignInReason } });
  }
}

/** The API's message for a failed sign-in or switch, or a plain fallback. */
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    if (error.status === 0) return 'Can’t reach the server. Try again.';
    const detail = (error.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail) return detail;
  }
  return 'Something went wrong. Try again.';
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
