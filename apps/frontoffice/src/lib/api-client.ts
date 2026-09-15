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
    res = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch (networkErr) {
    throw new ApiError(0, `Network error: ${(networkErr as Error).message}`);
  }

  if (!res.ok) {
    // Attempt to read the server error body (may be JSON or plain text).
    let detail = res.statusText;
    try {
      const body = await res.text();
      if (body) detail = body;
    } catch {
      // Body unreadable; fall back to statusText.
    }
    throw new ApiError(res.status, `API ${res.status}: ${detail}`);
  }

  return (await res.json()) as T;
}
