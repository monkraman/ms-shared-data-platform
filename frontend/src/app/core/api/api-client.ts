import { HttpClient, HttpContext, HttpContextToken } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { paths } from './schema';

/**
 * Typed client for the platform API, generated from the backend's OpenAPI.
 *
 *   api.get('/api/v1/jobs/{job_id}', { path: { job_id } })   // Observable<JobOut>
 *
 * Paths, parameters, bodies and responses are checked against `schema.ts`.
 * Regenerate after backend changes: `npm run api:generate`.
 */

/** Marks requests that go through the platform API (token only, no legacy headers). */
export const PLATFORM_API = new HttpContextToken<boolean>(() => false);

type Method = 'get' | 'post' | 'put' | 'patch' | 'delete';
type Op<P extends keyof paths, M extends Method> = NonNullable<paths[P][M & keyof paths[P]]>;
type PathsFor<M extends Method> = {
  [P in keyof paths]: [Op<P, M>] extends [never] ? never : P;
}[keyof paths];

type Json<T> = T extends { content: { 'application/json': infer B } } ? B : never;
type Success<R> = Json<R[Extract<keyof R, 200 | 201 | 202>]>;
type Params<O> = O extends { parameters: infer Pa } ? Pa : never;
type PathParams<O> = Params<O> extends { path: infer X } ? ([X] extends [never] ? never : X) : never;
type QueryParams<O> = Params<O> extends { query?: infer X } ? X : never;
type Body<O> = O extends { requestBody?: infer B } ? Json<NonNullable<B>> : never;

export type ApiResponse<P extends keyof paths, M extends Method> = Op<P, M> extends { responses: infer R }
  ? Success<R>
  : never;

export interface ApiOptions<O> {
  path?: PathParams<O>;
  query?: QueryParams<O>;
  body?: Body<O>;
}

@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);

  get<P extends PathsFor<'get'>>(path: P, options?: ApiOptions<Op<P, 'get'>>): Observable<ApiResponse<P, 'get'>> {
    return this.request('GET', path, options);
  }

  post<P extends PathsFor<'post'>>(path: P, options?: ApiOptions<Op<P, 'post'>>): Observable<ApiResponse<P, 'post'>> {
    return this.request('POST', path, options);
  }

  put<P extends PathsFor<'put'>>(path: P, options?: ApiOptions<Op<P, 'put'>>): Observable<ApiResponse<P, 'put'>> {
    return this.request('PUT', path, options);
  }

  patch<P extends PathsFor<'patch'>>(
    path: P,
    options?: ApiOptions<Op<P, 'patch'>>,
  ): Observable<ApiResponse<P, 'patch'>> {
    return this.request('PATCH', path, options);
  }

  delete<P extends PathsFor<'delete'>>(
    path: P,
    options?: ApiOptions<Op<P, 'delete'>>,
  ): Observable<ApiResponse<P, 'delete'>> {
    return this.request('DELETE', path, options);
  }

  private request<T>(method: string, path: string, options?: ApiOptions<unknown>): Observable<T> {
    const opts = (options ?? {}) as { path?: object; query?: object; body?: unknown };
    return this.http.request<T>(method, apiUrl(path, opts.path), {
      body: opts.body,
      params: cleanQuery(opts.query),
      context: new HttpContext().set(PLATFORM_API, true),
    });
  }
}

/** `/api/v1/jobs/{job_id}` + `{ job_id: 'x' }` → `<base>/api/v1/jobs/x` */
export function apiUrl(path: string, params?: object): string {
  const values = (params ?? {}) as Record<string, string | number>;
  const filled = path.replace(/\{(\w+)\}/g, (_, name: string) => {
    if (values[name] === undefined) throw new Error(`Missing path parameter "${name}" for ${path}`);
    return encodeURIComponent(String(values[name]));
  });
  return environment.apiBaseUrl.replace(/\/$/, '') + filled;
}

function cleanQuery(query?: object): Record<string, string | number | boolean | readonly (string | number | boolean)[]> {
  const out: Record<string, string | number | boolean | readonly (string | number | boolean)[]> = {};
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) out[key] = value;
  }
  return out;
}
