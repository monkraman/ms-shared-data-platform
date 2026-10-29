const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../src/environments/environment.prod.ts');
const rawUrl = process.env.API_BASE_URL || process.env.BACKEND_URL || 'https://compliance-hub-backend.onrender.com';
const cleanUrl = rawUrl.trim().replace(/\/$/, '');

const envConfigFile = `/**
 * Production Environment Configuration (Vercel / Render)
 * Auto-injected during Vercel build from environment variables.
 */
export const environment = {
  production: true,
  apiBaseUrl:
    (typeof window !== 'undefined' && (window as any).__ENV__?.API_BASE_URL) ||
    (typeof window !== 'undefined' && localStorage.getItem('compliance_api_base_url')) ||
    '${cleanUrl}',
  appName: 'Compliance Hub',
  version: '1.0.0',
  enableDebugTools: false,
  defaultTenantId: 'khc-europe',
};
`;

fs.writeFileSync(targetPath, envConfigFile, { encoding: 'utf8' });
console.log(`[set-env] Injected production apiBaseUrl: ${cleanUrl}`);

