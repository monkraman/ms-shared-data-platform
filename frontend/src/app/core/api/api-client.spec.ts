import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, HttpHeaders, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiClient, PLATFORM_API, apiUrl } from './api-client';
import { toProblem } from './problem';

describe('ApiClient', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('fills and encodes path parameters', () => {
    expect(apiUrl('/api/v1/jobs/{job_id}', { job_id: 'a b' })).toBe(`${environment.apiBaseUrl}/api/v1/jobs/a%20b`);
    expect(() => apiUrl('/api/v1/jobs/{job_id}', {})).toThrow(/job_id/);
  });

  it('sends typed requests marked as platform API calls', async () => {
    const result = firstValueFrom(api.get('/api/v1/jobs/{job_id}', { path: { job_id: '42' } }));
    const req = http.expectOne(`${environment.apiBaseUrl}/api/v1/jobs/42`);
    expect(req.request.method).toBe('GET');
    expect(req.request.context.get(PLATFORM_API)).toBe(true);
    req.flush({ id: '42', kind: 'system.echo', status: 'succeeded', progress: 100 });
    const job = await result;
    // Typed from the OpenAPI schema: `status` is the JobStatus union.
    const status: 'queued' | 'running' | 'succeeded' | 'failed' = job.status;
    expect(status).toBe('succeeded');
  });
});

describe('toProblem', () => {
  it('reads problem details, field errors and the request ID', () => {
    const error = new HttpErrorResponse({
      status: 422,
      headers: new HttpHeaders({ 'X-Request-ID': 'req-1' }),
      error: {
        status: 422,
        title: 'Validation failed',
        detail: 'The request has invalid fields.',
        errors: [{ loc: ['body', 'name'], msg: 'Field required' }],
      },
    });
    expect(toProblem(error)).toEqual({
      status: 422,
      title: 'Validation failed',
      detail: 'The request has invalid fields.',
      requestId: 'req-1',
      fields: { name: 'Field required' },
    });
  });

  it('explains when the server cannot be reached', () => {
    expect(toProblem(new HttpErrorResponse({ status: 0 })).title).toBe('Offline');
  });
});
