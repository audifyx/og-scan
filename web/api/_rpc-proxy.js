/**
 * Server-side API-key proxy (audit B4).
 *
 * The browser bundles used to ship the live paid keys (HELIUS_API_KEY
 * was extractable verbatim from the production SPA + DEX bundles;
 * Jupiter/Birdeye/Alchemy were wired through VITE_* the same way).
 * Browser Helius traffic now goes through this route and the keys
 * live only in the server env:
 *
 *   POST /api/web/rpc-proxy            → https://mainnet.helius-rpc.com/?api-key=<redacted>
 *   GET  /api/web/rpc-proxy/v0/<rest>  → https://api.helius.xyz/v0/<rest>?api-key=<redacted>
 *   *    /api/web/rpc-proxy/alchemy    → https://solana-mainnet.g.alchemy.com/v2/<key>
 *
 * Any api-key a client sends is stripped and replaced with the server
 * key. Jupiter's lite-api works unauthenticated, so the client simply
 * stops sending a key there (no proxy needed). Birdeye had no live
 * client call sites left in the bundle paths (key constant removed).
 *
 * Abuse note: this route is unauthenticated by design (it replaces a
 * previously PUBLIC key), but a per-IP rate limit blunts bulk quota
 * theft, and the key itself is no longer extractable or usable
 * outside this proxy. OWNER ACTION: rotate the Helius (and Jupiter /
 * Birdeye / Alchemy) keys in their dashboards — the old values are in
 * every shipped bundle and must be considered public forever.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/* Per-IP token bucket: 600 requests / minute. The SPA legitimately
 * fires dozens of RPC calls per page; this only stops bulk abuse. */
const buckets = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const windowMs = 60_000;
  const max = 600;
  const arr = (buckets.get(ip) || []).filter((t) => now - t < windowMs);
  arr.push(now);
  buckets.set(ip, arr);
  if (buckets.size > 5000) buckets.clear();
  return arr.length > max;
}

function clientIp(req) {
  const fwd = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return fwd || req.socket?.remoteAddress || "unknown";
}

function send(res, status, body, contentType) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  if (contentType) res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "no-store");
  return res.end(body);
}

function bodyText(req) {
  if (req.body == null) return "";
  if (typeof req.body === "string") return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString("utf8");
  try {
    return JSON.stringify(req.body);
  } catch {
    return "";
  }
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return send(res, 204, "");
  if (rateLimited(clientIp(req))) {
    return send(res, 429, JSON.stringify({ error: "rate_limited" }), "application/json");
  }

  const rawPath = String(req.query?.path || "");
  const segments = rawPath.split("/").filter(Boolean); // ["rpc-proxy", ...]
  const rest = segments.slice(1);
  const heliusKey = process.env.HELIUS_API_KEY || "";

  try {
    // ── Helius REST (v0) ──────────────────────────────────────────
    if (rest[0] === "v0") {
      if (!heliusKey) return send(res, 503, JSON.stringify({ error: "helius_not_configured" }), "application/json");
      const sub = rest.slice(1).map(encodeURIComponent).join("/");
      const params = new URLSearchParams();
      for (const [k, v] of Object.entries(req.query || {})) {
        if (k === "path" || k === "api-key") continue;
        if (Array.isArray(v)) v.forEach((x) => params.append(k, String(x)));
        else if (v != null) params.set(k, String(v));
      }
      params.set("api-key", heliusKey);
      const url = `https://api.helius.xyz/v0/${sub}?${params.toString()}`;
      const r = await fetch(url, { method: req.method, headers: { "Content-Type": "application/json" } });
      return send(res, r.status, await r.text(), r.headers.get("content-type") || "application/json");
    }

    // ── Alchemy ───────────────────────────────────────────────────
    if (rest[0] === "alchemy") {
      const alchemyKey = process.env.ALCHEMY_API_KEY || "";
      if (!alchemyKey) return send(res, 503, JSON.stringify({ error: "alchemy_not_configured" }), "application/json");
      const url = `https://solana-mainnet.g.alchemy.com/v2/${alchemyKey}`;
      const init = { method: req.method, headers: { "Content-Type": "application/json" } };
      if (req.method === "POST") init.body = bodyText(req);
      const r = await fetch(url, init);
      return send(res, r.status, await r.text(), r.headers.get("content-type") || "application/json");
    }

    // ── Helius JSON-RPC ───────────────────────────────────────────
    if (rest.length === 0) {
      if (!heliusKey) return send(res, 503, JSON.stringify({ error: "helius_not_configured" }), "application/json");
      if (req.method !== "POST") return send(res, 405, JSON.stringify({ error: "method_not_allowed" }), "application/json");
      const body = bodyText(req);
      if (!body || body.length > 1_000_000) {
        return send(res, 400, JSON.stringify({ error: "bad_body" }), "application/json");
      }
      const r = await fetch(`https://mainnet.helius-rpc.com/?api-key=<redacted> {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      return send(res, r.status, await r.text(), r.headers.get("content-type") || "application/json");
    }

    return send(res, 404, JSON.stringify({ error: "not_found" }), "application/json");
  } catch (e) {
    return send(res, 502, JSON.stringify({ error: "proxy_failed", detail: String(e?.message || e).slice(0, 160) }), "application/json");
  }
}
