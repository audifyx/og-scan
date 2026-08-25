/**
 * Real token districts for the OrbitX on-chain city.
 * DexScreener + Pump.fun + known majors. Never invent market caps.
 */
import { ORBITX_MINT, asNumber, isOrbitxMint } from "./orbitx-chain-intel.js";

export const MAJOR_MINTS = [
  ORBITX_MINT,
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm",
  "2zMMhcVQEXDtdE6vsFS7S7D5oUodfJHE8vd1gnBouauv",
  "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
];

export const DEX_HUBS = [
  { id: "jupiter", label: "JUPITER DEX", kind: "dex", program: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4" },
  { id: "raydium", label: "RAYDIUM DEX", kind: "dex", program: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8" },
  { id: "pumpfun", label: "PUMP.FUN", kind: "dex", program: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P" },
];

const HDR = { Accept: "application/json", "User-Agent": "OrbitXOnChain/1.0" };

async function timed(url, ms = 4500) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { headers: HDR, signal: ctrl.signal });
    if (!r.ok) return null;
    return await r.json();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

function pairToDistrict(pair, source) {
  const mint = pair?.baseToken?.address;
  if (!mint) return null;
  return {
    mint,
    symbol: pair.baseToken?.symbol || null,
    name: pair.baseToken?.name || null,
    image: pair.info?.imageUrl || null,
    price_usd: asNumber(pair.priceUsd),
    market_cap: asNumber(pair.marketCap) ?? asNumber(pair.fdv),
    liquidity_usd: asNumber(pair.liquidity?.usd),
    volume_24h: asNumber(pair.volume?.h24),
    change_24h: asNumber(pair.priceChange?.h24),
    dex: pair.dexId || null,
    source,
    kind: isOrbitxMint(mint) ? "orbitx" : "token",
  };
}

function pumpToDistrict(coin) {
  const mint = coin?.mint;
  if (!mint) return null;
  return {
    mint,
    symbol: coin.symbol || null,
    name: coin.name || null,
    image: coin.image_uri || coin.imageUri || null,
    price_usd: asNumber(coin.usd_price) ?? asNumber(coin.price_usd),
    market_cap: asNumber(coin.usd_market_cap) ?? asNumber(coin.market_cap),
    liquidity_usd: null,
    volume_24h: asNumber(coin.volume_24h) ?? asNumber(coin.volume),
    change_24h: null,
    dex: "pumpfun",
    source: "pumpfun",
    kind: "token",
  };
}

export async function fetchDexPairs(mints) {
  const uniq = [...new Set(mints.filter(Boolean))].slice(0, 30);
  if (!uniq.length) return [];
  const out = [];
  for (let i = 0; i < uniq.length; i += 10) {
    const chunk = uniq.slice(i, i + 10);
    const j = await timed(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`);
    const pairs = Array.isArray(j?.pairs) ? j.pairs : [];
    const best = new Map();
    for (const p of pairs) {
      if (p?.chainId && p.chainId !== "solana") continue;
      const mint = p.baseToken?.address;
      if (!mint) continue;
      const prev = best.get(mint);
      const liq = asNumber(p.liquidity?.usd) || 0;
      if (!prev || liq > (asNumber(prev.liquidity?.usd) || 0)) best.set(mint, p);
    }
    for (const p of best.values()) {
      const d = pairToDistrict(p, "dexscreener");
      if (d) out.push(d);
    }
  }
  return out;
}

export async function fetchDexBoosts() {
  const j = await timed("https://api.dexscreener.com/token-boosts/top/v1");
  const rows = Array.isArray(j) ? j : [];
  return rows
    .filter((r) => r?.chainId === "solana" && r.tokenAddress)
    .slice(0, 16)
    .map((r) => r.tokenAddress);
}

export async function fetchPumpTrending(limit = 16) {
  const j = await timed(
    `https://frontend-api-v3.pump.fun/coins?limit=${limit}&offset=0&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
  );
  const coins = Array.isArray(j) ? j : (j?.coins || []);
  return coins.map(pumpToDistrict).filter(Boolean);
}

export function eventBreakdown(events) {
  const rows = Array.isArray(events) ? events : [];
  const buckets = { BUY: 0, TRANSFER: 0, SELL: 0, ORBITX: 0, BURN: 0, OTHER: 0 };
  for (const e of rows) {
    const t = String(e.event_type || "");
    if (e.orbitx_related) buckets.ORBITX += 1;
    else if (t.includes("BURN")) buckets.BURN += 1;
    else if (t.includes("BUY")) buckets.BUY += 1;
    else if (t.includes("SELL")) buckets.SELL += 1;
    else if (t.includes("TRANSFER")) buckets.TRANSFER += 1;
    else buckets.OTHER += 1;
  }
  const total = rows.length;
  return Object.entries(buckets).map(([kind, count]) => ({
    kind,
    count,
    pct: total ? Number(((count / total) * 100).toFixed(1)) : 0,
  }));
}

export function epsSeries(events, windowMs = 120_000, buckets = 12) {
  const now = Date.now();
  const step = windowMs / buckets;
  const series = Array.from({ length: buckets }, (_, i) => ({
    t: now - windowMs + (i + 1) * step,
    n: 0,
  }));
  for (const e of events || []) {
    const ts = e.block_time ? Date.parse(e.block_time) : NaN;
    if (!Number.isFinite(ts) || now - ts > windowMs) continue;
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((ts - (now - windowMs)) / step)));
    series[idx].n += 1;
  }
  return series.map((b) => ({ t: b.t, eps: Number((b.n / (step / 1000)).toFixed(2)) }));
}

export async function loadCityDistricts(extraMints = []) {
  const boosts = await fetchDexBoosts().catch(() => []);
  const pump = await fetchPumpTrending(14).catch(() => []);
  const want = [...MAJOR_MINTS, ...boosts, ...extraMints, ...pump.map((d) => d.mint)];
  const dex = await fetchDexPairs(want);
  const byMint = new Map();
  for (const d of [...dex, ...pump]) {
    if (!d?.mint || byMint.has(d.mint)) continue;
    byMint.set(d.mint, d);
  }
  const orbitx = byMint.get(ORBITX_MINT) || {
    mint: ORBITX_MINT,
    symbol: "ORBITX",
    name: "OrbitX",
    image: null,
    price_usd: null,
    market_cap: null,
    liquidity_usd: null,
    volume_24h: null,
    change_24h: null,
    dex: null,
    source: "orbitx",
    kind: "orbitx",
  };
  orbitx.kind = "orbitx";
  orbitx.source = orbitx.source || "orbitx";
  const tokens = [...byMint.values()]
    .filter((d) => !isOrbitxMint(d.mint))
    .sort((a, b) => (b.market_cap || b.volume_24h || 0) - (a.market_cap || a.volume_24h || 0))
    .slice(0, 22);
  return {
    orbitx,
    hubs: DEX_HUBS,
    tokens,
  };
}
