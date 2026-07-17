// Orbitx Launchpad — fee model (pump.fun parity).
// The fee STRUCTURE mirrors pump.fun (see pump.fun/docs/fees):
//   - trading: 0.30% creator fee on every buy/sell (pump bonding-curve creator rate)
//   - platform: 0.95% protocol-rate swap fee on in-app swaps
// plus one flat Orbitx launch fee, IDENTICAL on both lanes ($1.50, converted
// to SOL live so it stays constant in dollar terms).
import { LAUNCHPAD_FEE_USD, CREATOR_FEE_BPS } from "@/lib/platformFee";

export const ORBITX_FEE_USD = LAUNCHPAD_FEE_USD; // flat Orbitx launch fee — same on pump + custom lanes ($0 during promo)
export {
  BASE_LAUNCH_FEE_USD, LAUNCH_FEE_PROMO_END,
  isLaunchFeePromoActive, launchFeePromoDaysLeft,
} from "@/lib/platformFee";
export { CREATOR_FEE_BPS };                      // 0.30% per buy/sell, claimable by the creator

// Real, approximate on-chain costs (mainnet). These are the user's cost, not ours.
export const RAYDIUM_POOL_FEE_SOL = 0.15; // Raydium CPMM pool-creation protocol fee
export const MINT_COST_SOL = 0.012;       // mint rent + metadata + ATA + tx fees

const FALLBACK_SOL_USD = 150; // used only if the live price feed is unreachable

let cache: { price: number; ts: number } | null = null;

/** Live SOL/USD. Cached 60s. Falls back to a constant if the feed is down. */
export async function getSolUsd(): Promise<{ price: number; live: boolean }> {
  if (cache && Date.now() - cache.ts < 60_000) return { price: cache.price, live: true };
  try {
    const r = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) throw new Error(String(r.status));
    const j = (await r.json()) as { solana?: { usd?: number } };
    const price = j?.solana?.usd;
    if (!price || !Number.isFinite(price)) throw new Error("bad price");
    cache = { price, ts: Date.now() };
    return { price, live: true };
  } catch {
    return { price: FALLBACK_SOL_USD, live: false };
  }
}

/** Convert a USD amount to SOL at the given SOL/USD price. */
export function usdToSol(usd: number, solUsd: number): number {
  if (!solUsd) return 0;
  return usd / solUsd;
}

export interface FeeBreakdown {
  orbitxFeeUsd: number;
  orbitxFeeSol: number;
  mintCostSol: number;
  poolFeeSol: number;   // 0 when no auto-LP
  liquiditySol: number; // user-seeded capital (recoverable / lockable), NOT a fee
  totalOutOfPocketSol: number; // everything the wallet is debited at launch
  solUsd: number;
  priceLive: boolean;
}

/**
 * Build the full launch cost breakdown.
 * @param withAutoLp whether a DEX pool is auto-created (adds the pool fee)
 * @param liquiditySol how much SOL the user chooses to seed into the pool
 */
export async function computeFee(withAutoLp: boolean, liquiditySol: number): Promise<FeeBreakdown> {
  const { price, live } = await getSolUsd();
  const orbitxFeeSol = usdToSol(ORBITX_FEE_USD, price);
  const poolFeeSol = withAutoLp ? RAYDIUM_POOL_FEE_SOL : 0;
  const seed = Math.max(0, Number(liquiditySol) || 0);
  return {
    orbitxFeeUsd: ORBITX_FEE_USD,
    orbitxFeeSol,
    mintCostSol: MINT_COST_SOL,
    poolFeeSol,
    liquiditySol: seed,
    totalOutOfPocketSol: orbitxFeeSol + MINT_COST_SOL + poolFeeSol + seed,
    solUsd: price,
    priceLive: live,
  };
}

export const fmtSol = (n: number, dp = 4) => `${n.toFixed(dp)} SOL`;
export const fmtUsd = (n: number) => `$${n.toFixed(2)}`;
