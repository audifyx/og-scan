/**
 * Fast token snapshot for Telegram — DexScreener + Jupiter, no self-HTTP.
 * The webhook must not call /api/ogdex/token (same Vercel isolation → empty TOKEN cards).
 */
import { normToken, num } from "../ogdex/_normalize.js";

export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const DEX_URL = "https://api.dexscreener.com/latest/dex/tokens/";
const JUP_URL = "https://lite-api.jup.ag/tokens/v2/search?query=";

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

export function looksLikeOrbitXCard(text) {
  const t = String(text || "");
  if (!t) return false;
  if (/TOKEN · \$TOKEN/i.test(t)) return true;
  if (/🚀 .+\s·\s\$/.test(t) && /(Market Snapshot|Price Action|📊 Meta)/.test(t)) return true;
  if (/Whales\s+0 wallets/.test(t) && /DEX paid/.test(t) && /DexScreener/.test(t)) return true;
  if (/💰 Market Snapshot/.test(t) && /Security/.test(t)) return true;
  if (/^\$?TOKEN \(\$TOKEN\) is live on /i.test(t)) return true;
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

function withTimeout(ms) {
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    return AbortSignal.timeout(ms);
  }
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms);
  return ctrl.signal;
}

async function fetchJson(url, ms = 4500) {
  const r = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: withTimeout(ms),
  });
  if (!r.ok) throw new Error(`http ${r.status}`);
  return r.json();
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

export function mergeTokenSnapshot({ mint, jupRaw, dexRaw } = {}) {
  const known = hydrateKnownMint(mint) || {};
  const jupHit = Array.isArray(jupRaw)
    ? jupRaw.find((t) => String(t.id || t.mint) === mint) || jupRaw[0]
    : jupRaw && typeof jupRaw === "object"
      ? jupRaw
      : null;
  let token = jupHit ? normToken(jupHit, "24h") : null;
  if (token) token.chain = token.chain || "solana";
  const pair = pickDexPair(mint, dexRaw?.pairs);
  const dexToken = tokenFromDexPair(mint, pair);
  const socials = pair ? dexSocials(pair) : {};
  if (known.website && !socials.website) socials.website = known.website;

  if (bestMerge(token, dexToken)) {
    token = overlayDex(token || dexToken, dexToken);
  } else if (dexToken) {
    token = dexToken;
  }
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

function bestMerge(jupToken, dexToken) {
  return Boolean(jupToken || dexToken);
}

function overlayDex(token, dexToken) {
  if (!dexToken) return token;
  const next = { ...token };
  if (next.priceUsd == null) next.priceUsd = dexToken.priceUsd;
  if (!next.volume) next.volume = dexToken.volume;
  if (!next.liquidity) next.liquidity = dexToken.liquidity;
  if (!next.mcap) next.mcap = dexToken.mcap;
  if (!next.fdv) next.fdv = dexToken.fdv;
  if (next.change24h == null) next.change24h = dexToken.change24h;
  if (next.change1h == null) next.change1h = dexToken.change1h;
  if (next.change6h == null) next.change6h = dexToken.change6h;
  if (next.change5m == null) next.change5m = dexToken.change5m;
  if (!next.icon) next.icon = dexToken.icon;
  if (!next.firstPool?.id) next.firstPool = dexToken.firstPool;
  if (!next.ageDays && dexToken.ageDays != null) {
    next.ageDays = dexToken.ageDays;
    next.createdAt = dexToken.createdAt;
  }
  if (!next.name) next.name = dexToken.name;
  if (!next.symbol) next.symbol = dexToken.symbol;
  return next;
}

export async function fetchTelegramTokenSnapshot(mint) {
  const id = String(mint || "").trim();
  if (!id) return null;
  const [jupRaw, dexRaw] = await Promise.all([
    fetchJson(`${JUP_URL}${encodeURIComponent(id)}`, 4500).catch(() => null),
    fetchJson(`${DEX_URL}${encodeURIComponent(id)}`, 4500).catch(() => null),
  ]);
  const merged = mergeTokenSnapshot({ mint: id, jupRaw, dexRaw });
  if (!hasTokenIdentity(merged.token) && !hasMarketSnapshot(merged.token) && !hydrateKnownMint(id)) {
    return { mint: id, token: merged.token, error: "token_not_found" };
  }
  return merged;
}
