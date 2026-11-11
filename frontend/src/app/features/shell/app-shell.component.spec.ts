import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { NAV_ITEMS } from '../../core/navigation/nav-items';
import { Me, SessionService } from '../../core/session/session.service';
import { AppShellComponent, initialsOf } from './app-shell.component';

const me = (permissions: string[]): Me => ({
  user: { id: 'u1', email: 'ana@x.test', full_name: 'Ana Lima', is_platform_admin: false },
  active_tenant: { id: 't1', slug: 'acme', name: 'Acme Foods', status: 'active' },
  permissions,
  memberships: [],
});

describe('AppShellComponent', () => {
  let session: SessionService;
  const original = [...NAV_ITEMS];

  beforeEach(() => {
    sessionStorage.clear();
    NAV_ITEMS.splice(0, NAV_ITEMS.length, ...original, {
      label: 'Workspaces',
      path: '/app/workspaces',
      icon: 'M2 2h12v12H2z',
      permission: 'platform.tenants.read',
    });
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(SessionService);
  });

  afterEach(() => NAV_ITEMS.splice(0, NAV_ITEMS.length, ...original));

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the workspace, the user and only the navigation the user may use', () => {
    session.me.set(me(['workspace.read']));
    const el = render();
    expect(el.querySelector('.sidebar .workspace')?.textContent?.trim()).toBe('Acme Foods');
    expect(el.querySelector('.user .name')?.textContent?.trim()).toBe('Ana Lima');
    const links = [...el.querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(links).toEqual(['Home']);
  });

  it('adds items when the API grants their permission', () => {
    session.me.set(me(['platform.tenants.read']));
    const links = [...render().querySelectorAll('nav a')].map((a) => a.textContent?.trim());
    expect(links).toEqual(['Home', 'Workspaces']);
  });

  it('signs out', () => {
    session.setToken('t');
    session.me.set(me([]));
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    render().querySelector<HTMLButtonElement>('button[aria-label="Sign out"]')!.click();
    expect(session.token()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/sign-in']);
  });

  it('makes initials from a name', () => {
    expect(initialsOf('Ana Maria Lima')).toBe('AL');
    expect(initialsOf('ana')).toBe('A');
    expect(initialsOf('')).toBe('?');
  });
});
