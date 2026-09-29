/**
 * Adapter: raw `useLivePrices` output → the social module's TokenDrama.
 *
 * The integrator feeds live prices from `@/hooks/useLivePrices`; this pure
 * function converts them. Real data only — mints with no live quote are
 * dropped, never mocked.
 */

import type { TokenDrama } from "../types";

export interface LivePriceLike {
  price: number;
  priceChange24h: number;
  volume24h: number;
  marketCap: number;
}

export interface DramaMeta {
  mint: string;
  symbol: string;
}

export function dramaFromPrices(
  prices: Record<string, LivePriceLike>,
  metas: DramaMeta[]
): TokenDrama[] {
  const out: TokenDrama[] = [];
  for (const m of metas) {
    const p = prices[m.mint];
    if (!p || !(p.price > 0)) continue; // no live quote → skip, never mock
    out.push({
      symbol: m.symbol,
      mint: m.mint,
      price: p.price,
      change24h: p.priceChange24h ?? 0,
      volume24h: p.volume24h ?? 0,
      marketCap: p.marketCap ?? 0,
    });
  }
  return out;
}

/** ORBITX mint — the one token every feed needs. */
export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
