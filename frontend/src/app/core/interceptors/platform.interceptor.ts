import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { PLATFORM_API } from '../api/api-client';
import { SessionService } from '../session/session.service';

/**
 * Platform API requests carry the access token and nothing else: the workspace comes
 * from the token. 401 → sign in again (and come back); 403 on a page load → no-permission page.
 */
export const platformInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.context.get(PLATFORM_API)) return next(req);

  const session = inject(SessionService);
  const router = inject(Router);
  const token = session.token();
  const authed = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authed).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401) {
          session.clear();
          const returnUrl = router.url.startsWith('/sign-in') ? undefined : router.url;
          void router.navigate(['/sign-in'], { queryParams: returnUrl ? { returnUrl } : {} });
        } else if (error.status === 403 && req.method === 'GET') {
          void router.navigate(['/no-permission'], { skipLocationChange: true });
        }
      }
      return throwError(() => error);
    }),
  );
};
