/**
 * Real token districts for the OrbitX on-chain galaxy.
 * DexScreener + Jupiter + GeckoTerminal + Pump.fun.
 * Never invent market caps. Never use a mint as a display name.
 */
import { ORBITX_MINT, asNumber, isOrbitxMint } from "./orbitx-chain-intel.js";

export const TRENDING_LIMIT = 250;
export const FEED_PREVIEW = 12;
export const FEED_PAGE = 24;
export const MIN_TRENDING_VOLUME = 5_000;

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

const STABLES = new Set([
  "USDC", "USDT", "SOL", "WSOL", "JLP", "JITOSOL", "MSOL", "BSOL", "JUPSOL", "INF",
  "USDS", "USDE", "USDG", "PYUSD", "EURC", "CBBTC", "WBTC", "HSOL", "ISC", "USDH",
  "DAI", "BUSD", "WETH", "ETH", "WBNB", "BNB",
]);

const HDR = { Accept: "application/json", "User-Agent": "OrbitXOnChain/1.0" };

async function timed(url, ms = 5000) {
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

export function looksLikeMint(value) {
  const s = String(value || "").trim();
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s);
}

export function tokenDisplayName(token) {
  const name = String(token?.name || "").trim();
  const symbol = String(token?.symbol || "").trim();
  const mint = String(token?.mint || token?.token_ca || "").trim();
  if (name && name !== mint && !looksLikeMint(name)) return name;
  if (symbol && symbol !== mint && !looksLikeMint(symbol)) return symbol;
  return null;
}

export function tokenTicker(token) {
  const symbol = String(token?.symbol || "").trim();
  const mint = String(token?.mint || token?.token_ca || "").trim();
  if (symbol && symbol !== mint && !looksLikeMint(symbol)) return symbol;
  return null;
}

export function tokenLabel(token) {
  return tokenDisplayName(token) || "Unnamed token";
}

export function dexTokenImage(mint) {
  const ca = String(mint || "").trim();
  if (!looksLikeMint(ca)) return null;
  return `https://dd.dexscreener.com/ds-data/tokens/solana/${ca}.png`;
}

export function cleanTokenFields(token) {
  if (!token || typeof token !== "object") return token;
  const mint = String(token.mint || token.token_ca || "").trim();
  const name = tokenDisplayName({ ...token, mint });
  const symbol = tokenTicker({ ...token, mint });
  return {
    ...token,
    mint: mint || token.mint,
    name: name || null,
    symbol: symbol || null,
    image: token.image || dexTokenImage(mint),
    banner: token.banner || null,
  };
}

function isStable(symbol) {
  return STABLES.has(String(symbol || "").toUpperCase());
}

function pairToDistrict(pair, source) {
  const mint = pair?.baseToken?.address;
  if (!mint) return null;
  const symbol = pair.baseToken?.symbol || null;
  if (isStable(symbol)) return null;
  return {
    mint,
    symbol,
    name: pair.baseToken?.name || null,
    image: pair.info?.imageUrl || dexTokenImage(mint),
    banner: pair.info?.header || pair.info?.openGraph || null,
    price_usd: asNumber(pair.priceUsd),
    market_cap: asNumber(pair.marketCap) ?? asNumber(pair.fdv),
    liquidity_usd: asNumber(pair.liquidity?.usd),
    volume_24h: asNumber(pair.volume?.h24),
    change_24h: asNumber(pair.priceChange?.h24),
    change_1h: asNumber(pair.priceChange?.h1),
    holder_count: null,
    dex: pair.dexId || null,
    source,
    kind: isOrbitxMint(mint) ? "orbitx" : "token",
  };
}

function pumpToDistrict(coin) {
  const mint = coin?.mint;
  if (!mint) return null;
  if (isStable(coin.symbol)) return null;
  return {
    mint,
    symbol: coin.symbol || null,
    name: coin.name || null,
    image: coin.image_uri || coin.imageUri || coin.image || dexTokenImage(mint),
    banner: coin.banner_uri || coin.header || null,
    price_usd: asNumber(coin.usd_price) ?? asNumber(coin.price_usd),
    market_cap: asNumber(coin.usd_market_cap) ?? asNumber(coin.market_cap),
    liquidity_usd: null,
    volume_24h: asNumber(coin.volume_24h) ?? asNumber(coin.volume),
    change_24h: null,
    change_1h: null,
    holder_count: asNumber(coin.holder_count),
    dex: "pumpfun",
    source: "pumpfun",
    kind: "token",
  };
}

function jupToDistrict(row) {
  const mint = row?.id || row?.address || row?.mint;
  if (!mint) return null;
  if (isStable(row.symbol)) return null;
  const stats = row.stats24h || row.stats || {};
  const buyVol = asNumber(stats.buyVolume) || 0;
  const sellVol = asNumber(stats.sellVolume) || 0;
  return {
    mint,
    symbol: row.symbol || null,
    name: row.name || null,
    image: row.icon || row.logoURI || dexTokenImage(mint),
    banner: null,
    price_usd: asNumber(row.usdPrice) ?? asNumber(row.price),
    market_cap: asNumber(row.mcap) ?? asNumber(row.fdv),
    liquidity_usd: asNumber(row.liquidity),
    volume_24h: asNumber(stats.volume) ?? (buyVol + sellVol || null),
    change_24h: asNumber(stats.priceChange) ?? asNumber(row.priceChange24h),
    change_1h: asNumber(stats.priceChange1h),
    holder_count: asNumber(row.holderCount),
    dex: "jupiter",
    source: "jupiter",
    kind: isOrbitxMint(mint) ? "orbitx" : "token",
  };
}

function geckoPoolToMint(item, tokenMap) {
  const rel = item?.relationships || {};
  const baseId = rel.base_token?.data?.id;
  const bt = (tokenMap && baseId && tokenMap[baseId]) || {};
  const mint = bt.address || (typeof baseId === "string" && baseId.includes("_") ? baseId.slice(baseId.indexOf("_") + 1) : null);
  if (!mint) return null;
  const attrs = item.attributes || {};
  const symbol = bt.symbol || (attrs.name || "").split(" / ")[0].trim() || null;
  if (isStable(symbol)) return null;
  return {
    mint,
    symbol,
    name: bt.name || symbol,
    image: bt.image_url || dexTokenImage(mint),
    banner: null,
    price_usd: asNumber(attrs.base_token_price_usd),
    market_cap: asNumber(attrs.market_cap_usd ?? attrs.fdv_usd),
    liquidity_usd: asNumber(attrs.reserve_in_usd),
    volume_24h: asNumber(attrs.volume_usd?.h24),
    change_24h: asNumber(attrs.price_change_percentage?.h24),
    change_1h: asNumber(attrs.price_change_percentage?.h1),
    holder_count: null,
    dex: attrs.name || "geckoterminal",
    source: "geckoterminal",
    kind: "token",
  };
}

export function mergeDistrict(prev, next) {
  if (!next?.mint) return prev || null;
  if (!prev) return cleanTokenFields(next);
  return cleanTokenFields({
    ...prev,
    ...next,
    name: tokenDisplayName(next) ? next.name : prev.name,
    symbol: tokenTicker(next) ? next.symbol : prev.symbol,
    image: next.image || prev.image,
    banner: next.banner || prev.banner,
    price_usd: next.price_usd ?? prev.price_usd,
    market_cap: next.market_cap ?? prev.market_cap,
    liquidity_usd: next.liquidity_usd ?? prev.liquidity_usd,
    volume_24h: Math.max(asNumber(next.volume_24h) || 0, asNumber(prev.volume_24h) || 0) || next.volume_24h || prev.volume_24h,
    change_24h: next.change_24h ?? prev.change_24h,
    change_1h: next.change_1h ?? prev.change_1h,
    holder_count: next.holder_count ?? prev.holder_count,
    dex: next.dex || prev.dex,
    source: next.source || prev.source,
    kind: isOrbitxMint(next.mint) ? "orbitx" : next.kind || prev.kind || "token",
  });
}

export function rankTrending(tokens, limit = TRENDING_LIMIT) {
  const byMint = new Map();
  for (const t of tokens || []) {
    if (!t?.mint || isOrbitxMint(t.mint)) continue;
    byMint.set(t.mint, mergeDistrict(byMint.get(t.mint), t));
  }
  const ranked = [...byMint.values()].sort((a, b) => {
    const vol = (asNumber(b.volume_24h) || 0) - (asNumber(a.volume_24h) || 0);
    if (vol !== 0) return vol;
    return (asNumber(b.market_cap) || 0) - (asNumber(a.market_cap) || 0);
  });
  const primary = ranked.filter(
    (t) => (asNumber(t.volume_24h) || 0) >= MIN_TRENDING_VOLUME || (asNumber(t.market_cap) || 0) >= 50_000,
  );
  if (primary.length >= limit) return primary.slice(0, limit);
  const seen = new Set(primary.map((t) => t.mint));
  const fill = ranked.filter((t) => !seen.has(t.mint));
  return [...primary, ...fill].slice(0, limit);
}

export function matchTokenQuery(token, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  const name = String(token?.name || "").toLowerCase();
  const symbol = String(token?.symbol || "").toLowerCase();
  const mint = String(token?.mint || "").toLowerCase();
  if (looksLikeMint(q)) return mint === q;
  return name.includes(q) || symbol.includes(q) || (q.startsWith("$") && symbol === q.slice(1));
}

export async function fetchDexPairs(mints) {
  const uniq = [...new Set((mints || []).filter(Boolean))].slice(0, TRENDING_LIMIT);
  if (!uniq.length) return [];
  const chunks = [];
  for (let i = 0; i < uniq.length; i += 30) chunks.push(uniq.slice(i, i + 30));
  const out = [];
  for (let i = 0; i < chunks.length; i += 3) {
    const batch = chunks.slice(i, i + 3);
    const results = await Promise.all(
      batch.map((chunk) => timed(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(",")}`)),
    );
    for (const j of results) {
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
  }
  return out;
}

export async function fetchDexBoosts(limit = 50) {
  const j = await timed("https://api.dexscreener.com/token-boosts/top/v1");
  const rows = Array.isArray(j) ? j : [];
  return rows
    .filter((r) => r?.chainId === "solana" && r.tokenAddress)
    .slice(0, limit)
    .map((r) => r.tokenAddress);
}

export async function fetchDexBoostsLatest(limit = 40) {
  const j = await timed("https://api.dexscreener.com/token-boosts/latest/v1");
  const rows = Array.isArray(j) ? j : [];
  return rows
    .filter((r) => r?.chainId === "solana" && r.tokenAddress)
    .slice(0, limit)
    .map((r) => r.tokenAddress);
}

export async function fetchDexProfiles() {
  const j = await timed("https://api.dexscreener.com/token-profiles/latest/v1");
  const rows = Array.isArray(j) ? j : [];
  return rows
    .filter((r) => r?.chainId === "solana" && r.tokenAddress)
    .map((r) => ({
      mint: r.tokenAddress,
      image: r.icon || dexTokenImage(r.tokenAddress),
      banner: r.header || null,
      name: null,
      symbol: null,
      source: "dexscreener-profile",
      kind: "token",
    }));
}

export async function fetchPumpTrending(limit = 50) {
  const pages = Math.min(3, Math.ceil(limit / 50));
  const out = [];
  for (let page = 0; page < pages; page++) {
    const j = await timed(
      `https://frontend-api-v3.pump.fun/coins?limit=${Math.min(50, limit)}&offset=${page * 50}&sort=last_trade_timestamp&order=DESC&includeNsfw=false`,
    );
    const coins = Array.isArray(j) ? j : (j?.coins || []);
    for (const c of coins) {
      const d = pumpToDistrict(c);
      if (d) out.push(d);
    }
  }
  return out.slice(0, limit);
}

export async function fetchJupiterTopTraded(limit = TRENDING_LIMIT) {
  const urls = [
    `https://lite-api.jup.ag/tokens/v2/toptraded/24h?limit=${limit}`,
    `https://api.jup.ag/tokens/v2/toptraded/24h?limit=${limit}`,
  ];
  for (const url of urls) {
    const j = await timed(url, 6000);
    const rows = Array.isArray(j) ? j : (j?.tokens || []);
    if (rows.length) return rows.map(jupToDistrict).filter(Boolean);
  }
  return [];
}

export async function fetchGeckoTrending(pages = 4) {
  const out = [];
  for (let page = 1; page <= pages; page++) {
    const j = await timed(
      `https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=${page}`,
      5500,
    );
    const data = Array.isArray(j?.data) ? j.data : [];
    const included = Array.isArray(j?.included) ? j.included : [];
    const tokenMap = {};
    for (const row of included) {
      if (row?.id) tokenMap[row.id] = row.attributes || {};
    }
    for (const item of data) {
      const d = geckoPoolToMint(item, tokenMap);
      if (d) out.push(d);
    }
    if (!data.length) break;
  }
  return out;
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

function orbitxFallback() {
  return {
    mint: ORBITX_MINT,
    symbol: "ORBITX",
    name: "OrbitX",
    image: dexTokenImage(ORBITX_MINT),
    banner: null,
    price_usd: null,
    market_cap: null,
    liquidity_usd: null,
    volume_24h: null,
    change_24h: null,
    change_1h: null,
    holder_count: null,
    dex: null,
    source: "orbitx",
    kind: "orbitx",
  };
}

export async function loadCityDistricts(extraMints = []) {
  const [orbitxDex, boosts, latestBoosts, profiles, pump, gecko, jupiter] = await Promise.all([
    fetchDexPairs([ORBITX_MINT]).catch(() => []),
    fetchDexBoosts(50).catch(() => []),
    fetchDexBoostsLatest(40).catch(() => []),
    fetchDexProfiles().catch(() => []),
    fetchPumpTrending(80).catch(() => []),
    fetchGeckoTrending(6).catch(() => []),
    fetchJupiterTopTraded(400).catch(() => []),
  ]);

  const want = [
    ...MAJOR_MINTS.filter((m) => m !== ORBITX_MINT),
    ...boosts,
    ...latestBoosts,
    ...profiles.map((p) => p.mint),
    ...extraMints,
    ...pump.map((d) => d.mint),
    ...gecko.map((d) => d.mint),
    ...jupiter.map((d) => d.mint),
  ];

  const dex = await fetchDexPairs(want);
  const byMint = new Map();
  for (const d of [...jupiter, ...gecko, ...pump, ...dex, ...profiles, ...orbitxDex]) {
    if (!d?.mint) continue;
    byMint.set(d.mint, mergeDistrict(byMint.get(d.mint), d));
  }

  const orbitx = mergeDistrict(orbitxFallback(), byMint.get(ORBITX_MINT)) || orbitxFallback();
  orbitx.kind = "orbitx";
  orbitx.source = orbitx.source || "orbitx";
  orbitx.name = "OrbitX";
  orbitx.symbol = "ORBITX";

  const tokens = rankTrending([...byMint.values()], TRENDING_LIMIT);
  return {
    orbitx,
    hubs: DEX_HUBS,
    tokens,
    trending_count: tokens.length,
    window: "24h",
  };
}
