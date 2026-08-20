/**
 * Fast token snapshot for Telegram — DexScreener + Jupiter + Gecko, no self-HTTP.
 * The webhook must not call /api/ogdex/* (same Vercel isolation starves outbound quotes).
 */
import { normToken, num } from "../ogdex/_normalize.js";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const DEX_LATEST = "https://api.dexscreener.com/latest/dex/tokens/";
const DEX_V1 = "https://api.dexscreener.com/tokens/v1/solana/";
const DEX_PAIRS = "https://api.dexscreener.com/token-pairs/v1/solana/";
const JUP_SEARCH = "https://lite-api.jup.ag/tokens/v2/search?query=";
const JUP_SEARCH_API = "https://api.jup.ag/tokens/v2/search?query=";
const JUP_PRICE = "https://lite-api.jup.ag/price/v3?ids=";
const JUP_PRICE_API = "https://api.jup.ag/price/v3?ids=";
const GECKO = "https://api.geckoterminal.com/api/v2/networks/solana/tokens/";
const JUP_PRICE_V6 = "https://price.jup.ag/v6/price?ids=";
const QUOTE_MS = 3500;

const FETCH_HEADERS = {
  Accept: "application/json",
};
const BROWSER_HEADERS = {
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
};
const GECKO_HEADERS = {
  Accept: "application/json;version=20230302",
};

const snapCache = new Map();

export const KNOWN_MINTS = {
  [ORBITX_MINT]: {
    name: "ORBITX",
    symbol: "ORBITX",
    chain: "solana",
    tags: ["token-2022"],
    tokenProgram: TOKEN_2022,
    website: "https://www.orbitx.world",
  },
};

export function hydrateKnownMint(mint) {
  return KNOWN_MINTS[String(mint || "").trim()] || null;
}

export function looksLikeFailedQuoteCard(text) {
  const t = String(text || "");
  if (!t) return false;
  if (/No live DexScreener\/Jupiter quote/i.test(t)) return true;
  if (/Live quote unavailable/i.test(t)) return true;
  if (/Couldn'?t reach DexScreener or Jupiter/i.test(t)) return true;
  if (/Won'?t invent a name, price, or whale count/i.test(t)) return true;
  return false;
}

export function looksLikeOrbitXCard(text) {
  const t = String(text || "");
  if (!t) return false;
  if (/TOKEN · \$TOKEN/i.test(t)) return true;
  if (/🚀 .+\s·\s\$/.test(t) && /(Market Snapshot|Price Action|📊 Meta)/.test(t)) return true;
  if (/Whales\s+0 wallets/.test(t) && /DEX paid/.test(t) && /DexScreener/.test(t)) return true;
  if (/💰 Market Snapshot/.test(t) && /Security/.test(t)) return true;
  if (/^\$?TOKEN \(\$TOKEN\) is live on /i.test(t)) return true;
  if (looksLikeFailedQuoteCard(t)) return true;
  return false;
}

export function hasMarketSnapshot(token) {
  if (!token || typeof token !== "object") return false;
  const finite = (v) => v != null && v !== "" && Number.isFinite(Number(v));
  if (finite(token.priceUsd) || finite(token.price)) return true;
  if (finite(token.mcap) && Number(token.mcap) > 0) return true;
  if (finite(token.fdv) && Number(token.fdv) > 0) return true;
  if (finite(token.liquidity) && Number(token.liquidity) > 0) return true;
  return false;
}

export function hasTokenIdentity(token) {
  if (!token || typeof token !== "object") return false;
  const mint = String(token.mint || "").trim();
  const name = String(token.name || "").trim();
  const symbol = String(token.symbol || "").trim();
  const dummy = (s) => !s || /^token$/i.test(s) || s === mint;
  return !dummy(name) || !dummy(symbol);
}

async function fetchJson(url, ms = QUOTE_MS, headers = FETCH_HEADERS) {
  const once = async (hdrs) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
      const r = await fetch(url, { headers: hdrs, signal: ctrl.signal });
      if (!r.ok) {
        const err = new Error(`http ${r.status}`);
        err.status = r.status;
        throw err;
      }
      return await r.json();
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await once(headers);
  } catch (err) {
    if (Number(err?.status) === 403 && headers !== BROWSER_HEADERS) {
      return once(BROWSER_HEADERS);
    }
    throw err;
  }
}

export function normalizeDexResponse(raw) {
  if (!raw) return { pairs: [] };
  if (Array.isArray(raw)) return { pairs: raw };
  if (Array.isArray(raw.pairs)) return raw;
  return { pairs: [] };
}

export function jupListFromRaw(jupRaw, mint) {
  if (!jupRaw) return null;
  if (Array.isArray(jupRaw)) return jupRaw.length ? jupRaw : null;
  if (Array.isArray(jupRaw.tokens)) return jupRaw.tokens;
  if (Array.isArray(jupRaw.data)) return jupRaw.data;
  const row = jupRaw[mint] || jupRaw.data?.[mint];
  if (row && typeof row === "object" && !Array.isArray(row) && (row.usdPrice != null || row.price != null || row.liquidity != null)) {
    return [
      {
        id: mint,
        mint,
        usdPrice: row.usdPrice ?? row.price,
        liquidity: row.liquidity,
        decimals: row.decimals,
        ...row,
      },
    ];
  }
  if (jupRaw.id || jupRaw.mint || jupRaw.usdPrice != null) return [jupRaw];
  return null;
}

export function tokenFromGecko(mint, geckoRaw) {
  const a = geckoRaw?.data?.attributes;
  if (!a || typeof a !== "object") return null;
  const icon = a.image_url && a.image_url !== "missing.png" ? a.image_url : null;
  return {
    mint,
    chain: "solana",
    name: a.name || null,
    symbol: a.symbol || null,
    icon,
    priceUsd: num(a.price_usd),
    mcap: num(a.market_cap_usd) || num(a.fdv_usd),
    fdv: num(a.fdv_usd),
    liquidity: num(a.total_reserve_in_usd),
    volume: num(a.volume_usd?.h24),
    holderCount: num(a.holders?.count ?? a.holders_count),
    isVerified: false,
    createdAt: null,
    ageDays: null,
    firstPool: null,
    audit: { mintAuthorityDisabled: null, freezeAuthorityDisabled: null },
    stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
  };
}

function dexSocials(pair) {
  const info = pair?.info || {};
  const socials = {};
  for (const s of info.socials || []) {
    const k = String(s.type || s.platform || "").toLowerCase();
    if (k.includes("twitter") || k === "x") socials.twitter = s.url;
    else if (k.includes("telegram")) socials.telegram = s.url;
  }
  const site = (info.websites || [])[0];
  if (site?.url) socials.website = site.url;
  return socials;
}

export function tokenFromDexPair(mint, pair) {
  if (!pair || typeof pair !== "object") return null;
  const createdAt = pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : null;
  const ageDays = pair.pairCreatedAt ? Math.max(0, Math.round((Date.now() - Number(pair.pairCreatedAt)) / 864e5)) : null;
  return {
    mint,
    chain: pair.chainId || "solana",
    name: pair.baseToken?.name || null,
    symbol: pair.baseToken?.symbol || null,
    icon: pair.info?.imageUrl || pair.info?.header || null,
    priceUsd: num(pair.priceUsd),
    mcap: num(pair.marketCap),
    fdv: num(pair.fdv),
    liquidity: num(pair.liquidity?.usd),
    volume: num(pair.volume?.h24),
    change5m: num(pair.priceChange?.m5),
    change1h: num(pair.priceChange?.h1),
    change6h: num(pair.priceChange?.h6),
    change24h: num(pair.priceChange?.h24),
    holderCount: null,
    isVerified: false,
    createdAt,
    ageDays,
    firstPool: pair.pairAddress ? { id: pair.pairAddress } : null,
    audit: { mintAuthorityDisabled: null, freezeAuthorityDisabled: null },
    stats: { "5m": {}, "1h": {}, "6h": {}, "24h": {} },
  };
}

export function pickDexPair(mint, pairs) {
  const list = Array.isArray(pairs) ? pairs : [];
  const base = list.filter((p) => String(p?.baseToken?.address || "") === mint);
  const pool = base.length ? base : list;
  return [...pool].sort((a, b) => (num(b.liquidity?.usd) || 0) - (num(a.liquidity?.usd) || 0))[0] || null;
}

export function mergeTokenSnapshot({ mint, jupRaw, dexRaw, geckoRaw } = {}) {
  const known = hydrateKnownMint(mint) || {};
  const jupList = jupListFromRaw(jupRaw, mint);
  const jupHit = Array.isArray(jupList)
    ? jupList.find((t) => String(t.id || t.mint) === mint) || jupList[0]
    : null;
  let token = null;
  try {
    token = jupHit ? normToken(jupHit, "24h") : null;
  } catch (error) {
    console.warn("[telegram-token-snapshot] normToken", error?.message || error);
    token = null;
  }
  if (token) token.chain = token.chain || "solana";
  const pair = pickDexPair(mint, normalizeDexResponse(dexRaw).pairs);
  const dexToken = tokenFromDexPair(mint, pair);
  const geckoToken = tokenFromGecko(mint, geckoRaw);
  const socials = pair ? dexSocials(pair) : {};
  if (known.website && !socials.website) socials.website = known.website;

  if (token || dexToken) token = overlayDex(token || dexToken, dexToken);
  if (geckoToken) token = overlayDex(token || geckoToken, geckoToken);
  if (!token) token = { mint, chain: "solana" };
  if (known.name && (!token.name || /^token$/i.test(token.name))) token.name = known.name;
  if (known.symbol && (!token.symbol || /^token$/i.test(token.symbol))) token.symbol = known.symbol;
  if (known.tags && !token.tags?.length) token.tags = known.tags;
  if (known.tokenProgram && !token.tokenProgram) token.tokenProgram = known.tokenProgram;
  if (known.chain && !token.chain) token.chain = known.chain;
  token.mint = mint;
  const jupAudit = jupHit?.audit && typeof jupHit.audit === "object" ? jupHit.audit : null;
  if (token.audit) {
    if (!jupAudit || !("mintAuthorityDisabled" in jupAudit)) token.audit.mintAuthorityDisabled = null;
    if (!jupAudit || !("freezeAuthorityDisabled" in jupAudit)) token.audit.freezeAuthorityDisabled = null;
  }

  return {
    mint,
    token,
    chain: token.chain || "solana",
    meta: {
      chain: token.chain || "solana",
      socials,
      ageDays: token.ageDays ?? null,
      createdAt: token.createdAt ?? null,
      name: token.name,
      symbol: token.symbol,
    },
  };
}

export function firstDexPairs(...raws) {
  for (const raw of raws) {
    const norm = normalizeDexResponse(raw);
    if (norm.pairs.length) return norm;
  }
  return { pairs: [] };
}

function missingUsd(value) {
  const n = Number(value);
  return value == null || value === "" || !Number.isFinite(n) || n <= 0;
}

export function overlayJupiterPrice(token, priceRaw, mint) {
  if (!token || !priceRaw || typeof priceRaw !== "object") return token;
  const row =
    priceRaw[mint] ||
    priceRaw.data?.[mint] ||
    (priceRaw.usdPrice != null || priceRaw.price != null ? priceRaw : null);
  if (!row || typeof row !== "object" || Array.isArray(row)) return token;
  const next = { ...token };
  const usd = num(row.usdPrice ?? row.price);
  if (missingUsd(next.priceUsd) && usd && usd > 0) next.priceUsd = usd;
  if (!next.liquidity) next.liquidity = num(row.liquidity);
  if (next.change24h == null) next.change24h = num(row.priceChange24h);
  if (next.decimals == null) next.decimals = num(row.decimals);
  return next;
}

export function assembleTelegramSnapshot(id, bundle = {}) {
  const jupSearch = jupListFromRaw(bundle.jupSearch, id);
  const jupPrice =
    jupListFromRaw(bundle.jupPriceLite, id) || jupListFromRaw(bundle.jupPriceApi, id);
  const jupRaw = jupSearch || jupPrice;
  const dexRaw = firstDexPairs(bundle.dexLatest, bundle.dexV1, bundle.dexPairs);
  const merged = mergeTokenSnapshot({ mint: id, jupRaw, dexRaw, geckoRaw: bundle.gecko });
  if (merged?.token) {
    merged.token = overlayJupiterPrice(merged.token, bundle.jupPriceLite, id);
    merged.token = overlayJupiterPrice(merged.token, bundle.jupPriceApi, id);
    merged.token = overlayJupiterPrice(merged.token, bundle.jupV6, id);
  }
  return merged;
}

function overlayDex(token, extra) {
  if (!extra) return token;
  const next = { ...token };
  if (next.priceUsd == null) next.priceUsd = extra.priceUsd;
  if (!next.volume) next.volume = extra.volume;
  if (!next.liquidity) next.liquidity = extra.liquidity;
  if (!next.mcap) next.mcap = extra.mcap;
  if (!next.fdv) next.fdv = extra.fdv;
  if (next.change24h == null) next.change24h = extra.change24h;
  if (next.change1h == null) next.change1h = extra.change1h;
  if (next.change6h == null) next.change6h = extra.change6h;
  if (next.change5m == null) next.change5m = extra.change5m;
  if (!next.icon) next.icon = extra.icon;
  if (!next.firstPool?.id) next.firstPool = extra.firstPool;
  if (!next.ageDays && extra.ageDays != null) {
    next.ageDays = extra.ageDays;
    next.createdAt = extra.createdAt;
  }
  if (!next.name) next.name = extra.name;
  if (!next.symbol) next.symbol = extra.symbol;
  if (next.holderCount == null) next.holderCount = extra.holderCount;
  return next;
}

export function clearTelegramSnapshotCache() {
  snapCache.clear();
}

function warnQuote(source, err) {
  console.warn("[telegram-token-snapshot]", source, err?.message || err);
  return null;
}

async function fetchQuoteBundle(id, urls) {
  const q = encodeURIComponent(id);
  const tasks = [
    ["jupSearch", fetchJson(`${urls.search}${q}`, QUOTE_MS)],
    ["jupPriceLite", fetchJson(`${urls.priceLite}${q}`, QUOTE_MS)],
    ["jupPriceApi", urls.priceApi ? fetchJson(`${urls.priceApi}${q}`, QUOTE_MS) : Promise.resolve(null)],
    ["jupV6", fetchJson(`${JUP_PRICE_V6}${q}`, QUOTE_MS)],
    ["dexLatest", fetchJson(`${DEX_LATEST}${q}`, QUOTE_MS)],
    ["dexV1", fetchJson(`${DEX_V1}${q}`, QUOTE_MS)],
    ["dexPairs", fetchJson(`${DEX_PAIRS}${q}`, QUOTE_MS)],
    ["gecko", fetchJson(`${GECKO}${q}`, QUOTE_MS, GECKO_HEADERS)],
  ];
  const entries = await Promise.all(
    tasks.map(async ([key, pending]) => [key, await pending.catch((err) => warnQuote(key, err))]),
  );
  return Object.fromEntries(entries);
}

export async function fetchTelegramTokenSnapshot(mint) {
  const id = String(mint || "").trim();
  if (!id) return null;
  const cached = snapCache.get(id);
  if (cached && Date.now() - cached.at < 20_000 && hasMarketSnapshot(cached.data?.token)) {
    return cached.data;
  }

  let merged = assembleTelegramSnapshot(
    id,
    await fetchQuoteBundle(id, {
      search: JUP_SEARCH,
      priceLite: JUP_PRICE,
      priceApi: JUP_PRICE_API,
    }),
  );

  if (!hasMarketSnapshot(merged?.token)) {
    await new Promise((resolve) => setTimeout(resolve, 280));
    const retry = assembleTelegramSnapshot(
      id,
      await fetchQuoteBundle(id, {
        search: JUP_SEARCH_API,
        priceLite: JUP_PRICE_API,
        priceApi: JUP_PRICE,
      }),
    );
    if (hasMarketSnapshot(retry?.token)) merged = retry;
  }

  if (!hasTokenIdentity(merged.token) && !hasMarketSnapshot(merged.token) && !hydrateKnownMint(id)) {
    return { mint: id, token: merged.token, error: "token_not_found" };
  }
  if (hasMarketSnapshot(merged.token)) {
    snapCache.set(id, { at: Date.now(), data: merged });
    if (snapCache.size > 200) {
      const cutoff = Date.now() - 60_000;
      for (const [k, v] of snapCache) {
        if (v.at < cutoff) snapCache.delete(k);
      }
    }
  } else {
    console.warn("[telegram-token-snapshot] no market", id);
  }
  return merged;
}
