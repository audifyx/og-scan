/**
 * useLaunchReplay — Sandbox launch replay (Team F, OG Scanner v2).
 *
 * Replays how a token launched, minute by minute, from real public data:
 *  - Pair discovery + launch time + current price/market-cap: DexScreener
 *    public API (keyless), via the existing `fetchDexPairs` client.
 *  - Minute OHLCV candles + individual trades: GeckoTerminal public API
 *    (keyless, no auth), keyed off the DexScreener pair address.
 *
 * WHY GeckoTerminal for candles/trades: DexScreener's documented public API
 * has NO candles/trades endpoint — it only returns current-state snapshots
 * (pairs, tokens, search, profiles, boosts, orders, metas). Verified against
 * https://docs.dexscreener.com/api/reference on 2026-11-08. The charts on
 * dexscreener.com use an undocumented internal feed; calling it would be
 * scraping, so this hook uses GeckoTerminal's documented keyless OHLCV +
 * trades endpoints instead. Both endpoints were verified live 2026-11-08.
 *
 * NEVER-FAKE RULE: minutes with no candle are gaps, never interpolated.
 * The chart breaks at gaps and the UI labels them ("no trade data for this
 * window"). Markers come only from fetched trades; when the fetched trade
 * window does not reach launch, the first-buy marker is labelled as the
 * first buy *in available data*. Dev sells are flagged only when a dev
 * wallet is supplied and a fetched trade's maker address matches it exactly.
 * LP events: only pair creation (from DexScreener `pairCreatedAt`) is in
 * the data — no LP lock/burn events are invented.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchDexPairs, isValidMint, type DexPair } from "../api/client";

// ── Types ───────────────────────────────────────────────────────────────────

export type ReplayCandle = {
  /** Minute-bucket start, ms since epoch (UTC). */
  timeMs: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volumeUsd: number;
};

export type ReplayTrade = {
  txHash: string;
  timeMs: number;
  /** Maker wallet (GeckoTerminal `tx_from_address`). */
  maker: string | null;
  kind: "buy" | "sell";
  priceUsd: number | null;
  volumeUsd: number | null;
};

export type ReplayGap = {
  /** First missing minute, ms since epoch. */
  startMs: number;
  /** Last missing minute, ms since epoch. */
  endMs: number;
  /** Number of missing minutes. */
  minutes: number;
};

export type ReplayMarkerKind = "first-buy" | "big-buy" | "dev-sell" | "pair-created";

export type ReplayMarker = {
  kind: ReplayMarkerKind;
  timeMs: number;
  label: string;
  detail: string;
  /** Trade volume in USD, when the marker comes from a trade. */
  volumeUsd: number | null;
  txHash: string | null;
  maker: string | null;
};

export type ReplayMinute = {
  /** Minute offset from the replay start (0 = launch minute). */
  index: number;
  timeMs: number;
  /** Null when this minute has no candle — a gap, never interpolated. */
  candle: ReplayCandle | null;
  buys: number;
  sells: number;
  buyVolumeUsd: number;
  sellVolumeUsd: number;
};

export type ReplayPairInfo = {
  pairAddress: string;
  dexId: string | null;
  /** Pair creation = launch, ms since epoch. Null when DexScreener omits it. */
  launchAtMs: number | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  symbol: string | null;
};

export type ReplayStatus = "idle" | "loading" | "ready" | "error" | "no-data";

export type UseLaunchReplayOptions = {
  mint: string;
  /** Highest-liquidity Solana pair is auto-picked when omitted. */
  pairAddress?: string | null;
  /** Dev/creator wallet — only used to flag dev sells. Never guessed. */
  devWallet?: string | null;
  /** How many 1000-bar OHLCV pages to walk back (default 5 ≈ 3.5 days). */
  maxCandlePages?: number;
  /** How many recent-trade pages to fetch (default 3). */
  maxTradePages?: number;
};

export type UseLaunchReplayResult = {
  status: ReplayStatus;
  error: string | null;
  mint: string | null;
  pair: ReplayPairInfo | null;
  /** First minute of the replay window (launch, or oldest fetched candle). */
  startMs: number | null;
  /** Last minute of the replay window. */
  endMs: number | null;
  /** One slot per minute from startMs to endMs. Gaps have candle: null. */
  minutes: ReplayMinute[];
  /** Contiguous runs of minutes with no candle data. */
  gaps: ReplayGap[];
  markers: ReplayMarker[];
  /** True when the candle window reaches back to pair creation. */
  coversLaunch: boolean;
  /** True when the fetched trade window reaches back to pair creation. */
  tradesCoverLaunch: boolean;
  /** Implied total supply (current mcap / current price). Null when unknown. */
  impliedSupply: number | null;
  /** Estimated market cap at a price, using implied supply. Null when unknown. */
  mcapAt: (priceUsd: number) => number | null;
  totalMinutes: number;
  /** Playback cursor: minute offset from startMs. */
  cursor: number;
  playing: boolean;
  /** Playback speed in replay-minutes per second. */
  speed: number;
  speedOptions: number[];
  setCursor: (minute: number) => void;
  setPlaying: (playing: boolean) => void;
  setSpeed: (speed: number) => void;
  restart: () => void;
  reload: () => void;
  /** Minute currently under the cursor (null before data loads). */
  current: ReplayMinute | null;
  /** Markers at or before the cursor (what the replay has "shown" so far). */
  markersUpToCursor: ReplayMarker[];
};

// ── Pure helpers (unit-tested in src/crypto/sandbox-replay.test.ts) ─────────

/** Pick the replay pair: the highest-liquidity Solana pair for the mint. */
export function pickReplayPair(pairs: DexPair[], pairAddress?: string | null): DexPair | null {
  if (!pairs.length) return null;
  if (pairAddress) {
    const exact = pairs.find((p) => p.pairAddress === pairAddress);
    if (exact) return exact;
  }
  const sorted = [...pairs].sort(
    (a, b) => (b.liquidityUsd ?? 0) - (a.liquidityUsd ?? 0),
  );
  return sorted[0] ?? null;
}

/** Normalize one GeckoTerminal OHLCV row: [tsSec, open, high, low, close, volume]. */
export function normalizeOhlcvRow(row: unknown): ReplayCandle | null {
  if (!Array.isArray(row) || row.length < 6) return null;
  const [ts, open, high, low, close, volume] = row.map((v) => Number(v));
  if (!Number.isFinite(ts) || ts <= 0) return null;
  if (![open, high, low, close].every((n) => Number.isFinite(n) && n > 0)) return null;
  return {
    timeMs: ts * 1000,
    open,
    high,
    low,
    close,
    volumeUsd: Number.isFinite(volume) ? volume : 0,
  };
}

export function normalizeOhlcvList(raw: unknown): ReplayCandle[] {
  const list =
    raw && typeof raw === "object"
      ? (raw as Record<string, unknown>).data
      : null;
  const rows =
    list && typeof list === "object"
      ? (list as Record<string, unknown>).attributes
      : null;
  const arr =
    rows && typeof rows === "object" && Array.isArray((rows as Record<string, unknown>).ohlcv_list)
      ? ((rows as Record<string, unknown>).ohlcv_list as unknown[])
      : [];
  const out = arr
    .map(normalizeOhlcvRow)
    .filter((c): c is ReplayCandle => c != null)
    .sort((a, b) => a.timeMs - b.timeMs);
  // De-dupe by minute bucket, keeping the first row per bucket.
  const seen = new Set<number>();
  return out.filter((c) => {
    const bucket = Math.floor(c.timeMs / 60_000);
    if (seen.has(bucket)) return false;
    seen.add(bucket);
    return true;
  });
}

/** Normalize one GeckoTerminal trade row into a ReplayTrade. */
export function normalizeTrade(raw: unknown): ReplayTrade | null {
  if (!raw || typeof raw !== "object") return null;
  const attrs = (raw as Record<string, unknown>).attributes;
  if (!attrs || typeof attrs !== "object") return null;
  const a = attrs as Record<string, unknown>;
  const ts = Date.parse(String(a.block_timestamp ?? ""));
  if (!Number.isFinite(ts)) return null;
  const kind = a.kind === "sell" ? "sell" : a.kind === "buy" ? "buy" : null;
  if (!kind) return null;
  const price = Number(a.price_to_in_usd ?? a.price_from_in_usd ?? NaN);
  const vol = Number(a.volume_in_usd ?? NaN);
  return {
    txHash: String(a.tx_hash ?? (raw as Record<string, unknown>).id ?? ""),
    timeMs: ts,
    maker: typeof a.tx_from_address === "string" ? a.tx_from_address : null,
    kind,
    priceUsd: Number.isFinite(price) && price > 0 ? price : null,
    volumeUsd: Number.isFinite(vol) && vol >= 0 ? vol : null,
  };
}

export function normalizeTradeList(raw: unknown): ReplayTrade[] {
  const data = raw && typeof raw === "object" ? (raw as Record<string, unknown>).data : null;
  if (!Array.isArray(data)) return [];
  return data
    .map(normalizeTrade)
    .filter((t): t is ReplayTrade => t != null)
    .sort((a, b) => a.timeMs - b.timeMs);
}

/**
 * Build the minute-by-minute series. One slot per minute from startMs to
 * endMs inclusive. A minute with no candle gets candle: null — a gap, never
 * an interpolated price. Trades are bucketed into their minute for the
 * buy/sell tape counts.
 */
export function buildMinuteSeries(
  candles: ReplayCandle[],
  trades: ReplayTrade[],
  startMs: number,
  endMs: number,
): ReplayMinute[] {
  const startBucket = Math.floor(startMs / 60_000);
  const endBucket = Math.floor(endMs / 60_000);
  if (endBucket < startBucket) return [];
  const byBucket = new Map<number, ReplayCandle>();
  for (const c of candles) byBucket.set(Math.floor(c.timeMs / 60_000), c);
  const minutes: ReplayMinute[] = [];
  for (let b = startBucket; b <= endBucket; b++) {
    minutes.push({
      index: b - startBucket,
      timeMs: b * 60_000,
      candle: byBucket.get(b) ?? null,
      buys: 0,
      sells: 0,
      buyVolumeUsd: 0,
      sellVolumeUsd: 0,
    });
  }
  for (const t of trades) {
    const b = Math.floor(t.timeMs / 60_000);
    const slot = minutes[b - startBucket];
    if (!slot) continue;
    if (t.kind === "buy") {
      slot.buys += 1;
      slot.buyVolumeUsd += t.volumeUsd ?? 0;
    } else {
      slot.sells += 1;
      slot.sellVolumeUsd += t.volumeUsd ?? 0;
    }
  }
  return minutes;
}

/** Contiguous runs of gap minutes (candle: null) in a built series. */
export function detectGaps(minutes: ReplayMinute[]): ReplayGap[] {
  const gaps: ReplayGap[] = [];
  let runStart: number | null = null;
  for (let i = 0; i <= minutes.length; i++) {
    const isGap = i < minutes.length && minutes[i].candle == null;
    if (isGap && runStart == null) runStart = i;
    if (!isGap && runStart != null) {
      gaps.push({
        startMs: minutes[runStart].timeMs,
        endMs: minutes[i - 1].timeMs,
        minutes: i - runStart,
      });
      runStart = null;
    }
  }
  return gaps;
}

/**
 * Derive replay markers from real data only.
 * - pair-created: from DexScreener pairCreatedAt (when known).
 * - first-buy: earliest buy trade in the fetched set. `tradesCoverLaunch`
 *   decides whether the label can claim "first buy ever" or only "first buy
 *   in available trade data".
 * - big-buy: the 5 largest buys by USD volume (only when volume is known).
 * - dev-sell: every fetched sell whose maker matches devWallet exactly.
 * No marker is ever synthesized from a candle or a price move.
 */
export function deriveMarkers(input: {
  trades: ReplayTrade[];
  devWallet?: string | null;
  launchAtMs?: number | null;
  tradesCoverLaunch: boolean;
}): ReplayMarker[] {
  const { trades, devWallet, launchAtMs, tradesCoverLaunch } = input;
  const markers: ReplayMarker[] = [];
  if (launchAtMs != null) {
    markers.push({
      kind: "pair-created",
      timeMs: launchAtMs,
      label: "Pair created",
      detail: "Liquidity pair created — launch minute.",
      volumeUsd: null,
      txHash: null,
      maker: null,
    });
  }
  const buys = trades.filter((t) => t.kind === "buy");
  const sells = trades.filter((t) => t.kind === "sell");
  if (buys.length > 0) {
    const first = buys[0];
    markers.push({
      kind: "first-buy",
      timeMs: first.timeMs,
      label: tradesCoverLaunch ? "First buy" : "First buy in available data",
      detail: tradesCoverLaunch
        ? "Earliest buy trade in the pair's history."
        : "Earliest buy in the fetched trade window — earlier trades may exist outside it.",
      volumeUsd: first.volumeUsd,
      txHash: first.txHash || null,
      maker: first.maker,
    });
    const ranked = [...buys]
      .filter((t) => t.volumeUsd != null)
      .sort((a, b) => (b.volumeUsd ?? 0) - (a.volumeUsd ?? 0))
      .slice(0, 5);
    for (const t of ranked) {
      if (t === first) continue; // the first buy already has its own marker
      markers.push({
        kind: "big-buy",
        timeMs: t.timeMs,
        label: "Big buy",
        detail: `Buy of $${(t.volumeUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
        volumeUsd: t.volumeUsd,
        txHash: t.txHash || null,
        maker: t.maker,
      });
    }
  }
  if (devWallet) {
    for (const t of sells) {
      if (t.maker === devWallet) {
        markers.push({
          kind: "dev-sell",
          timeMs: t.timeMs,
          label: "Dev sell",
          detail: `Sell from the dev wallet (${devWallet.slice(0, 4)}…${devWallet.slice(-4)}) for $${(t.volumeUsd ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}.`,
          volumeUsd: t.volumeUsd,
          txHash: t.txHash || null,
          maker: t.maker,
        });
      }
    }
  }
  return markers.sort((a, b) => a.timeMs - b.timeMs);
}

// ── Fetchers (GeckoTerminal, keyless public API) ─────────────────────────────

const GT_BASE = "https://api.geckoterminal.com/api/v2";

async function gtJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`geckoterminal → ${res.status}`);
  return res.json() as Promise<unknown>;
}

/**
 * Minute candles for a pool, paging backwards with `before_timestamp`
 * until the pair's launch minute or `maxPages` pages. GeckoTerminal returns
 * newest-first; pages are merged and sorted oldest-first by the normalizer.
 */
export async function fetchReplayCandles(
  poolAddress: string,
  launchAtMs: number | null,
  maxPages = 5,
): Promise<ReplayCandle[]> {
  const all: ReplayCandle[] = [];
  let before: number | null = null;
  for (let page = 0; page < maxPages; page++) {
    const qs = new URLSearchParams({
      aggregate: "1",
      limit: "1000",
      currency: "usd",
    });
    if (before != null) qs.set("before_timestamp", String(before));
    const batch = normalizeOhlcvList(
      await gtJson(`${GT_BASE}/networks/solana/pools/${encodeURIComponent(poolAddress)}/ohlcv/minute?${qs}`),
    );
    if (batch.length === 0) break;
    all.push(...batch);
    const oldest = batch[0].timeMs;
    if (launchAtMs != null && oldest <= launchAtMs) break;
    before = Math.floor(oldest / 1000);
    if (batch.length < 1000) break; // last page — no more history
  }
  const seen = new Set<number>();
  return all
    .sort((a, b) => a.timeMs - b.timeMs)
    .filter((c) => {
      if (seen.has(c.timeMs)) return false;
      seen.add(c.timeMs);
      return true;
    });
}

/** Recent trades for a pool, newest pages first (GeckoTerminal `page`). */
export async function fetchReplayTrades(
  poolAddress: string,
  maxPages = 3,
): Promise<ReplayTrade[]> {
  const all: ReplayTrade[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const batch = normalizeTradeList(
      await gtJson(
        `${GT_BASE}/networks/solana/pools/${encodeURIComponent(poolAddress)}/trades?page=${page}`,
      ),
    );
    if (batch.length === 0) break;
    all.push(...batch);
    if (batch.length < 100) break; // short page — no more trades
  }
  const seen = new Set<string>();
  return all
    .sort((a, b) => a.timeMs - b.timeMs)
    .filter((t) => {
      const key = t.txHash || `${t.timeMs}-${t.maker}-${t.volumeUsd}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

// ── Hook ────────────────────────────────────────────────────────────────────

export const REPLAY_SPEEDS = [1, 4, 16, 60];

export function useLaunchReplay(options: UseLaunchReplayOptions): UseLaunchReplayResult {
  const { mint, pairAddress, devWallet, maxCandlePages = 5, maxTradePages = 3 } = options;
  const [status, setStatus] = useState<ReplayStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pair, setPair] = useState<ReplayPairInfo | null>(null);
  const [candles, setCandles] = useState<ReplayCandle[]>([]);
  const [trades, setTrades] = useState<ReplayTrade[]>([]);
  const [cursor, setCursorState] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<number>(4);
  const [tick, setTick] = useState(0);
  const cursorRef = useRef(0);

  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!mint || !isValidMint(mint)) {
      setStatus(mint ? "error" : "idle");
      setError(mint ? "Invalid mint address" : null);
      setPair(null);
      setCandles([]);
      setTrades([]);
      setCursorState(0);
      setPlaying(false);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setPlaying(false);
    setCursorState(0);
    cursorRef.current = 0;

    (async () => {
      try {
        // 1) DexScreener: resolve the pair + launch minute.
        const pairs = await fetchDexPairs(mint);
        if (cancelled) return;
        const picked = pickReplayPair(pairs, pairAddress);
        if (!picked?.pairAddress) {
          setStatus("no-data");
          setError("No Solana pair found for this mint on DexScreener.");
          setPair(null);
          return;
        }
        const launchAtMs =
          picked.pairCreatedAt != null && Number.isFinite(picked.pairCreatedAt)
            ? picked.pairCreatedAt
            : null;
        const pairInfo: ReplayPairInfo = {
          pairAddress: picked.pairAddress,
          dexId: picked.dexId ?? null,
          launchAtMs,
          priceUsd: picked.priceUsd ?? null,
          marketCapUsd: picked.marketCap ?? null,
          symbol: null,
        };
        setPair(pairInfo);

        // 2) GeckoTerminal: minute candles back to launch + recent trades.
        const [c, t] = await Promise.all([
          fetchReplayCandles(picked.pairAddress, launchAtMs, maxCandlePages),
          fetchReplayTrades(picked.pairAddress, maxTradePages),
        ]);
        if (cancelled) return;
        setCandles(c);
        setTrades(t);
        if (c.length === 0 && t.length === 0) {
          setStatus("no-data");
          setError("No candle or trade history returned for this pair.");
          return;
        }
        setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setError(e instanceof Error ? e.message : String(e));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [mint, pairAddress, maxCandlePages, maxTradePages, tick]);

  const derived = useMemo(() => {
    if (!pair) {
      return {
        startMs: null as number | null,
        endMs: null as number | null,
        minutes: [] as ReplayMinute[],
        gaps: [] as ReplayGap[],
        markers: [] as ReplayMarker[],
        coversLaunch: false,
        tradesCoverLaunch: false,
        impliedSupply: null as number | null,
      };
    }
    const oldestCandle = candles.length ? candles[0].timeMs : null;
    const newestCandle = candles.length ? candles[candles.length - 1].timeMs : null;
    const startMs =
      pair.launchAtMs != null
        ? pair.launchAtMs
        : oldestCandle;
    const endMs = newestCandle ?? Date.now();
    const minutes =
      startMs != null ? buildMinuteSeries(candles, trades, startMs, endMs) : [];
    const gaps = detectGaps(minutes);
    const coversLaunch =
      pair.launchAtMs != null && oldestCandle != null && oldestCandle <= pair.launchAtMs + 60_000;
    const oldestTrade = trades.length ? trades[0].timeMs : null;
    const tradesCoverLaunch =
      pair.launchAtMs != null && oldestTrade != null && oldestTrade <= pair.launchAtMs + 60_000;
    const markers = deriveMarkers({
      trades,
      devWallet,
      launchAtMs: pair.launchAtMs,
      tradesCoverLaunch,
    });
    const impliedSupply =
      pair.priceUsd != null &&
      pair.priceUsd > 0 &&
      pair.marketCapUsd != null &&
      pair.marketCapUsd > 0
        ? pair.marketCapUsd / pair.priceUsd
        : null;
    return { startMs, endMs, minutes, gaps, markers, coversLaunch, tradesCoverLaunch, impliedSupply };
  }, [pair, candles, trades, devWallet]);

  const totalMinutes = derived.minutes.length;
  const clampedCursor = totalMinutes === 0 ? 0 : Math.max(0, Math.min(cursor, totalMinutes - 1));

  // Playback: advance the cursor on a 250ms tick; speed = minutes/second.
  useEffect(() => {
    if (!playing || totalMinutes === 0) return;
    const id = window.setInterval(() => {
      cursorRef.current += speed * 0.25;
      if (cursorRef.current >= totalMinutes - 1) {
        cursorRef.current = totalMinutes - 1;
        setCursorState(totalMinutes - 1);
        setPlaying(false);
      } else {
        setCursorState(Math.floor(cursorRef.current));
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [playing, speed, totalMinutes]);

  const setCursor = useCallback((minute: number) => {
    const v = Math.max(0, Math.min(minute, Math.max(0, totalMinutes - 1)));
    cursorRef.current = v;
    setCursorState(v);
  }, [totalMinutes]);

  const setSpeed = useCallback((s: number) => {
    setSpeedState(REPLAY_SPEEDS.includes(s) ? s : 4);
  }, []);

  const restart = useCallback(() => {
    cursorRef.current = 0;
    setCursorState(0);
    setPlaying(true);
  }, []);

  const current = totalMinutes === 0 ? null : derived.minutes[clampedCursor] ?? null;
  const markersUpToCursor = useMemo(() => {
    if (!current) return [];
    return derived.markers.filter((m) => m.timeMs <= current.timeMs + 60_000);
  }, [derived.markers, current]);

  const mcapAt = useCallback(
    (priceUsd: number) =>
      derived.impliedSupply != null && Number.isFinite(priceUsd)
        ? priceUsd * derived.impliedSupply
        : null,
    [derived.impliedSupply],
  );

  return {
    status,
    error,
    mint: mint && isValidMint(mint) ? mint : null,
    pair,
    startMs: derived.startMs,
    endMs: derived.endMs,
    minutes: derived.minutes,
    gaps: derived.gaps,
    markers: derived.markers,
    coversLaunch: derived.coversLaunch,
    tradesCoverLaunch: derived.tradesCoverLaunch,
    impliedSupply: derived.impliedSupply,
    mcapAt,
    totalMinutes,
    cursor: clampedCursor,
    playing,
    speed,
    speedOptions: REPLAY_SPEEDS,
    setCursor,
    setPlaying,
    setSpeed,
    restart,
    reload,
    current,
    markersUpToCursor,
  };
}
