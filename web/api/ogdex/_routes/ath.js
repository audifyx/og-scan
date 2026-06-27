import { jup, send, cache } from "../_lib.js";
import { num } from "../_normalize.js";

const GT = "https://api.geckoterminal.com/api/v2";
const GT_HDR = { Accept: "application/json;version=20230302" };

// CoinGecko: TRUE historical ATH for listed tokens.
async function coingeckoAth(mint) {
  try {
    const r = await fetch(
      `https://api.coingecko.com/api/v3/coins/solana/contract/${mint}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`,
      { headers: { Accept: "application/json" } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    const md = d?.market_data; if (!md) return null;
    const athPrice = num(md.ath?.usd);
    if (!athPrice) return null;
    const circ = num(md.circulating_supply) || num(md.total_supply);
    const cur = num(md.current_price?.usd);
    const mc = num(md.market_cap?.usd);
    let athMcap = circ ? athPrice * circ : null;
    if (!athMcap && athPrice && cur && mc) athMcap = (athPrice / cur) * mc;
    return { athPrice, athMcap, source: "coingecko", athDate: md.ath_date?.usd || null };
  } catch { return null; }
}

// Single pool: scan daily candles first, fall back to hourly if daily is empty
// (new tokens may not yet have a full day of indexed history on GT).
async function poolHigh(pool) {
  try {
    // Try daily first (1000 days = nearly 3 years of history)
    const day = await fetch(`${GT}/networks/solana/pools/${pool}/ohlcv/day?limit=1000&currency=usd&aggregate=1`, { headers: GT_HDR })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const dayCandles = day?.data?.attributes?.ohlcv_list || [];
    const dayHighs = dayCandles.map((c) => num(c[2])).filter((h) => h > 0);
    if (dayHighs.length) return Math.max(...dayHighs);

    // Fallback: hourly last 1000 hours (~42 days) for tokens without daily data
    const hr = await fetch(`${GT}/networks/solana/pools/${pool}/ohlcv/hour?limit=1000&currency=usd&aggregate=1`, { headers: GT_HDR })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const hrCandles = hr?.data?.attributes?.ohlcv_list || [];
    const hrHighs = hrCandles.map((c) => num(c[2])).filter((h) => h > 0);
    if (hrHighs.length) return Math.max(...hrHighs);

    // Final fallback: last 1000 minutes (16 hrs) for brand-new tokens
    const min = await fetch(`${GT}/networks/solana/pools/${pool}/ohlcv/minute?limit=1000&currency=usd&aggregate=1`, { headers: GT_HDR })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const minCandles = min?.data?.attributes?.ohlcv_list || [];
    const minHighs = minCandles.map((c) => num(c[2])).filter((h) => h > 0);
    return minHighs.length ? Math.max(...minHighs) : null;
  } catch { return null; }
}

// GeckoTerminal: scan top pools across all timeframes.
async function geckoterminalAth(mint, supply, price, mcap) {
  try {
    const pr = await fetch(`${GT}/networks/solana/tokens/${mint}/pools`, { headers: GT_HDR })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const pools = (pr?.data || [])
      .map((p) => ({ addr: p.attributes?.address, liq: Number(p.attributes?.reserve_in_usd) || 0 }))
      .filter((p) => p.addr).sort((a, b) => b.liq - a.liq).slice(0, 6).map((p) => p.addr);
    if (!pools.length) return null;
    const highs = (await Promise.all(pools.map(poolHigh))).filter((h) => h != null && h > 0);
    if (!highs.length) return null;
    let athPrice = Math.max(...highs);
    if (price && athPrice > price * 10000) athPrice = price * 10000; // wick guard (10000x cap)
    let athMcap = supply ? athPrice * supply : (price && mcap ? (athPrice / price) * mcap : null);
    return { athPrice, athMcap, source: "geckoterminal", athDate: null };
  } catch { return null; }
}

// DexScreener: quick fallback for tokens listed there.
async function dexscreenerAth(mint) {
  try {
    const r = await fetch(`https://api.dexscreener.com/tokens/v1/solana/${mint}`, {
      headers: { Accept: "application/json" },
    });
    if (!r.ok) return null;
    const pairs = await r.json();
    if (!Array.isArray(pairs) || !pairs.length) return null;
    // Use the pair with highest liquidity
    const best = pairs.sort((a, b) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0];
    const athPrice = num(best?.priceUsd);
    const athMcap = num(best?.marketCap) || num(best?.fdv);
    if (!athPrice) return null;
    // DexScreener doesn't expose ATH; use current as floor — only useful as last resort
    return { athPrice, athMcap: athMcap || null, source: "dexscreener", athDate: null };
  } catch { return null; }
}

export default async function handler(req, res) {
  const url = new URL(req.url, "http://x");
  const mint = url.searchParams.get("mint") || "";
  if (!mint) return send(res, 400, { ok: false, error: "mint required" });
  cache(res, 1800, 7200); // ATH rarely changes — 30min fresh, 2h stale

  try {
    // Current price/supply/mcap from Jupiter — used by GT path + sanity checks.
    let price = null, supply = null, mcap = null;
    try {
      const arr = await jup(`/tokens/v2/search?query=${mint}`);
      const jt = Array.isArray(arr) ? (arr.find((t) => (t.id || t.mint) === mint) || null) : null;
      if (jt) { price = num(jt.usdPrice); supply = num(jt.totalSupply) || num(jt.circSupply); mcap = num(jt.mcap); }
    } catch {}

    // Run all sources in parallel; DexScreener only as last resort
    const [cg, gt] = await Promise.all([coingeckoAth(mint), geckoterminalAth(mint, supply, price, mcap)]);

    let cands = [cg, gt].filter((x) => x && x.athPrice);

    // DexScreener fallback: only when CG + GT both failed AND we found no ATH
    if (!cands.length) {
      const ds = await dexscreenerAth(mint);
      if (ds) cands = [ds];
    }

    // Floor fallback: if every source failed but we know current price/mcap,
    // return current as the minimum ATH (token might literally be at ATH right now).
    if (!cands.length) {
      if (price && mcap) {
        return send(res, 200, {
          ok: true, mint, athPrice: price, athMcap: mcap,
          source: "current_floor", athDate: null, fromAthPct: 0,
        });
      }
      return send(res, 200, { ok: true, mint, athPrice: null, athMcap: null, source: null });
    }

    const best = cands.sort((a, b) => (b.athPrice || 0) - (a.athPrice || 0))[0];
    let athMcap = best.athMcap;
    if (athMcap == null && best.athPrice && price && mcap) athMcap = (best.athPrice / price) * mcap;
    if (athMcap != null && mcap) athMcap = Math.max(athMcap, mcap); // ATH can't be less than now
    const fromAthPct = (athMcap && mcap) ? ((mcap / athMcap) - 1) * 100 : null;

    return send(res, 200, {
      ok: true, mint, athPrice: best.athPrice, athMcap,
      source: best.source, athDate: best.athDate, fromAthPct,
    });
  } catch (e) {
    return send(res, 200, { ok: false, mint, error: String(e?.message || e) });
  }
}
