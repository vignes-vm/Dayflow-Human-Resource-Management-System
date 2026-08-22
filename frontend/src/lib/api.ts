import type { ErrorEnvelope } from "@dayflow/shared";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api/v1";
/** Backend origin without the /api/v1 suffix — for linking to /uploads/* static files. */
const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

export class ApiClientError extends Error {
  status: number;
  code: string;
  field?: string;

  constructor(status: number, code: string, message: string, field?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.field = field;
  }
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip the one-shot refresh-and-retry (used by the refresh call itself and auth screens). */
  skipRefresh?: boolean;
}

async function parseError(res: Response): Promise<ApiClientError> {
  try {
    const data = (await res.json()) as ErrorEnvelope;
    return new ApiClientError(res.status, data.error.code, data.error.message, data.error.field);
  } catch {
    return new ApiClientError(res.status, "UNKNOWN_ERROR", res.statusText || "Request failed");
  }
}

async function request<T>(path: string, options: RequestOptions = {}, isRetry = false): Promise<T> {
  const { body, skipRefresh, headers, ...rest } = options;

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !skipRefresh && !isRetry && path !== "/auth/refresh") {
    const refreshed = await refreshSession();
    if (refreshed) {
      return request<T>(path, options, true);
    }
  }

  if (!res.ok) {
    throw await parseError(res);
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return (await res.json()) as T;
  }
  return undefined as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

export { API_URL, API_ORIGIN };
