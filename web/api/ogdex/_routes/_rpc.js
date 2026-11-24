import { send, readBody, heliusEnvelopeRpc } from "../_lib.js";
import { isRpcQuotaError, isRpcUnavailableError, jsonRpcWithFallback } from "../../../shared/pump-claim.js";

/** Allowlisted Solana RPC methods — blocks expensive/unbounded proxy abuse. */
const ALLOWED = new Set([
  "getAccountInfo",
  "getBalance",
  "getBlockHeight",
  "getBlockTime",
  "getFeeForMessage",
  "getLatestBlockhash",
  "getMinimumBalanceForRentExemption",
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
 * Calls Helius directly with the server-side key so the browser never sees
 * it. Was the Supabase rpc-proxy — retired 2026-11-24 (it burned ~107K
 * invocations/day as a middleman). Method allowlist + batch size cap reduce
 * cost abuse. When Helius returns 429 "max usage reached" / "used usage",
 * hop to public RPCs that can still send (PublicNode / Ankr / dRPC) so
 * claim stays live.
 */
function proxyNeedsPublicFallback(r) {
  if (!r) return true;
  if (isRpcUnavailableError(r) || isRpcQuotaError(r)) return true;
  if (r.data && (isRpcUnavailableError(r.data) || isRpcQuotaError(r.data))) return true;
  if (r.error && (isRpcUnavailableError(r.error) || isRpcQuotaError(r.error))) return true;
  if (r.raw && (isRpcUnavailableError(r.raw) || isRpcQuotaError(r.raw))) return true;
  return false;
}

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
      // Direct Helius — was callFn("rpc-proxy"), retired 2026-11-24.
      const data = await heliusEnvelopeRpc(b.method, b.params || [], b.id ?? 1);
      if (data && !(data.error && (isRpcUnavailableError(data.error) || isRpcQuotaError(data.error)))) return data;
      // If Helius failed, ALWAYS try public fallback — not just for quota
      // errors. The old logic returned an error when the proxy failed with
      // a non-quota error, breaking all wallet scans.
      const needsFallback = !data || proxyNeedsPublicFallback(data) || (data && data.error && (isRpcUnavailableError(data.error) || isRpcQuotaError(data.error)));
      if (needsFallback) {
        try {
          return await jsonRpcWithFallback(b);
        } catch {
          /* fall through to helius error */
        }
      }
      if (data) return data;
      return { jsonrpc: "2.0", id: b.id ?? 1, error: { code: -32603, message: "helius error" } };
    } catch (e) {
      // On exception, always try public fallback before giving up
      try {
        return await jsonRpcWithFallback(b);
      } catch {
        /* keep original */
      }
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
