import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { SessionService } from '../../core/session/session.service';
import { meWith, membership, signInResponse } from '../../core/session/testing';
import { WorkspacePickerComponent } from './workspace-picker.component';

describe('WorkspacePickerComponent', () => {
  let http: HttpTestingController;
  let router: Router;
  let session: SessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [WorkspacePickerComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    session = TestBed.inject(SessionService);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    session.accept(signInResponse());
    session.me.set(meWith([membership('t1', 'Acme Foods'), membership('t2', 'Beta Drinks')]));
  });

  afterEach(() => http.verify());

  function render() {
    const fixture = TestBed.createComponent(WorkspacePickerComponent);
    fixture.detectChanges();
    return fixture;
  }

  const buttons = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.workspace')];

  it('lists the user’s workspaces and marks the current one', () => {
    const el = render().nativeElement as HTMLElement;
    expect(buttons(el).map((b) => b.textContent?.trim())).toEqual(['Acme Foods Current', 'Beta Drinks']);
  });

  it('switches to the chosen workspace and opens the home screen', async () => {
    const el = render().nativeElement as HTMLElement;
    buttons(el)[1].click();
    const req = http.expectOne((r) => r.url.endsWith('/api/v1/auth/switch-tenant'));
    expect(req.request.body).toEqual({ tenant_id: 't2' });
    req.flush(signInResponse('org_admin', 'tok-t2'));
    (await vi.waitFor(() => http.expectOne((r) => r.url.endsWith('/api/v1/auth/me')))).flush(meWith([membership('t2', 'Beta Drinks')]));
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/app/products'));
    expect(session.token()).toBe('tok-t2');
  });

  it('opens the current workspace without a new token', async () => {
    const el = render().nativeElement as HTMLElement;
    buttons(el)[0].click();
    http.expectNone((r) => r.url.endsWith('/api/v1/auth/switch-tenant'));
    await vi.waitFor(() => expect(router.navigateByUrl).toHaveBeenCalledWith('/app/products'));
  });

  it('shows why a switch failed', async () => {
    const fixture = render();
    buttons(fixture.nativeElement)[1].click();
    http
      .expectOne((r) => r.url.endsWith('/api/v1/auth/switch-tenant'))
      .flush({ detail: 'This workspace is suspended.' }, { status: 403, statusText: 'Forbidden' });
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect((fixture.nativeElement as HTMLElement).querySelector('[role="alert"]')?.textContent).toContain('suspended');
    });
  });
});
