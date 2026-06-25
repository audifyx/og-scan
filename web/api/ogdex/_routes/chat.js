import { callFn, send, readBody } from "../_lib.js";
import tokenHandler from "./token.js";

// Capture a route handler's JSON output without an HTTP round-trip.
function capture(handler, mint) {
  return new Promise((resolve) => {
    const res = { headers: {}, statusCode: 200,
      setHeader() {}, status(s) { this.statusCode = s; return this; },
      send(p) { try { resolve(JSON.parse(p)); } catch { resolve(null); } },
      end(p) { try { resolve(JSON.parse(p)); } catch { resolve(null); } } };
    Promise.resolve(handler({ url: `/x?mint=${mint}`, method: "GET" }, res)).catch(() => resolve(null));
  });
}

function compactContext(d, forensics) {
  const t = d?.token || {};
  const meta = d?.meta || {};
  const intel = d?.intel || {};
  const safety = d?.safety || intel.safety || {};
  const holders = intel.holders || [];
  return {
    symbol: t.symbol || meta.symbol,
    name: t.name || meta.name,
    mint: d?.mint,
    price: t.priceUsd ?? meta.priceUsd,
    marketCap: t.mcap ?? meta.mcap,
    fdv: t.fdv ?? meta.fdv,
    liquidity: t.liquidity,
    volume24h: t.volume,
    holders: meta.holderCount ?? t.holderCount ?? safety.totalHolders,
    change: { "5m": t.change5m, "1h": t.change1h, "6h": t.change6h, "24h": t.change24h },
    athMcap: d?.athMcap, athPrice: d?.athPrice,
    ageDays: meta.ageDays ?? t.ageDays,
    createdAt: meta.createdAt ?? t.createdAt,
    organicScore: t.organicScore, organicLabel: t.organicScoreLabel,
    verified: t.isVerified,
    tags: t.tags || [],
    audit: t.audit || {},
    socials: meta.socials || {},
    verdict: d?.verdict,
    safety: {
      mintRenounced: safety.mintAuthorityRenounced,
      freezeRenounced: safety.freezeAuthorityRenounced,
      lpLockedPct: safety.lpLockedPct,
      rugged: safety.rugged, riskScore: safety.riskScore,
      creator: safety.creator, creatorTokens: safety.creatorTokensCount,
    },
    topHolders: holders.slice(0, 12).map((h) => ({ rank: h.rank, owner: h.owner, pct: h.pct, label: h.label })),
    forensics: forensics || null,
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

    // Use the client-supplied context when present (fast path); otherwise fetch.
    let context = body.context;
    if (!context) {
      const d = await capture(tokenHandler, mint);
      context = compactContext(d, body.forensics || null);
    }

    const r = await callFn("ogdex-chat", {
      mint, symbol: context?.symbol || null, name: context?.name || null,
      messages, context,
    });

    if (!r || r.ok === false) {
      return send(res, 200, { ok: false, error: r?.error || "AI unavailable", answer: null });
    }
    return send(res, 200, { ok: true, answer: r.answer, sources: r.sources || [], provider: r.provider || null });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e) });
  }
}

export { compactContext };
