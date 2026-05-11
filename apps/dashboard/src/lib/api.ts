const API_BASE = (globalThis as any).__API_BASE_URL__ ?? '/v1';

export async function apiCall<T>(path: string, token: string | null, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {})
    }
  });

  if (!response.ok) {
    throw new Error((await response.text()) || '\u062e\u0637\u0627 \u062f\u0631 \u0627\u0631\u062a\u0628\u0627\u0637 \u0628\u0627 \u0633\u0631\u0648\u0631');
  }

  const body = await response.json();
  return body?.data ?? body;
}

export function apiBasePath() {
  return API_BASE;
}
