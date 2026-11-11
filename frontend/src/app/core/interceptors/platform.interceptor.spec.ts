import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '../api/api-client';
import { SessionService } from '../session/session.service';
import { authInterceptor } from './auth.interceptor';
import { platformInterceptor } from './platform.interceptor';

describe('platformInterceptor', () => {
  let http: HttpTestingController;
  let session: SessionService;
  let router: Router;
  let api: ApiClient;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([platformInterceptor, authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionService);
    router = TestBed.inject(Router);
    api = TestBed.inject(ApiClient);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  it('sends only the access token; never a tenant header', () => {
    session.setToken('new-token');
    localStorage.setItem('compliance_hub_active_tenant', 'someone-else');
    api.get('/api/v1/auth/me').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/me'));
    expect(req.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(req.request.headers.has('X-Tenant-ID')).toBe(false);
    req.flush({});
  });

  it('leaves legacy requests to the legacy interceptor', () => {
    session.setToken('new-token');
    localStorage.setItem('compliance_hub_jwt_token', 'old-token');
    TestBed.inject(HttpClient).get('/api/v1/tenants').subscribe();
    const req = http.expectOne('/api/v1/tenants');
    expect(req.request.headers.get('Authorization')).toBe('Bearer old-token');
    req.flush([]);
  });

  it('on 401 clears the session and asks to sign in again', async () => {
    session.setToken('expired');
    const call = firstValueFrom(api.get('/api/v1/auth/me'));
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/me')).flush({}, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toBeTruthy();
    expect(session.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in'], expect.anything());
  });

  it('on 403 for a page load shows the no-permission page', async () => {
    session.setToken('t');
    const call = firstValueFrom(api.get('/api/v1/jobs/{job_id}', { path: { job_id: '1' } }));
    http.expectOne((r) => r.url.endsWith('/api/v1/jobs/1')).flush({}, { status: 403, statusText: 'Forbidden' });
    await expect(call).rejects.toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith(['/no-permission'], { skipLocationChange: true });
    expect(session.token()).toBe('t');
  });
});
