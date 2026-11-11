import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SessionService } from '../session/session.service';
import { signInResponse } from '../session/testing';
import { sessionInterceptor } from './session.interceptor';

describe('sessionInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let session: SessionService;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([sessionInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    session = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('sends the access token and never a tenant header for org users', () => {
    session.accept(signInResponse('org_admin', 'tok'));
    localStorage.setItem('compliance_hub_active_tenant', 'other-client');
    void firstValueFrom(client.get('/api/v1/products', { headers: { 'X-Tenant-ID': 'other-client' } }));
    const req = http.expectOne('/api/v1/products');
    expect(req.request.headers.get('Authorization')).toBe('Bearer tok');
    expect(req.request.headers.has('X-Tenant-ID')).toBe(false);
    req.flush([]);
  });

  it('refreshes once on 401 and retries with the new token', async () => {
    session.accept(signInResponse('org_admin', 'old'));
    const result = firstValueFrom(client.get<string[]>('/api/v1/products'));
    http.expectOne('/api/v1/products').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/refresh')).flush(signInResponse('org_admin', 'new'));
    const retry = await vi.waitFor(() => http.expectOne('/api/v1/products'));
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new');
    retry.flush(['ok']);
    expect(await result).toEqual(['ok']);
  });

  it('sends the user to sign in, then back, when the session has expired', async () => {
    session.accept(signInResponse());
    Object.defineProperty(router, 'url', { get: () => '/app/gaps?status=open' });
    const result = firstValueFrom(client.get('/api/v1/products')).catch((e: unknown) => e);
    http.expectOne('/api/v1/products').flush(null, { status: 401, statusText: 'Unauthorized' });
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/refresh')).flush(null, { status: 401, statusText: 'Unauthorized' });
    await result;
    expect(session.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], {
      queryParams: { returnUrl: '/app/gaps?status=open', reason: 'expired' },
    });
  });
});
