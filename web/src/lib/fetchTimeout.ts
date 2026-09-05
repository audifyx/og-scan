/** Bounded fetch so a hung GoTrue/auth call cannot hold the supabase-js lock forever. */

export const AUTH_FETCH_TIMEOUT_MS = 12_000;
export const EDGE_FN_TIMEOUT_MS = 20_000;
export const EDGE_FN_PROXY_TIMEOUT_MS = 8_000;
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  ms: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const upstream = init?.signal;
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener("abort", () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function isAuthApiUrl(url: string): boolean {
  return /\/auth\/v1\//.test(url);
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export async function supabaseAwareFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = requestUrl(input);
  const ms = isAuthApiUrl(url) ? AUTH_FETCH_TIMEOUT_MS : DEFAULT_FETCH_TIMEOUT_MS;
  try {
    return await fetchWithTimeout(input, init, ms);
  } catch (err) {
    const aborted =
      (err instanceof DOMException && err.name === "AbortError") ||
      (err instanceof Error && err.name === "AbortError");
    if (aborted) {
      throw new Error(isAuthApiUrl(url) ? "Login service timed out. Please try again." : "Request timed out. Please try again.");
    }
    throw err;
  }
}
