import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { routes } from './app.routes';
import { sessionInterceptor } from './core/interceptors/session.interceptor';
import { mockApiInterceptor } from './core/api/mock/mock-api.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    // Session first: it adds the token and handles 401s for real and mock responses alike.
    provideHttpClient(withFetch(), withInterceptors([sessionInterceptor, mockApiInterceptor])),
  ]
};
