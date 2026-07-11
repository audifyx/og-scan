import { callFn, send, readBody, INTEL_FN } from "../_lib.js";
import tokenHandler from "./token.js";
import forensicsHandler from "./forensics.js";
import athHandler from "./ath.js";

// Capture a route handler's JSON output without an HTTP round-trip.
function capture(handler, url) {
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200,
      setHeader() {}, status(s) { this.statusCode = s; return this; },
      send(p) { try { resolve(JSON.parse(p)); } catch { resolve(null); } },
      end(p) { try { resolve(JSON.parse(p)); } catch { resolve(null); } } };
    Promise.resolve(handler({ url, method: "GET" }, res)).catch(() => resolve(null));
  });
}

// Build the FULL context from everything our APIs return, so the coin AI can
// answer almost anything without claiming it lacks the data.
function buildContext(d, forensics, ath) {
  const t = d?.token || {}, meta = d?.meta || {}, intel = d?.intel || {};
  const safety = d?.safety || intel.safety || {}, flags = d?.flags || {}, score = d?.score || {};
  const holders = intel.holders || [], trades = intel.trades || [];
  return {
    identity: { symbol: t.symbol || meta.symbol, name: t.name || meta.name, mint: d?.mint, chain: meta.chain || "solana", verified: t.isVerified, tags: t.tags || [], decimals: t.decimals },
    market: {
      priceUsd: t.priceUsd ?? meta.priceUsd, marketCap: t.mcap ?? meta.mcap, fdv: t.fdv ?? meta.fdv,
      liquidity: t.liquidity, volume24h: t.volume, totalSupply: t.totalSupply ?? intel.totalSupply, circSupply: t.circSupply,
      ath: ath?.athMcap != null ? { athMcap: ath.athMcap, athPrice: ath.athPrice, athDate: ath.athDate, fromAthPct: ath.fromAthPct, source: ath.source } : "coming soon (all-time-high data not available yet)",
      change: { "5m": t.change5m, "1h": t.change1h, "6h": t.change6h, "24h": t.change24h },
      organicScore: t.organicScore, organicLabel: t.organicScoreLabel, verdict: d?.verdict, momentum: d?.momentumLabel,
    },
    microstructure: {
      buyVolume24h: t.buyVolume ?? meta.buyVolume24h, sellVolume24h: t.sellVolume ?? meta.sellVolume24h,
      numBuys24h: t.numBuys ?? meta.numBuys24h, numSells24h: t.numSells ?? meta.numSells24h,
      numTraders24h: t.numTraders ?? meta.numTraders24h, netBuyers24h: t.netBuyers ?? meta.netBuyers24h,
      holderChange24h: t.holderChange24h, liquidityChange24h: t.liquidityChange24h, volumeChange24h: t.volumeChange24h,
      windows: t.stats || {},
    },
    holdersInfo: {
      totalHolders: meta.holderCount ?? t.holderCount ?? safety.totalHolders, shownTop: holders.length,
      top10PctApprox: holders.length ? holders.slice(0, 10).reduce((a, h) => a + (h.pct || 0), 0) : null,
      topHoldersPct: t.audit?.topHoldersPercentage,
      whaleCount: intel.whaleCount ?? holders.filter((h) => h.label === "whale").length,
      kolHolderCount: intel.kolHolderCount ?? 0, kolHolders: intel.kolHolders || [],
      top25: holders.slice(0, 25).map((h) => ({ rank: h.rank, owner: h.owner, pct: h.pct, label: h.label, kol: h.kol?.name || null, publicLabel: h.publicLabel?.name || null })),
    },
    recentTrades: trades.slice(0, 20).map((x) => ({ side: x.side, usd: x.volumeUsd, tokenAmount: x.tokenAmount, owner: x.owner, kol: x.kol?.name || null, dex: x.dex, time: x.time, txHash: x.txHash })),
    pairs: (d?.pairs || []).map((p) => ({ dex: p.dex, liquidity: p.liquidity, volume24h: p.volume24h, change24h: p.change24h, buys: p.txnsBuys, sells: p.txnsSells })),
    audit: t.audit || {},
    security: {
      mintRenounced: safety.mintAuthorityRenounced ?? flags.mintAuthorityDisabled,
      freezeRenounced: safety.freezeAuthorityRenounced ?? flags.freezeAuthorityDisabled,
      lpLockedPct: safety.lpLockedPct, lpPulled: flags.lpPulled, rugged: safety.rugged, riskScore: safety.riskScore,
      risks: (safety.risks || []).slice(0, 8), forensicScores: score.signals || null,
    },
    origin: {
      createdAt: meta.createdAt ?? t.createdAt, ageDays: meta.ageDays ?? t.ageDays,
      launchpad: forensics?.launchpad ?? safety.launchpad, isPumpFun: forensics?.isPumpFun ?? meta.isPumpFun,
      bondingComplete: forensics?.bondingComplete ?? null,
    },
    forensics: forensics ? { dev: forensics.dev, firstBuyer: forensics.firstBuyer, dexPaid: forensics.dexPaid, concentration: forensics.concentration, safetyFlags: forensics.safetyFlags } : null,
    socials: meta.socials || {},
  };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.end(); return;
  }
  if (req.method !== "POST") return send(res, 405, { ok: false, error: "POST only" });

  try {
    const body = await readBody(req);
    const mint = String(body.mint || "").trim();
    const messages = Array.isArray(body.messages) ? body.messages.slice(-12) : [];
    if (!mint) return send(res, 400, { ok: false, error: "mint required" });
    if (!messages.length) return send(res, 400, { ok: false, error: "messages required" });

    // Use the client-supplied full context when present (fast path); otherwise
    // gather everything server-side so the AI is never missing data.
    let context = body.context;
    if (!context || !context.holdersInfo) {
      const [d, f, a] = await Promise.all([
        capture(tokenHandler, `/x?mint=${mint}`),
        capture(forensicsHandler, `/x?mint=${mint}&first=0`),
        capture(athHandler, `/x?mint=${mint}`),
      ]);
      context = buildContext(d, f && f.ok ? f : null, a && a.ok ? a : null);
    }

    // Timebox the edge function call: if it exceeds 26s we return clean JSON
    // instead of letting the platform kill the request with an opaque 504.
    const r = await Promise.race([
      callFn("ogdex-chat", {
        mint, symbol: context?.identity?.symbol || null, name: context?.identity?.name || null, messages, context,
      }),
      new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: "AI timed out — please try again" }), 26000)),
    ]);
    if (!r || r.ok === false) return send(res, 200, { ok: false, error: r?.error || "AI unavailable", answer: null });
    return send(res, 200, { ok: true, answer: r.answer, sources: r.sources || [], provider: r.provider || null });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

export { buildContext };
