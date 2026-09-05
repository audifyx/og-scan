import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";
import { EDGE_FN_PROXY_TIMEOUT_MS, EDGE_FN_TIMEOUT_MS, fetchWithTimeout } from "@/lib/fetchTimeout";

/** Same-origin Vercel rewrite first (ad-blockers / hung supabase.co), then direct. */
export function edgeFunctionUrls(name: string): string[] {
  const direct = SUPABASE_URL ? `${SUPABASE_URL.replace(/\/$/, "")}/functions/v1/${name}` : "";
  const sameOrigin = `/ai-fn/${name}`;
  if (typeof window === "undefined") return direct ? [direct] : [sameOrigin];
  return direct ? [sameOrigin, direct] : [sameOrigin];
}

function looksLikeSpaFallback(res: Response, body: unknown): boolean {
  if (res.status === 404 || res.status === 405) return true;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("text/html")) return true;
  if (typeof body === "string" && /<!doctype html/i.test(body)) return true;
  return false;
}

export async function invokeEdgeFn(
  name: string,
  body: Record<string, unknown>,
  opts?: { authToken?: string; timeoutMs?: number },
): Promise<Record<string, unknown>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${opts?.authToken ?? SUPABASE_ANON_KEY}`,
  };
  const payload = JSON.stringify(body);
  const urls = edgeFunctionUrls(name);
  let lastError: Error | null = null;
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    const attemptMs = opts?.timeoutMs ?? (i === 0 && urls.length > 1 ? EDGE_FN_PROXY_TIMEOUT_MS : EDGE_FN_TIMEOUT_MS);
    try {
      const res = await fetchWithTimeout(url, { method: "POST", headers, body: payload }, attemptMs);
      const ct = res.headers.get("content-type") || "";
      const json = ct.includes("application/json")
        ? await res.json().catch(() => ({}))
        : await res.text().catch(() => "");
      if (looksLikeSpaFallback(res, json)) {
        lastError = new Error(`Edge function ${name} is not reachable at ${url}`);
        continue;
      }
      if (!res.ok) {
        const errBody = json && typeof json === "object" ? json as Record<string, unknown> : {};
        const msg = String(errBody.message || errBody.error || errBody.msg || `Request failed (${res.status})`);
        throw new Error(msg);
      }
      if (json && typeof json === "object") return json as Record<string, unknown>;
      throw new Error("Unexpected edge function response");
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err));
      lastError = e;
      if (/Failed to fetch|NetworkError|Load failed|not reachable|timed out|AbortError/i.test(e.message) || e.name === "AbortError") {
        lastError = new Error("Login service timed out. Please try again.");
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error(`Edge function ${name} failed`);
}
