/**
 * Production Environment Configuration (Vercel / Render)
 * Auto-injected during Vercel build from environment variables.
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
