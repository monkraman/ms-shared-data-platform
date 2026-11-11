import { HttpErrorResponse } from '@angular/common/http';

/** RFC 9457 problem details, the API's single error format. */
export interface Problem {
  status: number;
  title: string;
  detail: string;
  requestId?: string;
  /** Field name → message, for showing next to form fields. */
  fields: Record<string, string>;
}

interface ProblemBody {
  status?: number;
  title?: string;
  detail?: unknown;
  request_id?: string;
  errors?: { loc?: (string | number)[]; msg?: string }[];
}

export function toProblem(error: unknown): Problem {
  if (!(error instanceof HttpErrorResponse)) {
    return { status: 0, title: 'Error', detail: 'Something went wrong.', fields: {} };
  }
  if (error.status === 0) {
    return { status: 0, title: 'Offline', detail: 'Can’t reach the server.', fields: {} };
  }
  const body = (typeof error.error === 'object' && error.error) || {};
  const { status, title, detail, request_id, errors } = body as ProblemBody;
  const fields: Record<string, string> = {};
  for (const e of errors ?? []) {
    const name = e.loc?.at(-1);
    if (name !== undefined && e.msg && !(name in fields)) fields[String(name)] = e.msg;
  }
  return {
    status: status ?? error.status,
    title: title ?? error.statusText,
    detail: typeof detail === 'string' ? detail : 'Something went wrong.',
    requestId: request_id ?? error.headers?.get('X-Request-ID') ?? undefined,
    fields,
  };
}
