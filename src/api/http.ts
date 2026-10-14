/**
 * HTTP-транспорт для реального X-Lance API.
 * Базовый URL, токен и workspace берутся из .env (см. config.ts).
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | boolean | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  if (!apiBase()) throw new ApiError(0, 'VITE_XLANCE_API_URL не задан');
  const base = apiBase().replace(/\/+$/, '');
  const url = new URL(base + (path.startsWith('/') ? path : `/${path}`));
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

// Ленивая проверка конфигурации — чтобы import.meta.env читался один раз
let cached: { baseUrl: string; token: string; workspaceId: string } | null = null;
function apiBase(): string {
  if (!cached) {
    cached = {
      baseUrl: import.meta.env.VITE_XLANCE_API_URL ?? '',
      token: import.meta.env.VITE_XLANCE_API_TOKEN ?? '',
      workspaceId: import.meta.env.VITE_XLANCE_WORKSPACE_ID ?? '',
    };
  }
  return cached.baseUrl;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  if (!cached) apiBase();
  const { method = 'GET', body, query, signal } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
  if (cached?.token) headers.Authorization = `Bearer ${cached.token}`;
  if (cached?.workspaceId) headers['X-Workspace-Id'] = cached.workspaceId;

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (e) {
    throw new ApiError(0, `Сеть недоступна: ${(e as Error).message}`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const text = await res.text();
      if (text) detail = text;
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, `${method} ${path} → ${res.status}: ${detail}`);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const http = {
  get: <T>(path: string, query?: Record<string, QueryValue>) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
