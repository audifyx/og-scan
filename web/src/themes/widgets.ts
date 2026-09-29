/**
 * OS home widgets (idea 32) — whale alert ticker, gas tracker, fear/greed dial.
 *
 * Self-contained data layer: all sources are public, keyless endpoints
 * with short in-memory + localStorage caching and graceful "unavailable"
 * fallbacks, so widgets never break the home screen offline.
 *
 * Sources:
 *   whales — DexScreener token-boosts (real, public)
 *   gas    — Solana mainnet getRecentPrioritizationFees (public RPC)
 *   fng    — alternative.me Crypto Fear & Greed Index (public)
 */

export interface WhaleAlert {
  id: string;
  token: string;
  symbol: string;
  chain: string;
  amount: string;
  url: string;
}

export interface GasReading {
  /** median prioritization fee, micro-lamports per CU */
  medianMicroLamports: number;
  /** bucket label for the dial */
  level: "low" | "normal" | "high" | "extreme";
  at: number;
}

export interface FngReading {
  value: number; // 0..100
  label: string; // "Extreme Fear" … "Extreme Greed"
  at: number;
}

export type WidgetId = "whales" | "gas" | "fng";

export const WIDGETS_KEY = "orbitx-widgets";
export const DEFAULT_WIDGETS: WidgetId[] = ["whales", "gas", "fng"];

const CACHE_TTL_MS = 90_000;
const cache = new Map<string, { at: number; data: unknown }>();

function cached<T>(key: string, fn: () => Promise<T>): Promise<T | null> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return Promise.resolve(hit.data as T);
  return fn()
    .then((data) => {
      cache.set(key, { at: Date.now(), data });
      return data;
    })
    .catch(() => (hit ? (hit.data as T) : null));
}

async function fetchJson(url: string, init?: RequestInit, timeoutMs = 8000): Promise<unknown> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as unknown;
  } finally {
    clearTimeout(t);
  }
}

/* ---------------- whale alert ticker ---------------- */

/** Top boosted tokens on DexScreener — the closest public proxy for "whale attention". */
export function getWhaleAlerts(): Promise<WhaleAlert[] | null> {
  return cached("whales", async () => {
    const data = (await fetchJson("https://api.dexscreener.com/token-boosts/top/v1")) as Array<{
      tokenAddress?: string;
      chainId?: string;
      description?: string;
      url?: string;
    }>;
    if (!Array.isArray(data)) return [];
    return data.slice(0, 12).map((b, i) => ({
      id: `${b.chainId ?? "x"}:${b.tokenAddress ?? i}`,
      token: b.tokenAddress ? `${b.tokenAddress.slice(0, 4)}…${b.tokenAddress.slice(-4)}` : "—",
      symbol: (b.description || "TOKEN").split(" ")[0].slice(0, 10).toUpperCase(),
      chain: (b.chainId || "?").toUpperCase(),
      amount: "BOOSTED",
      url: b.url || `https://dexscreener.com/${b.chainId ?? "solana"}/${b.tokenAddress ?? ""}`,
    }));
  });
}

/* ---------------- gas tracker ---------------- */

const LAMPORTS_PER_SOL = 1_000_000_000;

export function gasLevel(microLamports: number): GasReading["level"] {
  if (microLamports < 1_000) return "low";
  if (microLamports < 10_000) return "normal";
  if (microLamports < 100_000) return "high";
  return "extreme";
}

export function getGasReading(): Promise<GasReading | null> {
  return cached("gas", async () => {
    const data = (await fetchJson("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getRecentPrioritizationFees",
        params: [[]],
      }),
    })) as { result?: Array<{ prioritizationFee?: number }> };
    const fees = (data.result ?? [])
      .map((f) => f.prioritizationFee ?? 0)
      .filter((f) => f > 0)
      .sort((a, b) => a - b);
    if (fees.length === 0) throw new Error("no fee data");
    const median = fees[Math.floor(fees.length / 2)];
    const sol = median / LAMPORTS_PER_SOL;
    return { medianMicroLamports: median, level: gasLevel(median), at: Date.now(), solFee: sol } as GasReading & { solFee: number };
  });
}

/* ---------------- fear / greed dial ---------------- */

export function getFearGreed(): Promise<FngReading | null> {
  return cached("fng", async () => {
    const data = (await fetchJson("https://api.alternative.me/fng/?limit=1")) as {
      data?: Array<{ value?: string; value_classification?: string; timestamp?: string }>;
    };
    const d = data.data?.[0];
    if (!d?.value) throw new Error("no fng data");
    return {
      value: Math.max(0, Math.min(100, Number(d.value))),
      label: d.value_classification || "—",
      at: Number(d.timestamp || 0) * 1000,
    };
  });
}

/* ---------------- visibility prefs ---------------- */

export function getEnabledWidgets(): WidgetId[] {
  try {
    const raw = localStorage.getItem(WIDGETS_KEY);
    if (!raw) return [...DEFAULT_WIDGETS];
    const arr = JSON.parse(raw);
    const valid = (Array.isArray(arr) ? arr : []).filter(
      (w): w is WidgetId => w === "whales" || w === "gas" || w === "fng"
    );
    return valid.length ? valid : [...DEFAULT_WIDGETS];
  } catch {
    return [...DEFAULT_WIDGETS];
  }
}

export function setEnabledWidgets(ids: WidgetId[]) {
  try {
    localStorage.setItem(WIDGETS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("orbitx:widgets"));
}

export const WIDGET_META: Record<WidgetId, { name: string; blurb: string }> = {
  whales: { name: "Whale Alerts", blurb: "Boosted-token attention ticker" },
  gas: { name: "Gas Tracker", blurb: "Live Solana fee dial" },
  fng: { name: "Fear / Greed", blurb: "Market mood gauge" },
};
