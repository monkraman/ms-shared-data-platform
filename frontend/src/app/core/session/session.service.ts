import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient, ApiResponse } from '../api/api-client';

export type Me = ApiResponse<'/api/v1/auth/me', 'get'>;

const TOKEN_KEY = 'ch.accessToken';

/**
 * The signed-in session. Holds only the access token on the client; the user, the
 * active workspace and permissions always come from `GET /api/v1/auth/me`.
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly api = inject(ApiClient);

  readonly token = signal<string | null>(readToken());
  readonly me = signal<Me | null>(null);

  readonly permissions = computed(() => new Set(this.me()?.permissions ?? []));
  readonly workspaceName = computed(() => this.me()?.active_tenant?.name ?? 'Compliance Hub');

  can(permission: string | undefined): boolean {
    return !permission || this.permissions().has(permission);
  }

  setToken(token: string): void {
    this.token.set(token);
    this.me.set(null);
    writeToken(token);
  }

  /** Loads the session once; returns null when signed out or the token is rejected. */
  async load(): Promise<Me | null> {
    if (!this.token()) return null;
    if (this.me()) return this.me();
    try {
      const me = await firstValueFrom(this.api.get('/api/v1/auth/me'));
      this.me.set(me);
      return me;
    } catch {
      return null; // 401 is handled (and the session cleared) by the platform interceptor.
    }
  }

  clear(): void {
    this.token.set(null);
    this.me.set(null);
    writeToken(null);
  }
}

// Session storage: survives a reload, not a closed tab. Refresh tokens arrive with screen 1.
function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage blocked: the session lasts until reload.
  }
}
