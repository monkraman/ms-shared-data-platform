import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { Router, provideRouter } from '@angular/router';
import { Me, SessionService } from '../../core/session/session.service';
import { AppShellComponent, initialsOf } from './app-shell.component';

const me = (permissions: string[], admin = false): Me => ({
  user: { id: 'u1', email: 'ana@x.test', full_name: 'Ana Lima', is_platform_admin: admin },
  active_tenant: { id: 't1', slug: 'acme', name: 'Acme Foods', status: 'active' },
  permissions,
  memberships: [],
});

describe('AppShellComponent', () => {
  let session: SessionService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    session = TestBed.inject(SessionService);
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(AppShellComponent);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const links = (el: HTMLElement) => [...el.querySelectorAll('nav ul a')].map((a) => a.textContent?.trim());
  const groups = (el: HTMLElement) => [...el.querySelectorAll('.group-label')].map((g) => g.textContent?.trim());

  it('shows the workspace, the user and only the navigation the user may use', () => {
    session.me.set(me(['products.read', 'gaps.read']));
    const el = render();
    expect(el.querySelector('.brand .workspace')?.textContent?.trim()).toBe('Acme Foods');
    expect(el.querySelector('.user .name')?.textContent?.trim()).toBe('Ana Lima');
    expect(groups(el)).toEqual(['Data']);
    expect(links(el)).toEqual(['Products', 'Gaps']);
  });

  it('shows the platform group to platform admins', () => {
    session.me.set(me(['platform.tenants.read', 'products.read'], true));
    const el = render();
    expect(groups(el)).toEqual(['Platform', 'Data']);
    expect(links(el)).toEqual(['Client workspaces', 'Products']);
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
