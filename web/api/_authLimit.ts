/** In-memory auth rate limit (per isolate). Fail-closed locally; Vercel is ephemeral.
 *  Import as `./_authLimit.js` (ESM) so Vercel NFT traces the helper into the lambda. */

const buckets = new Map<string, { count: number; reset: number }>();

export function hitAuthLimit(
  key: string,
  max: number,
  windowMs: number,
): { limited: boolean; retrySec: number } {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || now >= b.reset) {
    b = { count: 0, reset: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  if (buckets.size > 10_000) {
    for (const [k, v] of buckets) {
      if (now >= v.reset) buckets.delete(k);
    }
  }
  return {
    limited: b.count > max,
    retrySec: Math.max(1, Math.ceil((b.reset - now) / 1000)),
  };
}

export function clientIp(req: { headers?: Record<string, unknown> }): string {
  const xff = req.headers?.["x-forwarded-for"];
  const raw = Array.isArray(xff) ? xff[0] : xff;
  if (typeof raw === "string" && raw) return raw.split(",")[0].trim();
  const real = req.headers?.["x-real-ip"];
  return typeof real === "string" && real ? real : "unknown";
}
