const API_BASE = (globalThis as any).__API_BASE_URL__ ?? '/v1';
const REFRESH_TOKEN_KEY = 'best_admin_refresh_token';

type AuthConfig = {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  onAuthFailure: () => void;
};

let authConfig: AuthConfig | null = null;
let refreshPromise: Promise<string | null> | null = null;

function normalizeApiMessage(input: unknown, fallback: string): string {
  if (typeof input === 'string' && input.trim()) return input;
  if (Array.isArray(input)) {
    const merged = input.filter((item) => typeof item === 'string').join(' | ').trim();
    if (merged) return merged;
  }
  if (input && typeof input === 'object') {
    const obj = input as Record<string, unknown>;
    const nested = normalizeApiMessage(obj.message ?? obj.error ?? obj.details, '');
    if (nested) return nested;
  }
  return fallback;
}

export function configureApiAuth(config: AuthConfig | null) {
  authConfig = config;
}

export class ApiError extends Error {
  status: number;
  payload?: unknown;

  constructor(message: string, status: number, payload?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.payload = payload;
  }
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getRefreshTokenFromStorage() {
  try {
    return globalThis.localStorage?.getItem(REFRESH_TOKEN_KEY) ?? null;
  } catch {
    return null;
  }
}

async function refreshWithToken(refreshToken: string) {
  try {
    const response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const body = await response.json().catch(() => null);
    return { ok: response.ok, status: response.status, data: body?.data ?? body };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function tryRefreshAccessToken() {
  if (!authConfig) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const initialRefreshToken = authConfig?.getRefreshToken();
      if (!initialRefreshToken) return null;

      let refreshResult = await refreshWithToken(initialRefreshToken);
      if (!refreshResult.ok) {
        const latestRefreshToken = authConfig?.getRefreshToken();
        if (latestRefreshToken && latestRefreshToken !== initialRefreshToken) {
          refreshResult = await refreshWithToken(latestRefreshToken);
        }
      }

      if (!refreshResult.ok) {
        await wait(250);
        const latestFromStorage = getRefreshTokenFromStorage();
        if (latestFromStorage && latestFromStorage !== initialRefreshToken) {
          refreshResult = await refreshWithToken(latestFromStorage);
        }
      }

      if (!refreshResult.ok) {
        await wait(500);
        const latestRefreshToken = authConfig?.getRefreshToken() ?? getRefreshTokenFromStorage();
        if (latestRefreshToken && latestRefreshToken !== initialRefreshToken) {
          refreshResult = await refreshWithToken(latestRefreshToken);
        }
      }

      if (!refreshResult.ok) {
        if (refreshResult.status === 400 || refreshResult.status === 401) {
          authConfig?.onAuthFailure();
        }
        return null;
      }

      const data = refreshResult.data;
      if (!data?.accessToken || !data?.refreshToken) {
        authConfig?.onAuthFailure();
        return null;
      }

      authConfig?.setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return data.accessToken as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

export async function apiCall<T>(path: string, token: string | null, init?: RequestInit, retried = false): Promise<T> {
  const accessToken = token ?? authConfig?.getAccessToken() ?? null;

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (response.status === 401 && !retried && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshedAccessToken = await tryRefreshAccessToken();
    if (refreshedAccessToken) {
      return apiCall<T>(path, refreshedAccessToken, init, true);
    }
  }

  if (!response.ok) {
    let message = 'خطا در ارتباط با سرور';
    let payload: unknown = null;
    try {
      const json = await response.json();
      payload = json;
      message = normalizeApiMessage(json?.message ?? json?.error ?? json, message);
    } catch {
      const text = await response.text();
      payload = text;
      message = normalizeApiMessage(text, message);
    }
    throw new ApiError(message, response.status, payload);
  }

  const body = await response.json();
  return body?.data ?? body;
}

export function apiBasePath() {
  return API_BASE;
}
