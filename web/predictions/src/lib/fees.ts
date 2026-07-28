// Tiered placement fee (USD), charged on each bet and kept by the treasury.
// Small bets pay $1–$10, large bets pay $20–$50, scaling with the bet size.
export interface FeeTier { maxUsd: number; feeUsd: number }

export const FEE_TIERS: FeeTier[] = [
  { maxUsd: 5,        feeUsd: 0.5 },
  { maxUsd: 10,       feeUsd: 1 },
  { maxUsd: 25,       feeUsd: 2.5 },
  { maxUsd: 50,       feeUsd: 5 },
  { maxUsd: 100,      feeUsd: 7.5 },
  { maxUsd: 250,      feeUsd: 12.5 },
  { maxUsd: 500,      feeUsd: 20 },
  { maxUsd: Infinity, feeUsd: 25 },
];

export function feeUsdForUsd(usd: number): number {
  for (const t of FEE_TIERS) if (usd <= t.maxUsd) return t.feeUsd;
  return 25;
}

const FALLBACK_SOL_USD = 150;

/** Live SOL/USD price (CoinGecko). Falls back to a constant on failure. */
export async function getSolUsd(): Promise<number> {
  try {
    const r = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { cache: 'no-store' } as any
    );
    const j = await r.json();
    const p = Number(j?.solana?.usd);
    if (p > 0) return p;
  } catch {}
  return FALLBACK_SOL_USD;
}

/** Given a deposit in lamports and SOL price, return {feeLamports, netLamports, feeUsd, usd}. */
export function computeFee(depositLamports: number, solUsd: number) {
  const depositSol = depositLamports / 1e9;
  const usd = depositSol * solUsd;
  const feeUsd = feeUsdForUsd(usd);
  let feeLamports = Math.floor((feeUsd / solUsd) * 1e9);
  if (feeLamports >= depositLamports) feeLamports = Math.max(0, depositLamports - 1);
  const netLamports = depositLamports - feeLamports;
  return { feeLamports, netLamports, feeUsd, usd };
}
