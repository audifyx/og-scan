import { send } from "../_lib.js";

// Lightweight health probe for uptime monitors (point UptimeRobot/BetterStack here).
// Pings the critical upstreams with a short timeout and reports per-source status.
async function ping(name, url, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 4000);
  const start = Date.now();
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal });
    clearTimeout(t);
    return { name, ok: r.ok, status: r.status, ms: Date.now() - start };
  } catch (e) { clearTimeout(t); return { name, ok: false, status: 0, ms: Date.now() - start, error: String(e?.message || e).slice(0, 60) }; }
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "public, s-maxage=15, stale-while-revalidate=30");
  const checks = await Promise.all([
    ping("jupiter", "https://lite-api.jup.ag/price/v3?ids=So11111111111111111111111111111111111111112"),
    ping("geckoterminal", "https://api.geckoterminal.com/api/v2/networks?page=1", { headers: { Accept: "application/json;version=20230302" } }),
    ping("dexscreener", "https://api.dexscreener.com/latest/dex/tokens/So11111111111111111111111111111111111111112"),
    ping("supabase-fn", "https://ffjipnkhcebjvttliptb.supabase.co/functions/v1/ogdex-chat", { method: "OPTIONS" }),
  ]);
  const ok = checks.every((c) => c.ok);
  const degraded = !ok && checks.some((c) => c.ok);
  return send(res, ok ? 200 : 503, { ok, status: ok ? "healthy" : degraded ? "degraded" : "down", time: new Date().toISOString(), checks });
}
