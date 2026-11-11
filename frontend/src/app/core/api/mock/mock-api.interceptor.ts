import { HttpErrorResponse, HttpHeaders, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { delay, map, of, throwError } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { MockError, matchRoute } from './mock-routes';
import { withMockPermissions } from './session-mock';

/**
 * Answers the planned endpoints of screens not yet built in the backend (see
 * `core/api/contracts.ts`). Requests with no mock route go to the real API.
 * Switched on by `environment.mockApi`; a short delay keeps loading states honest.
 */
export const mockApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!environment.mockApi) return next(req);
  if (req.method === 'GET' && new URL(req.url, 'http://x').pathname === '/api/v1/auth/me') {
    // Real session, plus the permissions of the screens still served from here.
    return next(req).pipe(
      map((e) => (e instanceof HttpResponse && e.body ? e.clone({ body: withMockPermissions(e.body as never) }) : e)),
    );
  }
  const match = matchRoute(req.method, req.urlWithParams);
  if (!match) return next(req);

  const url = new URL(req.urlWithParams, 'http://x');
  const query = Object.fromEntries(url.searchParams.entries());
  try {
    const body = match.route.handle({ params: match.params, query, body: req.body });
    if (body === undefined) return next(req);
    const status = req.method === 'POST' && /\/approve$/.test(url.pathname) ? 202 : req.method === 'POST' ? 201 : 200;
    return of(new HttpResponse({ status, body: structuredClone(body), url: req.url })).pipe(delay(250));
  } catch (e) {
    if (!(e instanceof MockError)) throw e;
    const error = new HttpErrorResponse({
      status: e.status,
      url: req.url,
      headers: new HttpHeaders({ 'Content-Type': 'application/problem+json' }),
      error: { status: e.status, title: e.status === 422 ? 'Validation failed' : 'Error', detail: e.detail, errors: e.errors },
    });
    return throwError(() => error).pipe(delay(250));
  }
};
