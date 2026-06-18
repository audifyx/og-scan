// ============================================================
// OG Scan — shared token data fetcher (DexScreener public API).
// Normalises a token into: classification input, market snapshot,
// and a reconstructed time-series for the intelligence engines.
// ============================================================

import type { ClassificationInput } from "./classification";
import type { SeriesPoint } from "./intelligence";

export type TokenSnapshot = {
  mint: string;
  chain: string;
  symbol?: string;
  name?: string;
  priceUsd?: number;
  liquidityUsd: number;
  volume24hUsd?: number;
  fdv?: number;
  ageHours?: number;
  priceChange24h?: number;
  hasSocials: boolean;
  input: ClassificationInput;
  series: SeriesPoint[];
};

type DexPair = {
  chainId?: string;
  priceUsd?: string;
  liquidity?: { usd?: number };
  volume?: { m5?: number; h1?: number; h6?: number; h24?: number };
  priceChange?: { m5?: number; h1?: number; h6?: number; h24?: number };
  pairCreatedAt?: number;
  fdv?: number;
  baseToken?: { name?: string; symbol?: string };
  info?: { socials?: unknown[]; websites?: unknown[] };
};

function num(v: unknown): number | undefined {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

/** Build an approximate recent price/volume series from DexScreener change buckets. */
function reconstructSeries(p: DexPair): SeriesPoint[] {
  const now = Date.now();
  const price = num(p.priceUsd);
  if (price === undefined) return [];
  const pc = p.priceChange ?? {};
  const v = p.volume ?? {};
  const back = (changePct?: number) => (changePct !== undefined ? price / (1 + changePct / 100) : price);
  return [
    { t: now - 24 * 3.6e6, price: back(pc.h24), volume: v.h24 },
    { t: now - 6 * 3.6e6,  price: back(pc.h6),  volume: v.h6 },
    { t: now - 1 * 3.6e6,  price: back(pc.h1),  volume: v.h1 },
    { t: now - 5 * 6e4,    price: back(pc.m5),  volume: v.m5 },
    { t: now,              price,               volume: v.h1 },
  ];
}

export async function fetchTokenSnapshot(addr: string): Promise<TokenSnapshot> {
  const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${addr}`);
  if (!res.ok) throw new Error(`DexScreener ${res.status}`);
  const json = (await res.json()) as { pairs?: DexPair[] };
  const pairs = json.pairs ?? [];
  const chainGuess = /^0x[a-fA-F0-9]{40}$/.test(addr) ? "ethereum" : "solana";

  if (pairs.length === 0) {
    return {
      mint: addr, chain: chainGuess, liquidityUsd: 0, hasSocials: false,
      input: { hasName: false, hasSymbol: false }, series: [],
    };
  }

  const best = pairs.slice().sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
  const liquidityUsd = best.liquidity?.usd ?? 0;
  const fdv = best.fdv ?? 0;
  const ageHours = best.pairCreatedAt ? (Date.now() - best.pairCreatedAt) / 3.6e6 : undefined;
  const hasSocials = Boolean((best.info?.socials?.length ?? 0) > 0 || (best.info?.websites?.length ?? 0) > 0);
  const priceUsd = num(best.priceUsd);

  const input: ClassificationInput = {
    liquidityUsd,
    volume24hUsd: best.volume?.h24,
    ageHours,
    hasName: Boolean(best.baseToken?.name),
    hasSymbol: Boolean(best.baseToken?.symbol),
    hasSocials,
    lpPulled: fdv > 0 && liquidityUsd > 0 ? liquidityUsd / fdv < 0.0005 : undefined,
  };

  return {
    mint: addr,
    chain: best.chainId ?? chainGuess,
    symbol: best.baseToken?.symbol,
    name: best.baseToken?.name,
    priceUsd,
    liquidityUsd,
    volume24hUsd: best.volume?.h24,
    fdv,
    ageHours,
    priceChange24h: best.priceChange?.h24,
    hasSocials,
    input,
    series: reconstructSeries(best),
  };
}
