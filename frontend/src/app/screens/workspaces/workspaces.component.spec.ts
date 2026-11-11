import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { Workspace } from '../../core/api/contracts';
import { WorkspacesComponent } from './workspaces.component';

const ws = (over: Partial<Workspace> = {}): Workspace => ({
  id: 'w1',
  slug: 'khc-europe',
  name: 'The Kraft Heinz Company Europe',
  sector: 'Food',
  status: 'active',
  brand_color: '#1b3c6d',
  logo_url: 'https://example.test/khc.png',
  countries: ['UK', 'DK'],
  modules: ['EPR', 'PPWR'],
  legal_entities: [{ name: 'H.J. Heinz Foods UK Ltd', country: 'UK', registration_number: '00147624' }],
  user_count: 4,
  last_activity_at: null,
  created_at: '2026-01-01T00:00:00Z',
  ...over,
});

describe('WorkspacesComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkspacesComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify({ ignoreCancelled: true }));

  async function render() {
    const fixture = TestBed.createComponent(WorkspacesComponent);
    fixture.detectChanges();
    http.expectOne((r) => r.method === 'GET' && r.url.endsWith('/api/v1/admin/tenants')).flush([
      ws(),
      ws({ id: 'w2', slug: 'harbour', name: 'Harbour Foods Ltd', logo_url: null, status: 'draft' }),
    ]);
    // The two wizards load the reference lists.
    for (const r of http.match((r) => r.url.includes('/api/v1/reference/'))) {
      r.flush(r.request.url.endsWith('countries') ? [{ code: 'UK', name: 'United Kingdom', eu: false }] : []);
    }
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists workspaces from the API with their logo or colour', async () => {
    const el = (await render()).nativeElement as HTMLElement;
    const names = [...el.querySelectorAll('.ws b')].map((b) => b.textContent?.trim());
    expect(names).toEqual(['The Kraft Heinz Company Europe', 'Harbour Foods Ltd']);
    expect(el.querySelector<HTMLImageElement>('.ws img.logo')?.getAttribute('src')).toBe('https://example.test/khc.png');
    expect(el.querySelectorAll('.ws .dot').length).toBe(1);
  });
});
