/**
 * Development Environment Configuration
 * Local development connecting to local FastAPI backend.
 */
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8000',
  appName: 'Compliance Hub',
  version: '1.0.0',
  enableDebugTools: true,
  /** Serve screens 2-8 from the mock API until their backend ships (core/api/mock). */
  mockApi: true,
};

