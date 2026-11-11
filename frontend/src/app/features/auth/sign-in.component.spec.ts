import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { meWith, membership, signInResponse } from '../../core/session/testing';
import { SignInComponent } from './sign-in.component';

describe('SignInComponent', () => {
  let http: HttpTestingController;
  let router: Router;

  function render(query: Record<string, string> = {}) {
    TestBed.configureTestingModule({
      imports: [SignInComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(query) } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(SignInComponent);
    fixture.detectChanges();
    return fixture;
  }

  const el = (f: ReturnType<typeof render>) => f.nativeElement as HTMLElement;

  function fill(f: ReturnType<typeof render>, email: string, password: string) {
    const c = f.componentInstance.signInForm.controls;
    c.email.setValue(email);
    c.password.setValue(password);
  }

  beforeEach(() => sessionStorage.clear());

  afterEach(() => http.verify());

  it('shows field messages and sends nothing when the form is incomplete', async () => {
    const f = render();
    await f.componentInstance.onSubmit();
    f.detectChanges();
    expect(el(f).querySelector('#work-email-error')?.textContent).toContain('Enter your work email');
    expect(el(f).querySelector('#work-password-error')?.textContent).toContain('Enter your password');
    http.expectNone((r) => r.url.endsWith('/api/v1/auth/sign-in'));
  });

  it('does not prefill credentials', () => {
    const f = render();
    expect(f.componentInstance.signInForm.getRawValue()).toEqual({ email: '', password: '' });
  });

  it('shows the API message when sign-in fails and clears the password', async () => {
    const f = render();
    fill(f, 'ana@acme.test', 'wrong-pass');
    const done = f.componentInstance.onSubmit();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/sign-in'))
      .flush({ detail: 'Incorrect email or password.' }, { status: 401, statusText: 'Unauthorized' });
    await done;
    f.detectChanges();
    expect(el(f).querySelector('[role="alert"]')?.textContent).toContain('Incorrect email or password.');
    expect(f.componentInstance.signInForm.controls.password.value).toBe('');
  });

  it('returns the user to the page they were on', async () => {
    const f = render({ returnUrl: '/app/gaps', reason: 'expired' });
    expect(el(f).querySelector('[role="status"]')?.textContent).toContain('Your session expired');
    fill(f, 'ana@acme.test', 'right-pass');
    const done = f.componentInstance.onSubmit();
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/sign-in')).flush(signInResponse());
    await done;
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/gaps');
  });

  it('ignores a return address on another site', async () => {
    const f = render({ returnUrl: '//evil.test/app' });
    fill(f, 'ana@acme.test', 'right-pass');
    const done = f.componentInstance.onSubmit();
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/sign-in')).flush(signInResponse());
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/api/v1/auth/me')))).flush(meWith([membership('t1', 'Acme')]));
    await done;
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/products');
  });

  it('lands platform admins on client workspaces', async () => {
    const f = render();
    fill(f, 'admin@monkspaces.test', 'right-pass');
    const done = f.componentInstance.onSubmit();
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/sign-in')).flush(signInResponse('superadmin'));
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/api/v1/auth/me')))).flush(meWith([], true));
    await done;
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/workspaces');
  });

  it('asks users in several workspaces to choose one', async () => {
    const f = render();
    fill(f, 'ana@acme.test', 'right-pass');
    const done = f.componentInstance.onSubmit();
    http.expectOne((r) => r.url.endsWith('/api/v1/auth/sign-in')).flush(signInResponse());
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/api/v1/auth/me'))))
      .flush(meWith([membership('t1', 'Acme'), membership('t2', 'Beta')]));
    await done;
    expect(router.navigateByUrl).toHaveBeenCalledWith('/workspace');
  });
});
