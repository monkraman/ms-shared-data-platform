import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * SuperAdmin Guard:
 * Strictly restricts /admin and /onboarding to platform SuperAdmin users only.
 * If a client user attempts access, redirects them to their client dashboard.
 */
export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) {
    return router.parseUrl('/sign-in');
  }

  if (user.role === 'superadmin') {
    return true;
  }

  // Not superadmin -> redirect to client portal
  return router.parseUrl('/dashboard');
};

/**
 * Client Workspace Guard:
 * Strictly restricts client views (/dashboard, /products, /quality, /simulator, /data-overview)
 * to client users. If SuperAdmin navigates here, redirects them to the SuperAdmin console.
 */
export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!user) {
    return router.parseUrl('/sign-in');
  }

  if (user.role === 'superadmin') {
    // SuperAdmin should stay in the SuperAdmin console
    return router.parseUrl('/admin');
  }

  // Normal client user
  return true;
};

