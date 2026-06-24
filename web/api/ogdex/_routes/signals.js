/**
 * OG DEX — Signals / Pulse feed.
 * Computes live, anomaly-style signals from instantaneous on-chain data
 * (GeckoTerminal 5m/1h/24h volume + tx buys/sells, pump.fun bonding curve).
 * No snapshots needed — signals derive from short-vs-long window rates.
 *
 * Signal types:
 *   volume_surge   — short-window $volume rate >> hourly baseline (RVOL proxy)
 *   velocity_spike — short-window trade count rate >> hourly baseline
 *   buyer_surge    — buys dominate sells in the last 5m with real buyers
 *   momentum       — strong positive 5m/1h price move with liquidity floor
 *   fresh_runner   — young pool already pumping with real volume
 *   graduating     — pump.fun token near bonding-curve completion (75-99%)
 *   graduated      — pump.fun token just completed the curve (real liquidity)
 *   selloff        — sharp 5m drop with sells dominating (risk warning)
 */
import { send, cache } from "../_lib.js";

const GT = "https://api.geckoterminal.com/api/v2";
const GT_HDR = { Accept: "application/json;version=20230302" };
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
const STABLES = new Set(["USDC","USDT","SOL","WSOL","JLP","JITOSOL","MSOL","BSOL","JUPSOL","INF","USDS","USDE","PYUSD","EURC","CBBTC","WBTC","JUP","DAI","BUSD"]);

async function gtPools(kind, network = "solana", pages = 1) {
  const out = [];
  for (let i = 1; i <= pages; i++) {
    try {
      const r = await fetch(`${GT}/networks/${network}/${kind}?page=${i}&include=base_token`, { headers: GT_HDR });
      if (!r.ok) continue;
      const j = await r.json();
      const tokenMap = {};
      for (const inc of (j.included || [])) if (inc.type === "token") tokenMap[inc.id] = inc.attributes;
      for (const item of (j.data || [])) {
        const a = item.attributes || {};
        const bt = tokenMap[item.relationships?.base_token?.data?.id] || {};
        const mint = bt.address;
        if (!mint) continue;
        const sym = bt.symbol || (a.name || "").split(" / ")[0].trim();
        if (STABLES.has((sym || "").toUpperCase())) continue;
        out.push({
          mint, symbol: sym, name: bt.name || sym, icon: bt.image_url || null, chain: network,
          priceUsd: num(a.base_token_price_usd) || null,
          mcap: num(a.market_cap_usd) || num(a.fdv_usd) || null,
          liq: num(a.reserve_in_usd),
          vol: a.volume_usd || {}, ch: a.price_change_percentage || {}, tx: a.transactions || {},
          createdAt: a.pool_created_at || null,
          ageH: a.pool_created_at ? (Date.now() - new Date(a.pool_created_at).getTime()) / 3.6e6 : null,
          pool: a.address || item.id,
        });
      }
    } catch { /* skip page */ }
  }
  return out;
}

async function pumpGraduating() {
  // pump.fun coins close to graduating + just graduated
  const sigs = [];
  try {
    const r = await fetch(`https://frontend-api-v3.pump.fun/coins?limit=100&offset=0&sort=market_cap&order=DESC&includeNsfw=false`, { headers: { Accept: "application/json" } });
    if (!r.ok) return sigs;
    const coins = await r.json();
    const now = Date.now();
    for (const t of (Array.isArray(coins) ? coins : [])) {
      if (!t?.mint) continue;
      const complete = !!t.complete;
      const rqr = num(t.real_quote_reserves) || num(t.real_sol_reserves) || 0;
      const pct = complete ? 100 : Math.min(100, Math.round((rqr / 85_000_000_000) * 100));
      const total = num(t.total_supply) || 1_000_000_000;
      const mcap = num(t.usd_market_cap);
      const base = {
        mint: t.mint, symbol: t.symbol, name: t.name, icon: t.image_uri || t.image || null, chain: "solana",
        priceUsd: mcap && total ? mcap / total : null, mcap: mcap || null, liq: null,
        bondingPct: pct, ch24h: null, ageH: t.created_timestamp ? (now - t.created_timestamp) / 3.6e6 : null,
      };
      if (!complete && pct >= 75) {
        sigs.push({ ...base, type: "graduating", label: "Graduating Soon", strength: pct,
          metric: `${pct}% to migration`, tone: "lime" });
      } else if (complete && base.ageH != null && base.ageH <= 12) {
        sigs.push({ ...base, type: "graduated", label: "Just Graduated", strength: 90,
          metric: "Curve complete · real liquidity", tone: "cyan" });
      }
    }
  } catch { /* pump optional */ }
  return sigs.sort((a, b) => (b.strength || 0) - (a.strength || 0)).slice(0, 14);
}

function computeSignals(pools) {
  const sigs = [];
  for (const p of pools) {
    const liq = p.liq || 0;
    if (liq < 6000) continue; // filter dust/manip-prone
    const v5 = num(p.vol.m5), v15 = num(p.vol.m15), v1h = num(p.vol.h1);
    const c5 = num(p.ch.m5), c1h = num(p.ch.h1), c24 = num(p.ch.h24);
    const t5 = p.tx.m5 || {}, t1h = p.tx.h1 || {};
    const buys5 = num(t5.buys), sells5 = num(t5.sells), buyers5 = num(t5.buyers);
    const cnt5 = buys5 + sells5, cnt1h = num(t1h.buys) + num(t1h.sells);
    const eps = 1e-9;
    const rvol = (v5 / 5) / Math.max(v1h / 60, eps);            // $/min last 5m vs hourly avg
    const velocity = (cnt5 / 5) / Math.max(cnt1h / 60, eps);    // trades/min last 5m vs hourly avg
    const buyRatio = buys5 / Math.max(sells5, 1);
    const base = {
      mint: p.mint, symbol: p.symbol, name: p.name, icon: p.icon, chain: p.chain,
      priceUsd: p.priceUsd, mcap: p.mcap, liq, vol1h: v1h, ch5m: c5, ch1h: c1h, ch24h: c24,
      ageH: p.ageH, pool: p.pool,
    };
    const cand = [];
    if (rvol >= 2.5 && v5 >= 1200) cand.push({ type: "volume_surge", label: "Volume Surge", tone: "cyan",
      strength: Math.min(100, rvol * 14), metric: `${rvol.toFixed(1)}x volume vs 1h avg` });
    if (velocity >= 2.5 && cnt5 >= 18) cand.push({ type: "velocity_spike", label: "Trade Velocity", tone: "violet",
      strength: Math.min(100, velocity * 14), metric: `${velocity.toFixed(1)}x trades vs 1h avg` });
    if (buyRatio >= 2 && buys5 >= 12 && c5 > 0) cand.push({ type: "buyer_surge", label: "Buyer Surge", tone: "lime",
      strength: Math.min(100, buyRatio * 18), metric: `${buys5} buys vs ${sells5} sells (5m)` });
    if ((c5 >= 8 || c1h >= 25) && liq >= 10000) cand.push({ type: "momentum", label: "Momentum", tone: "lime",
      strength: Math.min(100, Math.max(c5 * 3, c1h * 1.4)), metric: `${c5 >= 8 ? "+" + c5.toFixed(1) + "% 5m" : "+" + c1h.toFixed(1) + "% 1h"}` });
    if (p.ageH != null && p.ageH <= 48 && c1h > 0 && v1h >= 5000) cand.push({ type: "fresh_runner", label: "Fresh Runner", tone: "gold",
      strength: Math.min(100, 40 + c1h), metric: `${p.ageH.toFixed(0)}h old · $${Math.round(v1h / 1000)}K 1h vol` });
    if (c5 <= -12 && sells5 >= buys5 * 1.6 && cnt5 >= 14) cand.push({ type: "selloff", label: "Sell-Off", tone: "red",
      strength: Math.min(100, Math.abs(c5) * 3), metric: `${c5.toFixed(1)}% 5m · ${sells5} sells` });
    // keep the single strongest positive signal + any selloff warning
    const pos = cand.filter((s) => s.type !== "selloff").sort((a, b) => b.strength - a.strength)[0];
    const neg = cand.find((s) => s.type === "selloff");
    if (pos) sigs.push({ ...base, ...pos });
    if (neg) sigs.push({ ...base, ...neg });
  }
  return sigs;
}

export default async function handler(req, res) {
  cache(res, 15, 45);
  try {
    const [trending, fresh, pumps] = await Promise.all([
      gtPools("trending_pools", "solana", 2),
      gtPools("new_pools", "solana", 1),
      pumpGraduating(),
    ]);
    // dedup pools by mint, prefer trending (richer)
    const seen = new Set();
    const pools = [...trending, ...fresh].filter((p) => { if (seen.has(p.mint)) return false; seen.add(p.mint); return true; });
    let signals = computeSignals(pools);
    // merge pump graduation signals (dedup by mint+type)
    const key = (s) => s.mint + ":" + s.type;
    const have = new Set(signals.map(key));
    for (const s of pumps) if (!have.has(key(s))) signals.push(s);
    // rank: graduating/graduated and high strength first
    const order = { graduating: 5, graduated: 5, volume_surge: 4, buyer_surge: 4, momentum: 3, velocity_spike: 3, fresh_runner: 2, selloff: 1 };
    signals.sort((a, b) => (order[b.type] - order[a.type]) || ((b.strength || 0) - (a.strength || 0)));
    signals = signals.slice(0, 80);
    const counts = {};
    for (const s of signals) counts[s.type] = (counts[s.type] || 0) + 1;
    return send(res, 200, { ok: true, generatedAt: new Date().toISOString(), count: signals.length, counts, signals });
  } catch (e) {
    return send(res, 200, { ok: false, error: String(e?.message || e), signals: [] });
  }
}
