import { send, callFn, readBody } from "../_lib.js";

/** Allowlisted Solana RPC methods — blocks expensive/unbounded proxy abuse. */
const ALLOWED = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getBlockTime",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMultipleAccounts",
  "getProgramAccounts",
  "getRecentPrioritizationFees",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getSlot",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getTransaction",
  "getTransactionCount",
  "isBlockhashValid",
  "sendTransaction",
  "simulateTransaction",
]);

/**
 * POST /api/ogdex/rpc — Solana JSON-RPC proxy.
 * Forwards to OG Scan's Helius-backed Supabase rpc-proxy so the browser never
 * sees an API key. Method allowlist + batch size cap reduce cost abuse.
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
    if (!b || typeof b.method !== "string" || !ALLOWED.has(b.method)) {
      return { jsonrpc: "2.0", id: b?.id ?? 1, error: { code: -32601, message: "method not allowed" } };
    }
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
    if (Array.isArray(body) && body.length > 10) {
      return send(res, 400, { jsonrpc: "2.0", id: 1, error: { code: -32600, message: "batch too large (max 10)" } });
    }
    const out = Array.isArray(body) ? await Promise.all(body.map(one)) : await one(body);
    return send(res, 200, out);
  } catch (e) {
    return send(res, 500, { jsonrpc: "2.0", id: 1, error: { code: -32603, message: String(e?.message || e) } });
  }
}
