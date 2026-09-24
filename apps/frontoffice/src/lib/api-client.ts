/**
 * Centralized API client for Proto Frontoffice.
 * In production or Docker environments, requests use VITE_API_BASE_URL or
 * fallback to relative paths, which are proxied by Vite (dev) or Nginx (prod).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

/**
 * Error thrown when the server returns a non-2xx HTTP status.
 * Carries the numeric status code so callers can branch on it
 * (e.g. 401 to prompt reconnect, 429 to back off).
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  let res: Response;
  try {
    // Default 15s timeout to prevent hanging connections when the network drops
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);
    const signal = options?.signal ?? controller.signal;

    res = await fetch(url, {
      ...options,
      signal,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
    clearTimeout(timeoutId);
  } catch (networkErr) {
    if ((networkErr as Error).name === 'AbortError') {
      throw new ApiError(408, 'Request timed out. Please try again.');
    }
    throw new ApiError(0, `Network error: ${(networkErr as Error).message}`);
  }

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text);
          detail = parsed?.error?.message || parsed?.message || text;
        } catch {
          detail = text;
        }
      }
    } catch {
      // Body unreadable; fall back to statusText.
    }
    throw new ApiError(res.status, `API ${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}
