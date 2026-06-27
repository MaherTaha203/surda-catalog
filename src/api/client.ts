/**
 * Frontend API client — base URL, request helper, and image-URL resolution.
 *
 * The Fastify API is the data source (replacing Blink).
 *
 * By default API calls are **same-origin / relative** (e.g. `/products`), so they
 * inherit the page's protocol + host. This works in production when the API is
 * served on the same origin (reverse proxy), and in dev via the Vite proxy in
 * vite.config.ts (which forwards /products, /upload, /uploads, /health to the
 * local API). A hardcoded `http://localhost:4000` default was wrong in the
 * browser anywhere the API isn't literally on the user's machine (deployed host,
 * Codespaces, HTTPS → mixed content) and caused every request to fail.
 *
 * For a split-origin setup, set `VITE_API_URL` to the API origin at build time.
 *
 * Image URLs are stored relative ('/uploads/products/<file>') on the server.
 * For display we resolve them against the API origin; before writing back we
 * strip the origin again, so the database always keeps the canonical relative URL.
 */
export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** Build an absolute URL for an API path. */
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Fetch JSON from the API, throwing ApiError on non-2xx. */
export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  // `no-store`: this is a mutable API — never serve a stale browser-cached
  // response (e.g. an empty list refetched right after a create).
  const res = await fetch(apiUrl(path), { cache: 'no-store', ...options });
  if (!res.ok) {
    let message = `API responded ${res.status}`;
    try {
      const body = await res.json();
      if (body?.message) message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Resolve a stored image URL to an absolute, displayable URL. */
export function resolveImageUrl(url: string): string {
  if (!url) return url;
  if (/^(https?:|data:|blob:)/i.test(url)) return url; // already absolute / inline
  if (url.startsWith('/')) return `${API_BASE_URL}${url}`; // local upload path
  return url;
}

/** Convert a (possibly absolute) image URL back to the canonical relative form. */
export function toStoredImageUrl(url: string): string {
  if (!url) return url;
  if (API_BASE_URL && url.startsWith(`${API_BASE_URL}/`)) {
    return url.slice(API_BASE_URL.length);
  }
  return url;
}
