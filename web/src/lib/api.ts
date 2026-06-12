/**
 * Fetch wrapper with transparent access-token refresh.
 *
 * A 401 pauses the failing request, refreshes once (concurrent 401s share the
 * same in-flight refresh), then replays. If refresh fails the session is
 * cleared and the app falls back to the sign-in screen.
 */

const ACCESS_KEY = 'axon.accessToken';
const REFRESH_KEY = 'axon.refreshToken';

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  message: string | string[];
  issues?: Array<{ level: string; message: string; nodeId?: string }>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly body: ApiErrorBody | null;

  constructor(status: number, body: ApiErrorBody | null, fallback: string) {
    const raw = body?.message;
    super(Array.isArray(raw) ? raw[0] : (raw ?? fallback));
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export const tokens = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

type Listener = () => void;
const unauthorizedListeners = new Set<Listener>();

export function onUnauthorized(listener: Listener): () => void {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = tokens.refresh;
    if (!refreshToken) return false;
    try {
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { accessToken: string; refreshToken: string };
      tokens.set(data.accessToken, data.refreshToken);
      return true;
    } catch {
      return false;
    } finally {
      // Cleared on the next tick so callers awaiting this promise all see it.
      setTimeout(() => {
        refreshInFlight = null;
      }, 0);
    }
  })();

  return refreshInFlight;
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Set false for public endpoints so a missing token is not an error. */
  auth?: boolean;
  raw?: boolean;
}

export async function api<T = unknown>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, raw = false, headers, ...rest } = options;

  const send = async (): Promise<Response> => {
    const finalHeaders: Record<string, string> = {
      ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      ...((headers as Record<string, string>) ?? {}),
    };
    if (auth && tokens.access) finalHeaders.authorization = `Bearer ${tokens.access}`;

    return fetch(`/api${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  };

  let response = await send();

  if (response.status === 401 && auth && tokens.refresh) {
    const refreshed = await refreshSession();
    if (refreshed) {
      response = await send();
    } else {
      tokens.clear();
      unauthorizedListeners.forEach((fn) => fn());
    }
  }

  if (!response.ok) {
    if (response.status === 401) {
      tokens.clear();
      unauthorizedListeners.forEach((fn) => fn());
    }
    let parsed: ApiErrorBody | null = null;
    try {
      parsed = (await response.json()) as ApiErrorBody;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, parsed, `Request failed (${response.status})`);
  }

  if (raw) return (await response.text()) as unknown as T;
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const get = <T>(path: string, options?: RequestOptions) => api<T>(path, { ...options, method: 'GET' });
export const post = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  api<T>(path, { ...options, method: 'POST', body });
export const patch = <T>(path: string, body?: unknown, options?: RequestOptions) =>
  api<T>(path, { ...options, method: 'PATCH', body });
export const del = <T>(path: string, options?: RequestOptions) => api<T>(path, { ...options, method: 'DELETE' });
