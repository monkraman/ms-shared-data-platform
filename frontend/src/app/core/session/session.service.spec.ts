import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { SessionService, errorMessage } from './session.service';
import { meWith, membership, signInResponse } from './testing';

describe('SessionService', () => {
  let session: SessionService;
  let http: HttpTestingController;
  const url = (path: string) => (r: { url: string }) => r.url.endsWith(path);

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    session = TestBed.inject(SessionService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('keeps the access token in sessionStorage, never localStorage', async () => {
    const done = session.signIn('ana@acme.test', 'secret-pass');
    const req = http.expectOne(url('/api/v1/auth/sign-in'));
    expect(req.request.withCredentials).toBe(true);
    req.flush(signInResponse());
    await done;

    expect(session.token()).toBe('access-1');
    expect(sessionStorage.getItem('ch.accessToken')).toBe('access-1');
    expect(Object.keys(localStorage).some((k) => localStorage.getItem(k)?.includes('access-1'))).toBe(false);
  });

  it('removes tokens left in localStorage by the prototype sign-in', () => {
    localStorage.setItem('compliance_hub_jwt_token', 'old');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    TestBed.inject(SessionService);
    expect(localStorage.getItem('compliance_hub_jwt_token')).toBeNull();
  });

  it('shares one refresh request between concurrent callers', async () => {
    const a = session.refresh();
    const b = session.refresh();
    http.expectOne(url('/api/v1/auth/refresh')).flush(signInResponse('org_admin', 'access-2'));
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(session.token()).toBe('access-2');
  });

  it('clears the session when the refresh token is no longer valid', async () => {
    session.accept(signInResponse());
    const ok = session.refresh();
    http.expectOne(url('/api/v1/auth/refresh')).flush({ detail: 'expired' }, { status: 401, statusText: 'Unauthorized' });
    expect(await ok).toBe(false);
    expect(session.token()).toBeNull();
    expect(sessionStorage.getItem('ch.accessToken')).toBeNull();
  });

  it('signs out locally at once and revokes the refresh token on the server', async () => {
    session.accept(signInResponse());
    const done = session.signOut();
    expect(session.token()).toBeNull();
    expect(session.profile()).toBeNull();
    http.expectOne(url('/api/v1/auth/sign-out')).flush(null, { status: 204, statusText: 'No Content' });
    await done;
  });

  it('switches workspace with a new token and reloads the session', async () => {
    session.accept(signInResponse());
    const done = session.switchWorkspace('t2');
    const req = http.expectOne(url('/api/v1/auth/switch-tenant'));
    expect(req.request.body).toEqual({ tenant_id: 't2' });
    req.flush(signInResponse('org_admin', 'access-t2'));
    (await vi.waitFor(() => http.expectOne(url('/api/v1/auth/me')))).flush(meWith([membership('t2', 'Beta')]));
    await done;
    expect(session.token()).toBe('access-t2');
    expect(session.workspaceName()).toBe('Beta');
  });

  it('sends platform admins to workspaces and everyone else to products', () => {
    session.accept(signInResponse('superadmin'));
    expect(session.home()).toBe('/app/workspaces');
    session.accept(signInResponse('org_admin'));
    expect(session.home()).toBe('/app/products');
  });

  it('shows the API message for failures', () => {
    const fail = (status: number, error: unknown) => new HttpErrorResponse({ status, error });
    expect(errorMessage(fail(401, { detail: 'Incorrect email or password.' }))).toBe('Incorrect email or password.');
    expect(errorMessage(fail(429, { detail: 'Too many attempts. Try again in 15 minutes.' }))).toContain('15 minutes');
    expect(errorMessage(fail(0, null))).toBe('Can’t reach the server. Try again.');
    expect(errorMessage(new Error('x'))).toBe('Something went wrong. Try again.');
  });
});
