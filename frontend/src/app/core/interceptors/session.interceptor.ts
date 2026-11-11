import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { PLATFORM_API, SKIP_SESSION_HANDLING } from '../api/api-client';
import { SessionService } from '../session/session.service';

/**
 * Every API request carries the current access token. On 401 the session is refreshed once
 * from the refresh cookie and the request retried; if that fails, the user signs in again
 * and comes back to the same page. A 403 on a platform page load shows the no-permission page.
 *
 * The workspace comes from the token only; no tenant header is ever sent.
 */
export const sessionInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.includes('/api/')) return next(req);

  const session = inject(SessionService);
  const router = inject(Router);

  const withToken = (r: HttpRequest<unknown>) => {
    const token = session.token();
    const headers = token ? r.headers.set('Authorization', `Bearer ${token}`) : r.headers.delete('Authorization');
    return r.clone({ headers: headers.delete('X-Tenant-ID') });
  };

  if (req.context.get(SKIP_SESSION_HANDLING)) return next(req);

  return next(withToken(req)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);

      if (error.status === 401) {
        return from(session.refresh()).pipe(
          switchMap((ok) => {
            if (ok) return next(withToken(req));
            if (!router.url.startsWith('/sign-in')) {
              void router.navigate(['/sign-in'], { queryParams: { returnUrl: router.url, reason: 'expired' } });
            }
            return throwError(() => error);
          }),
        );
      }
      if (error.status === 403 && req.method === 'GET' && req.context.get(PLATFORM_API)) {
        void router.navigate(['/no-permission'], { skipLocationChange: true });
      }
      return throwError(() => error);
    }),
  );
};
