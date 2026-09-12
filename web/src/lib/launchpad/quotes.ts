import { SOL_MINT, USDC_MINT, type QuoteAsset } from "./types";

export const CURATED_QUOTES: QuoteAsset[] = [
  { symbol: "SOL", mint: SOL_MINT, name: "Solana", kind: "native", decimals: 9, allowed: true },
  { symbol: "USDC", mint: USDC_MINT, name: "USD Coin", kind: "stable", decimals: 6, allowed: true },
  { symbol: "NVDAX", mint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh", name: "NVIDIA xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "TSLAX", mint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB", name: "Tesla xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "SPYX", mint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W", name: "S&P 500 xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "GOOGLX", mint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN", name: "Alphabet xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "APPLX", mint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp", name: "Apple xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "GLDX", mint: "Xsv9hRk1z5ystj9MhnA7Lq4vjSsLwzL2nxrwmwtD3re", name: "Gold xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "HOODX", mint: "XsvNBAYkrDRNhA7wPHQfX3ZUXZyZLdnCQDfHZ56bzpg", name: "Robinhood xStock", kind: "stock", decimals: 8, allowed: false, awaitingAllowlist: true },
  { symbol: "wBTC", mint: "3NZ9JMVBmGAqocybic2c7LQCJScmgsAZ6vQqTDzcqmJh", name: "Wrapped BTC", kind: "crypto", decimals: 8, allowed: false, awaitingAllowlist: true },
];

const ALWAYS_ALLOWED = new Set([SOL_MINT, USDC_MINT]);

export function isNativeSol(mint: string): boolean {
  return mint === SOL_MINT;
}

export function isStockQuote(mint: string, catalog: QuoteAsset[] = CURATED_QUOTES): boolean {
  return catalog.find((q) => q.mint === mint)?.kind === "stock";
}

export function mayhemAllowedForQuote(mint: string, catalog: QuoteAsset[] = CURATED_QUOTES): boolean {
  if (mint === SOL_MINT || mint === USDC_MINT) return true;
  const hit = catalog.find((q) => q.mint === mint);
  return hit?.kind === "stable" || hit?.kind === "native";
}

export function quoteByMint(mint: string, catalog: QuoteAsset[] = CURATED_QUOTES): QuoteAsset | undefined {
  return catalog.find((q) => q.mint === mint);
}

export function mergeQuoteAllowlist(
  curated: QuoteAsset[] = CURATED_QUOTES,
  onChainAllowed: string[] = [],
): QuoteAsset[] {
  const allowed = new Set([...ALWAYS_ALLOWED, ...onChainAllowed.filter(Boolean)]);
  return curated.map((q) => {
    const live = allowed.has(q.mint);
    return {
      ...q,
      allowed: live,
      awaitingAllowlist: live ? false : q.kind !== "native" && q.kind !== "stable",
    };
  });
}

/** Runtime QuoteControl overlay. Falls back to curated SOL/USDC if fetch fails. */
export async function loadQuotes(fetchAllowed?: () => Promise<string[]>): Promise<QuoteAsset[]> {
  if (!fetchAllowed) return mergeQuoteAllowlist(CURATED_QUOTES, [SOL_MINT, USDC_MINT]);
  try {
    const extra = await fetchAllowed();
    return mergeQuoteAllowlist(CURATED_QUOTES, extra);
  } catch {
    return mergeQuoteAllowlist(CURATED_QUOTES, [SOL_MINT, USDC_MINT]);
  }
}

export function quoteCreateLive(quote: QuoteAsset): boolean {
  return quote.allowed && (quote.mint === SOL_MINT || quote.mint === USDC_MINT);
}
