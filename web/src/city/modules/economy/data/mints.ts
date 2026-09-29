/**
 * Real token mints used by economy price feeds (via `useLivePrices`,
 * DexScreener). Only canonical, well-known mints — never mock data.
 */
export interface FeedToken {
  mint: string;
  symbol: string;
  label: string;
}

/** $ORBITX — official CA from the OrbitX site band. */
export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

export const FEED_TOKENS: FeedToken[] = [
  { mint: ORBITX_MINT, symbol: "ORBITX", label: "OrbitX" },
  { mint: "So11111111111111111111111111111111111111112", symbol: "SOL", label: "Solana" },
  { mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", symbol: "USDC", label: "USD Coin" },
];

export function feedToken(mint: string): FeedToken {
  return FEED_TOKENS.find((t) => t.mint === mint) ?? { mint, symbol: "???", label: "Unknown" };
}
