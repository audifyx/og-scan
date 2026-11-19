/**
 * API base URL for the OrbitX platform.
 *
 * The frontend is served from Cloudflare Pages (static) while the API runs
 * on Render, so relative `/api/*` fetches must be rewritten to the Render
 * origin at BUILD time via VITE_API_URL. When VITE_API_URL is unset (local
 * dev against a same-origin /api, or a future same-origin deploy), relative
 * paths pass through unchanged.
 *
 * apiUrl() is idempotent: absolute URLs (http/https) are returned as-is, so
 * wrapping an already-absolute value (e.g. a constant built from apiUrl) is
 * a no-op.
 */
export function apiBase(): string {
  const raw = (import.meta.env.VITE_API_URL as string | undefined) || "";
  return raw.replace(/\/$/, "");
}

export function apiUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = apiBase();
  if (!base) return path;
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}
