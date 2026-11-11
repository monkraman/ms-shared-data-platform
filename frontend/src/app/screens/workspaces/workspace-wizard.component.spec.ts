import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Workspace } from '../../core/api/contracts';
import { WorkspaceWizardComponent } from './workspace-wizard.component';

const existing: Workspace = {
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
};

describe('WorkspaceWizardComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [WorkspaceWizardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  function open(workspace: Workspace | null) {
    const fixture = TestBed.createComponent(WorkspaceWizardComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('workspace', workspace);
    fixture.detectChanges();
    http.expectOne((r) => r.url.endsWith('/api/v1/reference/countries')).flush([
      { code: 'UK', name: 'United Kingdom', eu: false },
      { code: 'DK', name: 'Denmark', eu: true },
    ]);
    http.expectOne((r) => r.url.endsWith('/api/v1/reference/modules')).flush([
      { id: 'EPR', name: 'EPR' },
      { id: 'PPWR', name: 'PPWR' },
    ]);
    fixture.detectChanges();
    return fixture;
  }

  type Internals = { steps(): string[]; name: { set(v: string): void }; submit(): void; logo(): string };

  it('edits without the first-admin step and saves through PATCH', () => {
    const fixture = open(existing);
    const wizard = fixture.componentInstance as unknown as Internals;
    expect(wizard.steps()).toEqual(['Organisation', 'Legal entities', 'Countries and modules']);
    expect(wizard.logo()).toBe('https://example.test/khc.png');

    let saved: Workspace | undefined;
    fixture.componentInstance.updated.subscribe((w) => (saved = w));
    wizard.name.set('Kraft Heinz Europe');
    wizard.submit();

    const req = http.expectOne((r) => r.method === 'PATCH' && r.url.endsWith('/api/v1/admin/tenants/w1'));
    expect(req.request.body).toEqual({
      name: 'Kraft Heinz Europe',
      sector: 'Food',
      brand_color: '#1b3c6d',
      logo_url: 'https://example.test/khc.png',
      legal_entities: existing.legal_entities,
      countries: ['UK', 'DK'],
      modules: ['EPR', 'PPWR'],
    });
    req.flush({ ...existing, name: 'Kraft Heinz Europe' });
    expect(saved?.name).toBe('Kraft Heinz Europe');
    http.verify();
  });

  it('creates with all four steps through POST', () => {
    const fixture = open(null);
    const wizard = fixture.componentInstance as unknown as Internals;
    expect(wizard.steps().length).toBe(4);
  });
});
