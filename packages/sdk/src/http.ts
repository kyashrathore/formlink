export class FormlinkError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "FormlinkError";
  }

  /** Field messages returned by a form's beforeSubmit hook ({ errors: { field: "message" } }). */
  get fieldErrors(): Record<string, string> | undefined {
    const d = this.details as { errors?: Record<string, string> } | undefined;
    return d?.errors;
  }
}

export interface RequestOptions {
  baseUrl: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export async function request<T>(
  opts: RequestOptions,
  method: string,
  path: string,
  body?: unknown,
  extra?: { headers?: Record<string, string>; raw?: BodyInit; text?: boolean; keepalive?: boolean },
): Promise<T> {
  const doFetch = opts.fetch ?? fetch;
  const headers: Record<string, string> = { ...opts.headers, ...extra?.headers };
  if (body !== undefined) headers["content-type"] = "application/json";
  const res = await doFetch(`${opts.baseUrl.replace(/\/$/, "")}${path}`, {
    method,
    headers,
    body: extra?.raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    keepalive: extra?.keepalive,
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  if (!res.ok) {
    let err: { code?: string; message?: string; details?: unknown } = {};
    try {
      err = (JSON.parse(text) as { error?: typeof err }).error ?? {};
    } catch {
      /* not JSON */
    }
    throw new FormlinkError(res.status, err.code ?? "http_error", err.message ?? (text || res.statusText), err.details);
  }
  if (extra?.text) return text as T;
  return (text ? JSON.parse(text) : undefined) as T;
}
