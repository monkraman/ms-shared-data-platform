import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../session/session.service';

/** `/app` opens on the user's home screen: workspaces for platform admins, products for others. */
export const landingGuard: CanActivateFn = () => {
  const session = inject(SessionService);
  const router = inject(Router);
  if (session.can('platform.tenants.read')) return router.createUrlTree(['/app/workspaces']);
  if (session.can('products.read')) return router.createUrlTree(['/app/products']);
  return true;
};
