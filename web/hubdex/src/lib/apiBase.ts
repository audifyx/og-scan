/**
 * API base URL for the OG DEX sub-app.
 * Same contract as web/src/lib/apiBase.ts: VITE_API_URL at build time points
 * at the Render API; unset means same-origin relative /api/*.
 * apiUrl() is idempotent (absolute URLs pass through unchanged).
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
