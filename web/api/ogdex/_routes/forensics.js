import { callFn, send, cache, INTEL_FN } from "../_lib.js";

const SOL = "So11111111111111111111111111111111111111112";
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

async function rpc(method, params) {
  const r = await callFn("rpc-proxy", { method, params, id: 1, provider: "helius" });
  return r?.data?.result ?? r?.result ?? null;
}

// Was the project's DexScreener listing paid for (profile / ads / boosts)?
async function dexPaid(mint) {
  try {
    const r = await fetch(`https://api.dexscreener.com/orders/v1/solana/${mint}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return { paid: false, services: [] };
    const orders = await r.json();
    const services = (Array.isArray(orders) ? orders : []).map((o) => ({
      type: o.type, status: o.status, at: o.paymentTimestamp || null,
    }));
    const paid = services.some((s) => s.status === "approved");
    return { paid, services };
  } catch { return { paid: false, services: [] }; }
}

// pump.fun coin metadata (creator + bonding info) — null for non-pump tokens.
async function pumpCoin(mint) {
  try {
    const r = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, { headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

// Identify the buyer in a parsed tx: the account that gained the most of `mint`
// while spending SOL. Returns null if the tx isn't a buy of this mint.
function buyerFromTx(tx, mint) {
  try {
    if (!tx || tx.meta?.err) return null;
    const pre = tx.meta?.preTokenBalances || [];
    const post = tx.meta?.postTokenBalances || [];
    const byOwner = {};
    for (const b of post) if (b.mint === mint && b.owner) byOwner[b.owner] = (byOwner[b.owner] || 0) + Number(b.uiTokenAmount?.uiAmount || 0);
    for (const b of pre)  if (b.mint === mint && b.owner) byOwner[b.owner] = (byOwner[b.owner] || 0) - Number(b.uiTokenAmount?.uiAmount || 0);
    let wallet = null, best = 0;
    for (const [o, d] of Object.entries(byOwner)) if (d > best) { best = d; wallet = o; }
    if (!wallet || best <= 0) return null;
    const keys = (tx.transaction?.message?.accountKeys || []).map((k) => (typeof k === "string" ? k : k.pubkey));
    const idx = keys.indexOf(wallet);
    let solDelta = 0;
    if (idx >= 0 && tx.meta?.preBalances && tx.meta?.postBalances) solDelta = (tx.meta.postBalances[idx] - tx.meta.preBalances[idx]) / 1e9;
    return { wallet, tokenAmount: best, solSpent: Math.abs(Math.min(solDelta, 0)), txHash: tx.transaction?.signatures?.[0] || null, time: (tx.blockTime || 0) * 1000 };
  } catch { return null; }
}

// Trace the first on-chain buyer of a token by walking its signature history
// back to genesis. Capped so huge/established tokens degrade gracefully.
async function firstBuyer(mint) {
  try {
    const MAX_PAGES = 8, PAGE = 1000;
    let before = null, all = [], reachedGenesis = false;
    for (let i = 0; i < MAX_PAGES; i++) {
      const opts = { limit: PAGE }; if (before) opts.before = before;
      const sigs = (await rpc("getSignaturesForAddress", [mint, opts])) || [];
      if (!sigs.length) { reachedGenesis = true; break; }
      all = all.concat(sigs);
      before = sigs[sigs.length - 1].signature;
      if (sigs.length < PAGE) { reachedGenesis = true; break; }
    }
    if (!reachedGenesis) return { traced: false, note: "Trade history is too large to trace the first buyer." };
    // oldest first — fetch the earliest txs in parallel, then scan in order.
    const oldest = all.reverse().slice(0, 25);
    const txs = await Promise.all(oldest.map((s) =>
      rpc("getTransaction", [s.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]).catch(() => null)
    ));
    for (const tx of txs) {
      const buy = buyerFromTx(tx, mint);
      if (buy) return { traced: true, ...buy };
    }
    return { traced: false, note: "No early buy transaction found." };
  } catch (e) { return { traced: false, note: String(e?.message || e) }; }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  const wantFirst = url.searchParams.get("first") !== "0"; // allow skipping the heavy trace
  cache(res, 60, 300);

  try {
    const [paid, pump, intel] = await Promise.all([
      dexPaid(mint),
      pumpCoin(mint),
      callFn(INTEL_FN, { mint }).catch(() => null),
    ]);

    const safety = intel?.safety || {};
    const holders = intel?.holders || [];
    const dev = pump?.creator || safety.creator || null;

    // Dev current position from the holder list.
    let devHolding = null, devSold = null, devRank = null;
    if (dev && holders.length) {
      const h = holders.find((x) => x.owner === dev);
      if (h) { devHolding = { pct: h.pct ?? null, uiAmount: h.uiAmount ?? null }; devRank = h.rank ?? null; devSold = (h.pct ?? 0) < 0.5; }
      else { devHolding = { pct: 0, uiAmount: 0 }; devSold = true; } // not in top holders => effectively exited
    }

    // First buyer trace (best-effort, capped).
    let first = null;
    if (wantFirst) {
      first = await firstBuyer(mint);
      if (first?.traced && dev) first.isDev = first.wallet === dev;
    }

    // Concentration snapshot.
    const top10Pct = holders.length ? holders.slice(0, 10).reduce((s, h) => s + (h.pct || 0), 0) : null;
    const whales = holders.filter((h) => (h.pct || 0) >= 1).length;

    return send(res, 200, {
      ok: true,
      mint,
      dev: dev ? {
        wallet: dev,
        tokensCreated: safety.creatorTokensCount ?? null,
        holding: devHolding,
        rank: devRank,
        sold: devSold,
        serial: (safety.creatorTokensCount ?? 0) >= 5,
      } : null,
      firstBuyer: first,
      dexPaid: paid,
      launchpad: safety.launchpad || (pump ? "pump.fun" : null),
      isPumpFun: !!pump || !!safety.isPumpFun,
      bondingComplete: pump ? !!pump.complete : null,
      concentration: { top10Pct, whales, totalHolders: safety.totalHolders ?? intel?.holderCount ?? null },
      safetyFlags: {
        mintRenounced: safety.mintAuthorityRenounced ?? null,
        freezeRenounced: safety.freezeAuthorityRenounced ?? null,
        lpLockedPct: safety.lpLockedPct ?? null,
        rugged: safety.rugged ?? null,
        riskScore: safety.riskScore ?? null,
      },
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, error: String(e?.message || e) });
  }
}
