/**
 * /replay-trades — Time-windowed trade history for the Sandbox launch replay.
 *
 * WHY THIS EXISTS: the replay needs every buy/sell between pair creation and
 * now, but GeckoTerminal's public /pools/{pool}/trades returns a FIXED window
 * of the 300 most recent trades and IGNORES `page` and `before_timestamp`
 * (verified live 2026-11-08: pages 1/2/3/20 return the identical 300, ~59s of
 * trading on a busy pool). So the replay's trades never reached the launch
 * window and buys/sells read 0 while candles moved. DexScreener has NO
 * trades/candles endpoint, so the real provider is Birdeye.
 *
 * PRIMARY — Birdeye V3 GET /defi/v3/token/txs (12 CU/req, limit 1–100):
 *   address=<mint>, pool_id=<pair>, tx_type=all, sort_by=block_unix_time,
 *   sort_type=desc, before_time + after_time (unix seconds, window ≤ 30d),
 *   offset paging inside the window. Side-aware buy/sell, owner + pool
 *   filters. Walked backwards until the window is exhausted or the caps
 *   hit (~5,000 trades / ~50 pages / 25s budget, ~0.6s between calls for the
 *   free-tier 1 rps limit).
 * FALLBACK 1 — legacy GET /defi/txs/token/seek_by_time (12 CU/req): used
 *   when V3 answers 422/400. Docs conflict on whether the legacy endpoint
 *   accepts BOTH before_time and after_time (official docs say yes,
 *   community reports say it 422s) — so we try both-bounds first, and on a
 *   422 retry the same page with after_time-only + offset paging, filtering
 *   to the window client-side.
 * FALLBACK 2 — GeckoTerminal recent trades (keyless, same 300-newest
 *   window the client used to hit directly): used when the Birdeye key is
 *   missing or Birdeye fails. Reported as source "geckoterminal-recent"
 *   with coversWindow:false — NEVER faked as full-window coverage.
 *
 * CACHING (free tier is 30,000 CU/month): complete Birdeye windows are
 * cached in KV keyed by mint+pair+5-minute-bucketed window (1h TTL), so
 * repeat loads of the same replay cost 0 CU. Partial (truncated) windows
 * are NOT cached. Responses also carry Cache-Control (300s for Birdeye,
 * 60s for the GeckoTerminal fallback).
 *
 * The key comes from process.env.BIRDEYE_API_KEY || REACT_APP_BIRDEYE_API_KEY
 * (same pattern as _research.js). It is never logged, never returned, and
 * never leaves the server.
 */
import { send, cache, kvGet, kvPut } from "../_lib.js";

const BIRDEYE_KEY = process.env.BIRDEYE_API_KEY || process.env.REACT_APP_BIRDEYE_API_KEY || "";
const BIRDEYE_BASE = "https://public-api.birdeye.so";
const GT_BASE = "https://api.geckoterminal.com/api/v2";

/** Walk caps: trades / pages / wall-clock budget per request. */
export const REPLAY_MAX_TRADES = 5000;
export const REPLAY_MAX_PAGES = 50;
export const REPLAY_BUDGET_MS = 25_000;
/** Delay between Birdeye calls (free tier is 1 rps; 0.6s keeps bursts safe). */
export const REPLAY_PAGE_DELAY_MS = 600;
/** Birdeye windows are ≤ 30 days. */
export const REPLAY_MAX_WINDOW_MS = 30 * 24 * 3600_000;
/** Cache bucket: `to` is floored to 5 min so repeat loads hit KV. */
export const REPLAY_CACHE_BUCKET_MS = 5 * 60_000;
export const REPLAY_CACHE_TTL_MS = 60 * 60_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** KV key for a completed Birdeye window. */
export function buildCacheKey(mint, pair, fromMs, toMs) {
  const fromB = Math.floor(fromMs / REPLAY_CACHE_BUCKET_MS) * REPLAY_CACHE_BUCKET_MS;
  const toB = Math.floor(toMs / REPLAY_CACHE_BUCKET_MS) * REPLAY_CACHE_BUCKET_MS;
  return `replay-trades/${mint}__${pair || "auto"}__${fromB}__${toB}.json`;
}

// ── Normalizers (pure, unit-tested in _replay.test.js) ───────────────────────

/**
 * Side of a Birdeye trade. Both endpoints carry a `side` field ("buy" /
 * "sell"); V3 also has `tx_type`. Anything else (add/remove/swap without a
 * side) is unclassifiable — dropped, never guessed.
 */
export function tradeSideOf(item) {
  const s = item?.side ?? item?.tx_type ?? item?.txType;
  return s === "buy" || s === "sell" ? s : null;
}

/** USD price of the mint leg of a Birdeye trade (from/to/base/quote). */
export function legPriceForMint(item, mint) {
  for (const leg of [item?.from, item?.to, item?.base, item?.quote]) {
    if (leg && typeof leg === "object" && leg.address === mint) {
      const p = num(leg.price);
      if (p != null && p > 0) return p;
    }
  }
  const bp = num(item?.basePrice);
  return bp != null && bp > 0 ? bp : null;
}

/** Normalize one Birdeye V3 token-tx item (snake_case) into a ReplayTrade. */
export function normalizeBirdeyeV3Trade(item, mint) {
  if (!item || typeof item !== "object") return null;
  const kind = tradeSideOf(item);
  if (!kind) return null;
  const ts = num(item.block_unix_time);
  if (ts == null || ts <= 0) return null;
  const vol = num(item.volume_usd);
  return {
    txHash: typeof item.tx_hash === "string" ? item.tx_hash : "",
    timeMs: ts * 1000,
    maker: typeof item.owner === "string" ? item.owner : null,
    kind,
    priceUsd: legPriceForMint(item, mint),
    volumeUsd: vol != null && vol >= 0 ? vol : null,
  };
}

/** Normalize one legacy seek_by_time item (camelCase) into a ReplayTrade. */
export function normalizeBirdeyeSeekTrade(item, mint) {
  if (!item || typeof item !== "object") return null;
  const kind = tradeSideOf(item);
  if (!kind) return null;
  const ts = num(item.blockUnixTime);
  if (ts == null || ts <= 0) return null;
  // Legacy items carry no volume_usd — value = mint-leg uiAmount × leg price.
  let volumeUsd = null;
  for (const leg of [item.base, item.quote]) {
    if (leg && typeof leg === "object" && leg.address === mint) {
      const amt = num(leg.uiAmount);
      const p = num(leg.price);
      if (amt != null && p != null) volumeUsd = amt * p;
      break;
    }
  }
  return {
    txHash: typeof item.txHash === "string" ? item.txHash : "",
    timeMs: ts * 1000,
    maker: typeof item.owner === "string" ? item.owner : null,
    kind,
    priceUsd: legPriceForMint(item, mint),
    volumeUsd: volumeUsd != null && volumeUsd >= 0 ? volumeUsd : null,
  };
}

/** Normalize a Birdeye response body ({ data: { items: [...] } }). */
export function normalizeBirdeyeList(raw, mint, normalizeOne) {
  const items = raw && typeof raw === "object" ? raw?.data?.items : null;
  if (!Array.isArray(items)) return [];
  const out = [];
  for (const it of items) {
    const t = normalizeOne(it, mint);
    if (t) out.push(t);
  }
  return out;
}

/** Normalize one GeckoTerminal trade row (same shape as the client hook). */
export function normalizeGeckoTrade(raw) {
  if (!raw || typeof raw !== "object") return null;
  const attrs = raw.attributes;
  if (!attrs || typeof attrs !== "object") return null;
  const ts = Date.parse(String(attrs.block_timestamp ?? ""));
  if (!Number.isFinite(ts)) return null;
  const kind = attrs.kind === "sell" ? "sell" : attrs.kind === "buy" ? "buy" : null;
  if (!kind) return null;
  const price = num(attrs.price_to_in_usd ?? attrs.price_from_in_usd ?? NaN);
  const vol = num(attrs.volume_in_usd ?? NaN);
  return {
    txHash: String(attrs.tx_hash ?? raw.id ?? ""),
    timeMs: ts,
    maker: typeof attrs.tx_from_address === "string" ? attrs.tx_from_address : null,
    kind,
    priceUsd: price != null && price > 0 ? price : null,
    volumeUsd: vol != null && vol >= 0 ? vol : null,
  };
}

export function normalizeGeckoTradeList(raw) {
  const data = raw && typeof raw === "object" ? raw.data : null;
  if (!Array.isArray(data)) return [];
  return data.map(normalizeGeckoTrade).filter((t) => t != null);
}

/** De-dupe by txHash, oldest-first. */
export function dedupeTrades(trades) {
  const seen = new Set();
  const out = [];
  for (const t of trades) {
    const key = t.txHash || `${t.timeMs}-${t.maker}-${t.volumeUsd}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.sort((a, b) => a.timeMs - b.timeMs);
}

// ── Birdeye walk ─────────────────────────────────────────────────────────────

/**
 * One Birdeye GET. Returns { status, ok, body } or throws on transport error.
 * `fetchImpl` is injectable for tests.
 */
async function birdeyeGet(path, fetchImpl, timeoutMs = 10_000) {
  const res = await fetchImpl(`${BIRDEYE_BASE}${path}`, {
    headers: { "X-API-KEY": BIRDEYE_KEY, Accept: "application/json", "x-chain": "solana" },
    signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : undefined,
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, ok: res.ok, body };
}

/**
 * Walk Birdeye for trades of `mint` in [fromSec, toSec] (unix seconds).
 * Returns { trades, coversWindow, truncated, error }.
 * - coversWindow: the API answered the whole window (walk exhausted
 *   without hitting a cap). A truncated walk reports false — never faked.
 * - error: short human-readable reason when Birdeye could not be used at
 *   all (never includes the key). Null on success, even with 0 trades.
 */
export async function fetchBirdeyeTrades(input, deps = {}) {
  const { mint, pair = null, fromSec, toSec } = input;
  const fetchImpl = deps.fetchImpl || fetch;
  const sleepImpl = deps.sleepImpl || sleep;
  const deadline = Date.now() + (deps.budgetMs ?? REPLAY_BUDGET_MS);
  const maxTrades = deps.maxTrades ?? REPLAY_MAX_TRADES;
  const maxPages = deps.maxPages ?? REPLAY_MAX_PAGES;
  const delayMs = deps.pageDelayMs ?? REPLAY_PAGE_DELAY_MS;

  const base = new URLSearchParams({
    address: mint,
    tx_type: "all",
    sort_by: "block_unix_time",
    sort_type: "desc",
    limit: "100",
    ui_amount_mode: "scaled",
  });
  if (pair) base.set("pool_id", pair);

  const all = [];
  let offset = 0;
  let pages = 0;
  let truncated = false;
  let lastError = null;
  // "v3" → "seek-both" → "seek-after-only". A 422 moves one step down.
  let mode = "v3";
  let rateRetries = 0;

  while (all.length < maxTrades && pages < maxPages && Date.now() < deadline) {
    if (pages > 0 && delayMs > 0) await sleepImpl(delayMs);
    const qs = new URLSearchParams(base);
    qs.set("offset", String(offset));
    let path;
    let normalizeOne;
    if (mode === "v3") {
      qs.set("before_time", String(toSec));
      qs.set("after_time", String(fromSec));
      path = `/defi/v3/token/txs?${qs}`;
      normalizeOne = normalizeBirdeyeV3Trade;
    } else if (mode === "seek-both") {
      qs.set("before_time", String(toSec));
      qs.set("after_time", String(fromSec));
      path = `/defi/txs/token/seek_by_time?${qs}`;
      normalizeOne = normalizeBirdeyeSeekTrade;
    } else {
      // Legacy seek, after_time-only: items are desc-sorted and all >=
      // fromSec; filter to the window below. Offset paging walks newest →
      // oldest until a short page ends the data.
      qs.set("after_time", String(fromSec));
      path = `/defi/txs/token/seek_by_time?${qs}`;
      normalizeOne = normalizeBirdeyeSeekTrade;
    }

    let r;
    try {
      r = await birdeyeGet(path, fetchImpl);
    } catch (e) {
      lastError = `birdeye request failed: ${String(e?.message || e).slice(0, 80)}`;
      break;
    }
    pages += 1;

    if (r.status === 429) {
      // Free tier is 1 rps — back off once, then give up honestly.
      if (rateRetries < 1) {
        rateRetries += 1;
        await sleepImpl(2000);
        pages -= 1; // retrying the same page doesn't count as a new page
        continue;
      }
      lastError = "birdeye rate-limited (429)";
      break;
    }
    if ((r.status === 422 || r.status === 400) && mode !== "seek-after-only") {
      // V3 (or seek-both) rejected the bounds — step down one mode and
      // restart the walk from the top of the window.
      mode = mode === "v3" ? "seek-both" : "seek-after-only";
      all.length = 0;
      offset = 0;
      continue;
    }
    if (!r.ok) {
      lastError = `birdeye HTTP ${r.status}`;
      break;
    }
    const batch = normalizeBirdeyeList(r.body, mint, normalizeOne);
    const items = r.body && typeof r.body === "object" ? r.body?.data?.items : null;
    const hasNext = r.body && typeof r.body === "object" ? r.body?.data?.has_next : undefined;
    if (mode === "seek-after-only") {
      // Keep only the requested window; pages above `to` are walked through.
      for (const t of batch) {
        if (t.timeMs >= fromSec * 1000 && t.timeMs <= toSec * 1000) all.push(t);
      }
    } else {
      all.push(...batch);
    }
    const exhausted = !Array.isArray(items) || items.length < 100 || hasNext === false;
    if (exhausted) {
      return { trades: dedupeTrades(all), coversWindow: true, truncated: false, error: null };
    }
    offset += 100;
    if (offset + 100 > 10_000) {
      // Birdeye caps offset+limit at 10,000 — the window is too dense to
      // page through; report partial honestly.
      truncated = true;
      break;
    }
  }

  if (all.length >= maxTrades || pages >= maxPages) truncated = true;
  if (Date.now() >= deadline) truncated = true;
  if (lastError) return { trades: [], coversWindow: false, truncated, error: lastError };
  // Walk ended on a cap with partial data — return what we have, flagged.
  return { trades: dedupeTrades(all), coversWindow: false, truncated, error: null };
}

/**
 * GeckoTerminal recent-trades fallback: the fixed 300-newest window,
 * newest pages first. Returns deduped trades, oldest-first.
 */
export async function fetchGeckoRecentTrades(pair, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const all = [];
  for (let page = 1; page <= 3; page++) {
    let raw;
    try {
      const res = await fetchImpl(
        `${GT_BASE}/networks/solana/pools/${encodeURIComponent(pair)}/trades?page=${page}`,
        {
          headers: { Accept: "application/json" },
          signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
            ? AbortSignal.timeout(10_000)
            : undefined,
        },
      );
      if (!res.ok) break;
      raw = await res.json().catch(() => null);
    } catch {
      break;
    }
    const batch = normalizeGeckoTradeList(raw);
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break;
  }
  return dedupeTrades(all);
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return send(res, 204, {});
  }

  const q = req.query || {};
  const mint = typeof q.mint === "string" ? q.mint.trim() : "";
  const pair = typeof q.pair === "string" && q.pair.trim() ? q.pair.trim() : null;
  // `dev` is accepted for forward-compat; dev sells are flagged client-side
  // from the returned makers, so it does not change the fetch.
  const fromMs = Number(q.from);
  const toMs = Number(q.to);
  if (!mint || mint.length < 32 || mint.length > 44) {
    return send(res, 400, { ok: false, error: "valid mint required" });
  }
  if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) {
    return send(res, 400, { ok: false, error: "from and to (unix ms, from < to) required" });
  }

  const now = Date.now();
  const toClamped = Math.min(toMs, now);
  const fromClamped = Math.max(fromMs, toClamped - REPLAY_MAX_WINDOW_MS);
  const fromSec = Math.floor(fromClamped / 1000);
  const toSec = Math.floor(toClamped / 1000);

  // KV cache for completed Birdeye windows (the expensive path).
  const key = buildCacheKey(mint, pair, fromClamped, toClamped);
  if (BIRDEYE_KEY) {
    const cached = await kvGet(key).catch(() => null);
    if (
      cached &&
      Array.isArray(cached.trades) &&
      Date.now() - (cached.ts || 0) < REPLAY_CACHE_TTL_MS
    ) {
      cache(res, 300, 600);
      return send(res, 200, {
        ok: true,
        source: "birdeye",
        coversWindow: !!cached.coversWindow,
        fromMs: fromClamped,
        toMs: toClamped,
        trades: cached.trades,
        count: cached.trades.length,
        cached: true,
        truncated: !!cached.truncated,
        error: null,
      });
    }
  }

  // Primary: Birdeye full-window walk.
  if (BIRDEYE_KEY) {
    const b = await fetchBirdeyeTrades({ mint, pair, fromSec, toSec });
    if (!b.error) {
      if (b.coversWindow) {
        kvPut(key, { ts: Date.now(), trades: b.trades, coversWindow: true, truncated: false }).catch(() => {});
      }
      cache(res, 300, 600);
      return send(res, 200, {
        ok: true,
        source: "birdeye",
        coversWindow: b.coversWindow,
        fromMs: fromClamped,
        toMs: toClamped,
        trades: b.trades,
        count: b.trades.length,
        cached: false,
        truncated: b.truncated,
        error: null,
      });
    }
    // Birdeye failed — fall through to the GeckoTerminal recent window.
    const gtTrades = pair ? await fetchGeckoRecentTrades(pair) : [];
    const inWindow = gtTrades.filter((t) => t.timeMs >= fromClamped && t.timeMs <= toClamped);
    cache(res, 60, 60);
    return send(res, 200, {
      ok: true,
      source: inWindow.length ? "geckoterminal-recent" : "none",
      coversWindow: false,
      fromMs: fromClamped,
      toMs: toClamped,
      trades: inWindow,
      count: inWindow.length,
      cached: false,
      truncated: false,
      error: b.error,
    });
  }

  // No Birdeye key configured — GeckoTerminal recent window only.
  const gtTrades = pair ? await fetchGeckoRecentTrades(pair) : [];
  const inWindow = gtTrades.filter((t) => t.timeMs >= fromClamped && t.timeMs <= toClamped);
  cache(res, 60, 60);
  return send(res, 200, {
    ok: true,
    source: inWindow.length ? "geckoterminal-recent" : "none",
    coversWindow: false,
    fromMs: fromClamped,
    toMs: toClamped,
    trades: inWindow,
    count: inWindow.length,
    cached: false,
    truncated: false,
    error: "birdeye key not configured",
  });
}
