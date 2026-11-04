import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  let token: string | null = null;
  let tenantId: string | null = null;

  try {
    token = localStorage.getItem('compliance_hub_jwt_token');
    const userRaw = localStorage.getItem('compliance_hub_auth_user');
    if (userRaw) {
      const u = JSON.parse(userRaw);
      if (u.organisationSlug) {
        tenantId = u.organisationSlug;
      }
    }
    if (!tenantId) {
      tenantId = localStorage.getItem('compliance_hub_active_tenant');
    }
  } catch {
    // LocalStorage fallback
  }

  let headers = req.headers;
  if (token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }
  if (tenantId && !headers.has('X-Tenant-ID')) {
    headers = headers.set('X-Tenant-ID', tenantId);
  }

  return next(req.clone({ headers }));
};

