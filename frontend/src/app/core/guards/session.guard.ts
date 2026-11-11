import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../session/session.service';

/** Platform pages: need a valid session; otherwise sign in and come back here. */
export const sessionGuard: CanActivateFn = async (_route, state) => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (await session.load()) return true;
  return router.createUrlTree(['/sign-in'], { queryParams: { returnUrl: state.url } });
};

/** Route data `{ permission: 'x.y' }` → no-permission page when the user lacks it. */
export const permissionGuard: CanActivateFn = (route) => {
  const session = inject(SessionService);
  const router = inject(Router);
  const permission = route.data['permission'] as string | undefined;
  return session.can(permission) || router.createUrlTree(['/no-permission']);
};
