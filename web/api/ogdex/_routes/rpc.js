import { send, callFn, readBody } from "../_lib.js";

/**
 * POST /api/ogdex/rpc — Solana JSON-RPC proxy.
 * Forwards to OG Scan's Helius-backed Supabase rpc-proxy so the browser never
 * sees an API key and no sign-in is required. Returns a standard JSON-RPC
 * response so @solana/web3.js Connection can use it directly over HTTP.
 */
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end();
    return;
  }
  if (req.method !== "POST") return send(res, 405, { error: "POST only" });

  const one = async (b) => {
    try {
      const r = await callFn("rpc-proxy", {
        method: b.method, params: b.params || [], id: b.id ?? 1, provider: "helius",
      });
      if (r && r.success && r.data) return r.data;
      return { jsonrpc: "2.0", id: b.id ?? 1, error: { code: -32603, message: r?.error || "rpc proxy error" } };
    } catch (e) {
      return { jsonrpc: "2.0", id: b?.id ?? 1, error: { code: -32603, message: String(e?.message || e) } };
    }
  };

  try {
    const body = await readBody(req);
    const out = Array.isArray(body) ? await Promise.all(body.map(one)) : await one(body);
    return send(res, 200, out);
  } catch (e) {
    return send(res, 500, { jsonrpc: "2.0", id: 1, error: { code: -32603, message: String(e?.message || e) } });
  }
}
