/**
 * POST /api/orbitx/copy-hook — instant copy-trade mirror receiver.
 *
 * Helius pushes enhanced transaction arrays here seconds after a followed
 * wallet's tx confirms (webhookType "enhanced", transactionTypes ["SWAP"]).
 * Helius sends the webhook's authHeader value as the Authorization header.
 *
 * SECURITY:
 *  - The secret is accepted from EITHER the `authorization` header (what
 *    Helius sends) or the `x-copy-secret` header, compared timing-safe
 *    against process.env.COPY_HOOK_SECRET in both cases.
 *  - If COPY_HOOK_SECRET is unset, this endpoint 503s fail-closed: nothing
 *    is ever mirrored on an unverified call. The 5-min tick remains the
 *    fallback — it keeps working whether or not this endpoint is live.
 *
 * Verified payloads run the SAME claim+mirror path as the 5-min tick
 * (mirrorNewSwaps in _mcp-copy-engine.js): the webhook marks seenSigs
 * exactly like the tick, and the claim-then-execute fill mutex serializes
 * overlapping webhook/tick runs so a signature mirrors at most once.
 */
import { timingSafeEqual } from "crypto";
import {
  parseSwap,
  findActiveFollowsByWallet,
  mirrorNewSwaps,
  copyHookSecret,
} from "./_handlers/_mcp-copy-engine.js";
import { sb } from "./_handlers/_mcp-app-wallet.js";

function safeEq(a, b) {
  const L = Buffer.from(String(a));
  const R = Buffer.from(String(b));
  if (L.length === 0 || L.length !== R.length) return false;
  return timingSafeEqual(L, R);
}

// Candidates: raw Authorization value (what Helius sends), its Bearer-
// stripped form (in case the secret was registered with the prefix), and
// the x-copy-secret header (manual/test deliveries).
function providedSecrets(req) {
  const h = req.headers || {};
  const raw = [h.authorization || h.Authorization, h["x-copy-secret"] || h["X-Copy-Secret"]]
    .filter(Boolean)
    .map((v) => String(v).trim())
    .filter(Boolean);
  const out = [];
  for (const v of raw) {
    out.push(v);
    const m = v.match(/^Bearer\s+(.+)$/i);
    if (m && m[1].trim()) out.push(m[1].trim());
  }
  return out;
}

function readBody(req) {
  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      body = [];
    }
  }
  if (Array.isArray(body)) return body;
  if (body && typeof body === "object") {
    for (const k of ["transactions", "data", "txs"]) {
      if (Array.isArray(body[k])) return body[k];
    }
  }
  return [];
}

// Every wallet that touched the tx (token + native legs) — a followed
// wallet is matched by participation, not by position.
function txWallets(tx) {
  const out = new Set();
  for (const legs of [tx?.tokenTransfers, tx?.nativeTransfers]) {
    for (const t of legs || []) {
      if (t?.fromUserAccount) out.add(String(t.fromUserAccount));
      if (t?.toUserAccount) out.add(String(t.toUserAccount));
    }
  }
  return [...out];
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end(JSON.stringify({ ok: false, error: "method" }));
  }

  // Fail closed: no secret configured -> never mirror on unverified calls.
  const secret = copyHookSecret();
  if (!secret) {
    res.statusCode = 503;
    return res.end(
      JSON.stringify({
        ok: false,
        error: "hook_not_configured",
        message: "COPY_HOOK_SECRET is not set — the 5-min tick remains the fallback.",
      })
    );
  }
  const cands = providedSecrets(req);
  if (!cands.length || !cands.some((c) => safeEq(c, secret))) {
    res.statusCode = 401;
    return res.end(JSON.stringify({ ok: false, error: "denied" }));
  }

  const client = await sb();
  if (!client) {
    res.statusCode = 503;
    return res.end(JSON.stringify({ ok: false, error: "db_unavailable" }));
  }

  const txs = readBody(req);
  const rowCache = new Map(); // wallet -> active follow rows (one query per wallet per delivery)
  const rowsFor = async (wallet) => {
    if (!rowCache.has(wallet)) rowCache.set(wallet, await findActiveFollowsByWallet(client, wallet));
    return rowCache.get(wallet);
  };

  const out = [];
  let mirroredOk = 0;
  try {
    for (const tx of txs) {
      if (!tx?.signature) continue;
      const rows = [];
      for (const w of txWallets(tx)) {
        for (const r of await rowsFor(w)) {
          if (!rows.some((x) => x.id === r.id)) rows.push(r);
        }
      }
      if (!rows.length) continue;
      for (const r of rows) {
        const s = parseSwap(tx, r.meta.followedWallet);
        if (!s) continue;
        const res = await mirrorNewSwaps(r.agent_id, r, client, [s]);
        mirroredOk += res.mirrors.filter((m) => m.ok).length;
        out.push({ follow: r.meta.followedWallet, sig: tx.signature, mirrors: res.mirrors });
      }
    }
  } catch (e) {
    // Acknowledge receipt; per-tx failures are reported above. Helius
    // redelivers on non-2xx, and seenSigs makes redelivery idempotent.
    res.statusCode = 200;
    return res.end(JSON.stringify({ ok: false, error: "hook_threw", message: String(e?.message || e), out }));
  }

  res.statusCode = 200;
  return res.end(JSON.stringify({ ok: true, txs: txs.length, mirroredOk, out }));
}

// Mirror trades include ~20s on-chain confirmation polls each; give the
// function the full budget. Helius redelivers on timeout and seenSigs
// keeps redelivery idempotent.
export const config = { maxDuration: 60 };
