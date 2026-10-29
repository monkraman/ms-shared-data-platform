/**
 * Production Environment Configuration (Vercel / Render)
 * Enterprise-grade environment resolution for live cloud deployment.
 */
export const environment = {
  production: true,
  apiBaseUrl:
    (typeof window !== 'undefined' && (window as any).__ENV__?.API_BASE_URL) ||
    (typeof window !== 'undefined' && localStorage.getItem('compliance_api_base_url')) ||
    'https://compliance-hub-backend.onrender.com',
  appName: 'Compliance Hub',
  version: '1.0.0',
  enableDebugTools: false,
  defaultTenantId: 'khc-europe',
};

