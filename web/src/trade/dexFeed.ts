/* DexScreener feed — REAL data from the DexScreener public API only.
 * No keys, no invented numbers. Every fetch returns { coins, error }:
 * on any failure `error` is set and the UI shows "feed unreachable" —
 * the feed never fabricates rows.
 *
 * DexScreener has no public "trending" endpoint, so trending is computed
 * here from real signals: the top-boosted token list
 * (token-boosts/top/v1) + latest token profiles, enriched with live
 * pair data (tokens/v1) and ranked by 24h volume + txns + price move.
 *
 * Boosts come from the Supabase `dex_boosts` table (public read, ACTIVE
 * only) via the shared client in @/lib/supabase — the same pattern as
 * @/lib/dexAds. If the table / migration doesn't exist yet, or the
 * query fails for any reason, fetchActiveBoosts resolves to [] and the
 * boosts section renders its empty state. It never throws.
 */
import { supabase } from "@/lib/supabase";
import type { DexBoost } from "@/lib/dexAds";
import { pickTokenImage, type MarketCoin } from "./tradeApi";

export type { DexBoost };

export type DexFeedResult = {
  coins: MarketCoin[];
  /** Non-null when the feed could not be reached — UI shows "feed unreachable". */
  error: string | null;
};

const DEX = "https://api.dexscreener.com";
const FEED_ERROR = "Feed unreachable — DexScreener did not respond.";

async function dexJson(url: string): Promise<any | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ── Image resolution ────────────────────────────────────────────── */

/**
 * Resolve a token image URL from any DexScreener-shaped payload
 * (pair.info.imageUrl, token-profile icon, MarketCoin.image, …).
 * Returns null when there is no image — callers fall back to the
 * initials tile (TokenAvatar), never a broken <img> or stock photo.
 */
export function resolveTokenImage(raw: unknown): string | null {
  if (typeof raw === "string") {
    const s = raw.trim();
    return s && s !== "missing.png" ? s : null;
  }
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  // Token profiles carry `icon`; pairs carry `info.imageUrl`.
  if (typeof rec.icon === "string" && rec.icon.trim()) return rec.icon.trim();
  return pickTokenImage(raw);
}

/** Initials for the fallback tile when no image exists. */
export function tokenInitials(symbol?: string | null, mint?: string | null): string {
  const s = (symbol || "").trim();
  if (s) return s.slice(0, 2).toUpperCase();
  const m = (mint || "").trim();
  if (m.length >= 2) return m.slice(0, 2).toUpperCase();
  return "?";
}

/* ── Mapping DexScreener payloads → MarketCoin ───────────────────── */

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** One DexScreener pair (search / tokens endpoints) → MarketCoin. */
export function mapDexPairToCoin(pair: any): MarketCoin | null {
  const mint = String(pair?.baseToken?.address || "").trim();
  if (!mint) return null;
  const txns = pair?.txns?.h24;
  const txns24h = txns ? num(txns.buys) + num(txns.sells) : undefined;
  const createdMs = Number(pair?.pairCreatedAt);
  return {
    mint,
    symbol: pair.baseToken?.symbol || "???",
    name: pair.baseToken?.name || pair.baseToken?.symbol || "",
    image: resolveTokenImage(pair) ?? undefined,
    price: num(pair?.priceUsd),
    mcap: num(pair?.marketCap ?? pair?.fdv),
    change24h: num(pair?.priceChange?.h24),
    change1h: pair?.priceChange?.h1 != null ? num(pair.priceChange.h1) : undefined,
    volume24h: num(pair?.volume?.h24),
    liquidity: num(pair?.liquidity?.usd),
    pairAddress: pair?.pairAddress ? String(pair.pairAddress) : undefined,
    chain: pair?.chainId ? String(pair.chainId) : undefined,
    dexId: pair?.dexId ? String(pair.dexId) : undefined,
    createdAt: Number.isFinite(createdMs) && createdMs > 0 ? new Date(createdMs).toISOString() : null,
    txns24h: txns24h != null && txns24h > 0 ? txns24h : undefined,
  };
}

/**
 * One token-profile row (token-profiles/latest/v1) → MarketCoin.
 * Profiles carry no symbol/name/price — those fields stay empty/zero
 * until the row is enriched with live pair data (enrichWithPairs).
 * The token itself is real: chain + icon + address are genuine.
 */
export function mapTokenProfileToCoin(profile: any): MarketCoin | null {
  const mint = String(profile?.tokenAddress || "").trim();
  if (!mint) return null;
  return {
    mint,
    symbol: "",
    name: "",
    image: resolveTokenImage(profile) ?? undefined,
    price: 0,
    mcap: 0,
    change24h: 0,
    volume24h: 0,
    liquidity: 0,
    chain: profile?.chainId ? String(profile.chainId) : undefined,
    createdAt: null,
  };
}

function dedupeByMint(coins: MarketCoin[]): MarketCoin[] {
  const seen = new Set<string>();
  return coins.filter((c) => {
    if (seen.has(c.mint)) return false;
    seen.add(c.mint);
    return true;
  });
}

/**
 * Enrich profile-only coins with live pair data via tokens/v1.
 * One batched request per chain (max 30 mints each). Pairs are picked
 * by highest liquidity. Coins with no live pair keep their profile
 * data (symbol stays blank → UI shows a shortened mint).
 */
async function enrichWithPairs(coins: MarketCoin[]): Promise<MarketCoin[]> {
  const byChain = new Map<string, MarketCoin[]>();
  for (const c of coins) {
    const chain = (c.chain || "solana").toLowerCase();
    const list = byChain.get(chain) || [];
    list.push(c);
    byChain.set(chain, list);
  }
  const enriched = new Map<string, MarketCoin>();
  await Promise.all(
    [...byChain.entries()].map(async ([chain, list]) => {
      for (let i = 0; i < list.length; i += 30) {
        const chunk = list.slice(i, i + 30);
        const data = await dexJson(
          `${DEX}/tokens/v1/${encodeURIComponent(chain)}/${chunk.map((c) => c.mint).join(",")}`,
        );
        const pairs = Array.isArray(data) ? data : [];
        const best = new Map<string, any>();
        for (const p of pairs) {
          const mint = String(p?.baseToken?.address || "");
          if (!mint) continue;
          const prev = best.get(mint);
          if (!prev || num(p?.liquidity?.usd) > num(prev?.liquidity?.usd)) best.set(mint, p);
        }
        for (const c of chunk) {
          const pair = best.get(c.mint);
          enriched.set(c.mint, pair ? mapDexPairToCoin(pair) ?? c : c);
        }
      }
    }),
  );
  return coins.map((c) => enriched.get(c.mint) ?? c);
}

/* ── Feed fetches (all return { coins, error }) ─────────────────── */

/** Newest token profiles, newest first, enriched with live pair data. */
export async function fetchNewListings(limit = 30): Promise<DexFeedResult> {
  const data = await dexJson(`${DEX}/token-profiles/latest/v1`);
  if (!Array.isArray(data)) return { coins: [], error: FEED_ERROR };
  const profiles = data
    .map(mapTokenProfileToCoin)
    .filter((c): c is MarketCoin => c !== null)
    .slice(0, Math.max(1, limit));
  if (!profiles.length) return { coins: [], error: null };
  const coins = await enrichWithPairs(profiles);
  return { coins, error: null };
}

/**
 * Trending tokens, ranked by 24h volume + txns + price move.
 * Seeds: top-boosted tokens + latest profiles, enriched with live
 * pair data, then ranked by rankTrending. No endpoint is faked.
 */
export async function fetchTrendingCoins(limit = 20): Promise<DexFeedResult> {
  const [boosts, profiles] = await Promise.all([
    dexJson(`${DEX}/token-boosts/top/v1`),
    dexJson(`${DEX}/token-profiles/latest/v1`),
  ]);
  const seeds: MarketCoin[] = [];
  if (Array.isArray(boosts)) {
    for (const b of boosts) {
      const mint = String(b?.tokenAddress || "").trim();
      const chain = String(b?.chainId || "solana").trim();
      if (mint) seeds.push({ mint, symbol: "", name: "", price: 0, mcap: 0, change24h: 0, volume24h: 0, liquidity: 0, chain });
    }
  }
  if (Array.isArray(profiles)) {
    for (const p of profiles) {
      const c = mapTokenProfileToCoin(p);
      if (c) seeds.push(c);
    }
  }
  const unique = dedupeByMint(seeds).slice(0, 60);
  if (!unique.length) return { coins: [], error: FEED_ERROR };
  const enriched = await enrichWithPairs(unique);
  // Only rank coins that actually have live pair data.
  const live = enriched.filter((c) => c.volume24h > 0 || c.price > 0 || c.liquidity > 0);
  if (!live.length) return { coins: [], error: FEED_ERROR };
  return { coins: rankTrending(live).slice(0, Math.max(1, limit)), error: null };
}

/** Live pairs for an explicit mint list (used to resolve boost mints). */
export async function fetchTokenPairs(mints: string[]): Promise<DexFeedResult> {
  const clean = [...new Set(mints.map((m) => String(m || "").trim()).filter(Boolean))];
  if (!clean.length) return { coins: [], error: null };
  const seeds: MarketCoin[] = clean.map((mint) => ({
    mint, symbol: "", name: "", price: 0, mcap: 0, change24h: 0, volume24h: 0, liquidity: 0, chain: "solana",
  }));
  const coins = await enrichWithPairs(seeds);
  const live = coins.filter((c) => c.price > 0 || c.symbol);
  return { coins: live, error: live.length ? null : FEED_ERROR };
}

/** DexScreener public search → best pair per mint. */
export async function searchDexTokens(q: string): Promise<DexFeedResult> {
  const query = q.trim();
  if (query.length < 2) return { coins: [], error: null };
  const data = await dexJson(`${DEX}/latest/dex/search?q=${encodeURIComponent(query)}`);
  if (!data || !Array.isArray(data.pairs)) return { coins: [], error: FEED_ERROR };
  const coins = dedupeByMint(
    data.pairs.map(mapDexPairToCoin).filter((c): c is MarketCoin => c !== null),
  );
  return { coins, error: null };
}

/* ── Ranking / filtering (pure — unit-tested) ───────────────────── */

/**
 * Trending score: log-scaled 24h volume + log-scaled 24h txns +
 * capped absolute 24h move, so a high-volume token with real activity
 * outranks a thin token with one wild print.
 */
export function trendingScore(c: MarketCoin): number {
  return (
    Math.log10(1 + Math.max(0, c.volume24h)) +
    Math.log10(1 + Math.max(0, c.txns24h ?? 0)) +
    Math.min(Math.abs(c.change24h || 0), 200) / 100
  );
}

export function rankTrending(coins: MarketCoin[]): MarketCoin[] {
  return [...coins].sort((a, b) => trendingScore(b) - trendingScore(a));
}

/** True when the pair was created less than 1h ago (the "NEW" badge). */
export function isNewPair(coin: MarketCoin, now = Date.now()): boolean {
  if (!coin.createdAt) return false;
  const ms = new Date(coin.createdAt).getTime();
  if (!Number.isFinite(ms)) return false;
  return now - ms < 60 * 60 * 1000 && now - ms >= 0;
}

export type DexFilterState = {
  chain: string;
  dexId: string;
  minLiquidity: number | null;
  minMcap: number | null;
  minVolume24h: number | null;
  maxAgeHours: number | null;
  minTxns24h: number | null;
};

export const DEFAULT_DEX_FILTERS: DexFilterState = {
  chain: "",
  dexId: "",
  minLiquidity: null,
  minMcap: null,
  minVolume24h: null,
  maxAgeHours: null,
  minTxns24h: null,
};

export function countActiveFilters(f: DexFilterState): number {
  let n = 0;
  if (f.chain) n++;
  if (f.dexId) n++;
  if (f.minLiquidity != null) n++;
  if (f.minMcap != null) n++;
  if (f.minVolume24h != null) n++;
  if (f.maxAgeHours != null) n++;
  if (f.minTxns24h != null) n++;
  return n;
}

export function applyDexFilters(coins: MarketCoin[], f: DexFilterState, now = Date.now()): MarketCoin[] {
  return coins.filter((c) => {
    if (f.chain && (c.chain || "").toLowerCase() !== f.chain.toLowerCase()) return false;
    if (f.dexId && (c.dexId || "").toLowerCase() !== f.dexId.toLowerCase()) return false;
    if (f.minLiquidity != null && c.liquidity < f.minLiquidity) return false;
    if (f.minMcap != null && c.mcap < f.minMcap) return false;
    if (f.minVolume24h != null && c.volume24h < f.minVolume24h) return false;
    if (f.minTxns24h != null && (c.txns24h ?? 0) < f.minTxns24h) return false;
    if (f.maxAgeHours != null) {
      if (!c.createdAt) return false;
      const ms = new Date(c.createdAt).getTime();
      if (!Number.isFinite(ms) || now - ms > f.maxAgeHours * 60 * 60 * 1000) return false;
    }
    return true;
  });
}

/* ── Boosts (Supabase dex_boosts, ACTIVE only) ──────────────────── */

function inBoostWindow(row: DexBoost): boolean {
  const now = Date.now();
  if (row.starts_at && new Date(row.starts_at).getTime() > now) return false;
  if (row.ends_at && new Date(row.ends_at).getTime() <= now) return false;
  return true;
}

/**
 * Active boosts, newest first. Graceful degradation by design:
 * unconfigured Supabase, missing table (migration not applied),
 * RLS denial, network failure — all resolve to [] (empty state),
 * never throw, never crash the section.
 */
export async function fetchActiveBoosts(): Promise<DexBoost[]> {
  try {
    const { data, error } = await supabase
      .from("dex_boosts")
      .select("id, mint, tier, starts_at, ends_at, status")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error || !Array.isArray(data)) return [];
    return (data as DexBoost[]).filter(inBoostWindow);
  } catch {
    return [];
  }
}
