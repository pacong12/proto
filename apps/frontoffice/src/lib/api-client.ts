/**
 * Centralized API client for Proto Frontoffice.
 * In production or Docker environments, requests use VITE_API_BASE_URL or fallback to relative paths,
 * which are proxied automatically by Vite (development) or Nginx (production).
 */
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '';

export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE_URL}${cleanEndpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  return (await res.json()) as T;
}
