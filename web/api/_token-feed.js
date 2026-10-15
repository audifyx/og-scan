/**
 * _token-feed.js — public ORBITX token feed proxy (via /api/web?path=token-feed).
 * Serves parsed live trades + burns + supply for the /token page.
 * Uses server-side Solana RPC so mobile clients don't depend on flaky public-RPC access.
 */

const RPC_URLS = [
  "https://api.mainnet-beta.solana.com",
  "https://solana-rpc.publicnode.com",
];
const INCINERATOR = "1nc1nerator11111111111111111111111111111111";
const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const INITIAL_SUPPLY = 1_000_000_000;

function json(res, status, body, cacheSeconds = 0) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (cacheSeconds > 0) {
    res.setHeader("Cache-Control", `s-maxage=${cacheSeconds}, stale-while-revalidate=${cacheSeconds * 2}`);
  } else {
    res.setHeader("Cache-Control", "no-store");
  }
  return res.end(JSON.stringify(body));
}

async function rpcCall(method, params, timeoutMs = 8000) {
  let lastErr = null;
  for (const base of RPC_URLS) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!r.ok) { lastErr = new Error(`RPC ${r.status}`); continue; }
      const j = await r.json();
      if (j.error) { lastErr = new Error(j.error.message || "RPC error"); continue; }
      return j.result;
    } catch (e) {
      clearTimeout(timer);
      lastErr = e;
    }
  }
  throw lastErr || new Error("all RPC endpoints failed");
}

function parseTrade(tx, mint) {
  try {
    const sig = tx.transaction.signatures[0];
    const keys = tx.transaction.message.accountKeys;
    const meta = tx.meta;
    if (!meta || meta.err) return null;
    const preB = meta.preBalances ?? [];
    const postB = meta.postBalances ?? [];
    const sumBy = (list) => {
      const m = new Map();
      for (const b of list ?? []) {
        if (b.mint !== mint) continue;
        m.set(b.owner, (m.get(b.owner) ?? 0) + (b.uiTokenAmount?.uiAmount ?? 0));
      }
      return m;
    };
    const preT = sumBy(meta.preTokenBalances);
    const postT = sumBy(meta.postTokenBalances);
    const owners = new Set([...preT.keys(), ...postT.keys()]);
    let best = null;
    for (const o of owners) {
      const d = (postT.get(o) ?? 0) - (preT.get(o) ?? 0);
      if (!best || Math.abs(d) > Math.abs(best.delta)) best = { owner: o, delta: d };
    }
    if (!best || Math.abs(best.delta) < 1e-9) return null;
    const idx = keys.indexOf(best.owner);
    const ownerSolDelta = idx >= 0 && preB[idx] != null ? (preB[idx] - postB[idx]) / 1e9 : 0;
    const incineratorIn = (postT.get(INCINERATOR) ?? 0) - (preT.get(INCINERATOR) ?? 0);
    let side = "TRANSFER";
    if (best.owner === INCINERATOR || incineratorIn > 1e-9) side = "BURN";
    else if (best.delta > 0 && ownerSolDelta > 0.0000005) side = "BUY";
    else if (best.delta < 0 && ownerSolDelta < -0.0000005) side = "SELL";
    return {
      signature: sig,
      timestamp: tx.blockTime ?? 0,
      side,
      tokenAmount: Math.abs(best.delta),
      solAmount: Math.abs(ownerSolDelta),
      wallet: best.owner,
    };
  } catch {
    return null;
  }
}

async function handleTrades(res, mint, limit) {
  const sigs = await rpcCall("getSignaturesForAddress", [mint, { limit: Math.min(limit, 25) }]);
  const fresh = (sigs || []).filter((s) => !s.err).slice(0, Math.min(limit, 25));
  // parallel fetch with small concurrency
  const results = [];
  for (let i = 0; i < fresh.length; i += 12) {
    const batch = fresh.slice(i, i + 12);
    const txs = await Promise.all(
      batch.map((s) =>
        rpcCall("getTransaction", [s.signature, { encoding: "json", maxSupportedTransactionVersion: 1 }])
          .then((tx) => ({ tx, s }))
          .catch(() => null),
      ),
    );
    for (const item of txs) {
      if (!item || !item.tx) continue;
      const t = parseTrade({ ...item.tx, blockTime: item.tx.blockTime ?? item.s.blockTime }, mint);
      if (t) results.push(t);
    }
  }
  results.sort((a, b) => b.timestamp - a.timestamp);
  return json(res, 200, { ok: true, trades: results }, 15);
}

async function handleSupply(res, mint) {
  const r = await rpcCall("getTokenSupply", [mint]);
  const supply = r?.value?.uiAmount ?? null;
  return json(
    res,
    200,
    { ok: true, supply, burned: supply != null ? Math.max(0, INITIAL_SUPPLY - supply) : null },
    60,
  );
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    return res.end();
  }
  try {
    const q = req.query || {};
    const action = String(q.action || "trades").trim();
    const mint = String(q.mint || ORBITX_MINT).trim();
    if (!/^[A-Za-z0-9]{32,44}$/.test(mint)) return json(res, 400, { ok: false, error: "bad mint" });
    if (action === "trades") {
      const limit = Math.min(25, Math.max(5, parseInt(String(q.limit || "15"), 10) || 15));
      return await handleTrades(res, mint, limit);
    }
    if (action === "supply") return await handleSupply(res, mint);
    return json(res, 400, { ok: false, error: `Unknown action: ${action}` });
  } catch (e) {
    return json(res, 502, { ok: false, error: String((e && e.message) || e).slice(0, 160) });
  }
}
