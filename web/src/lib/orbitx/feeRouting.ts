/**
 * OrbitX fee routing — platform revenue-share taken at CLAIM time.
 *
 * Trading fee on OrbitX launches is 0.45% (CREATOR_FEE_BPS). Of every $1 claimed:
 *   · $0.25 (25%) → ROUTED_FEE_WALLET (admin dashboard claim)
 *   · $0.75 (75%) → token creator
 *
 * WHY claim-time (and not per-trade): on the pump lane, pump.fun credits 100%
 * of creator fees to the creator-vault PDA; we can't intercept individual
 * buys/sells. The one point OrbitX controls is the claim transaction the user
 * signs in the ClaimPad. So the platform cut is skimmed from the amount being
 * claimed, in the SAME transaction the user signs (atomic, transparent).
 *
 * Custom lane Token-2022 withholds the full 0.45% on-chain; the same 25% skim
 * applies when the creator claims + swaps to SOL.
 *
 * Values are overridable at runtime (see loadFeeRoutingConfig) so the
 * percentage and destination can be tuned from the admin panel without a
 * redeploy.
 */
import { PublicKey } from "@solana/web3.js";
import { TRADE_FEE_PLATFORM_SHARE_PCT } from "@/lib/platformFee";

/** Destination for routed platform-revenue-share fees (separate from the
 *  launch/swap PLATFORM_WALLET). */
export const ROUTED_FEE_WALLET = "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb";

/** Platform share skimmed from each claim, in basis points.
 *  2500 = 25% → matches TRADE_FEE_PLATFORM_SHARE_PCT. */
export const DEFAULT_ROUTED_FEE_BPS = TRADE_FEE_PLATFORM_SHARE_PCT * 100;

/** Hard ceiling so a mis-config can never skim more than this (50%). */
export const MAX_ROUTED_FEE_BPS = 5000;

export const ROUTED_FEE_ENABLED = true;

export interface FeeRoutingConfig {
  enabled: boolean;
  /** Basis points skimmed from each claim (clamped to [0, MAX_ROUTED_FEE_BPS]). */
  bps: number;
  /** Base58 wallet that receives the skim. */
  wallet: string;
}

export const DEFAULT_FEE_ROUTING: FeeRoutingConfig = {
  enabled: ROUTED_FEE_ENABLED,
  bps: DEFAULT_ROUTED_FEE_BPS,
  wallet: ROUTED_FEE_WALLET,
};

/** Clamp + validate an arbitrary bps input to the allowed range. */
export function clampRoutedBps(bps: number): number {
  if (!Number.isFinite(bps) || bps <= 0) return 0;
  return Math.min(Math.round(bps), MAX_ROUTED_FEE_BPS);
}

/** Validate a base58 pubkey string; returns a PublicKey or throws a clear error. */
export function routedFeeDestination(wallet: string = ROUTED_FEE_WALLET): PublicKey {
  try {
    return new PublicKey(wallet);
  } catch {
    throw new Error(`Invalid routed-fee wallet: ${wallet}`);
  }
}

/**
 * Compute the platform skim (in the same base unit as `grossRaw`, e.g. lamports
 * for the pump lane or token base units for the custom lane) and the net that
 * remains for the claimer. Uses BigInt to avoid precision loss on-chain.
 */
export function computeSkim(grossRaw: bigint, cfg: FeeRoutingConfig = DEFAULT_FEE_ROUTING): { skimRaw: bigint; netRaw: bigint } {
  if (!cfg.enabled) return { skimRaw: BigInt(0), netRaw: grossRaw };
  const bps = BigInt(clampRoutedBps(cfg.bps));
  const skimRaw = (grossRaw * bps) / BigInt(10_000);
  return { skimRaw, netRaw: grossRaw - skimRaw };
}

/** Human-readable percent for UI (e.g. 25 for 2500 bps). */
export const bpsToPct = (bps: number): number => bps / 100;
