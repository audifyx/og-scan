import type { TokenDetail } from "./types";
import { num } from "./marketData";

function pickNum(...vals: unknown[]): number | undefined {
  for (const v of vals) {
    const n = num(v);
    if (n != null) return n;
  }
  return undefined;
}

/** Fetch live token detail from OrbitX DEX API. */
export async function fetchTokenDetail(mint: string): Promise<TokenDetail | null> {
  try {
    const res = await fetch(`/api/ogdex/token?mint=${encodeURIComponent(mint)}`);
    if (!res.ok) return null;
    const json = await res.json();
    if (json?.error && !json?.token) return null;
    const t = (json.token ?? json) as Record<string, unknown>;
    const meta = (json.meta ?? {}) as Record<string, unknown>;
    return {
      mint,
      name: String(t.name ?? meta.name ?? "Unknown"),
      symbol: String(t.symbol ?? meta.symbol ?? "???"),
      icon: (t.icon ?? t.image ?? t.logoURI ?? meta.image) as string | undefined,
      priceUsd: pickNum(t.priceUsd, t.price),
      mcap: pickNum(t.mcap, t.marketCap, t.fdv),
      fdv: pickNum(t.fdv),
      liquidity: pickNum(
        typeof t.liquidity === "object" && t.liquidity !== null
          ? (t.liquidity as { usd?: number }).usd
          : t.liquidity,
        t.liquidityUsd,
      ),
      volume24h: pickNum(t.volume24h, (t.volume as { h24?: number })?.h24, t.volume),
      change24h: pickNum(t.change24h, t.priceChange24h, (t.priceChange as { h24?: number })?.h24),
      holderCount: pickNum(t.holderCount, t.holders) as number | undefined,
      website: (t.website ?? meta.website) as string | undefined,
      twitter: (t.twitter ?? meta.twitter) as string | undefined,
    };
  } catch {
    return null;
  }
}

export interface ChartCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchTokenChart(mint: string, interval = "1h", limit = 48): Promise<ChartCandle[]> {
  try {
    const res = await fetch(
      `/api/ogdex/chart?mint=${encodeURIComponent(mint)}&interval=${interval}&limit=${limit}`,
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.candles) ? (json.candles as ChartCandle[]) : [];
  } catch {
    return [];
  }
}
