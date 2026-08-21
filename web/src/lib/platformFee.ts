/* Platform fee config — OrbitX launchpad trading + launch fees.
   - Launch fee: flat $0.90 (in SOL), identical on BOTH lanes (pump + custom),
     routed to PLATFORM_WALLET at launch time.
   - In-app Jupiter/DEX swap fee: min(1.2% of USD notional, $10), backend-enforced
     via web/shared/platform-tx-fee.js (Jupiter platformFeeBps cannot USD-cap).
   - Trading fee: 0.45% per buy/sell on OrbitX-launched tokens (creator split).
     Of every $1 of trading fees claimed:
       · $0.013 (1.3%) → admin (ROUTED_FEE_WALLET, claimable on Launchpad Admin)
       · $0.987 (98.7%) → token creator (Claim Fees page) */
import { PublicKey } from "@solana/web3.js";
import { PLATFORM_TX_FEE_BPS } from "../../shared/platform-tx-fee.js";

export const PLATFORM_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";
export const PLATFORM_FEE_BPS = PLATFORM_TX_FEE_BPS;
export const PLATFORM_FEE_ENABLED = true;
/* Launch fee — $0.90 flat on pump + custom lanes (paid in SOL at launch). */
export const BASE_LAUNCH_FEE_USD = 0.9;
export const LAUNCH_FEE_PROMO_END = 0; // promo ended — fee active immediately
export const isLaunchFeePromoActive = (): boolean => Date.now() < LAUNCH_FEE_PROMO_END;
export const launchFeePromoDaysLeft = (): number =>
  Math.max(0, Math.ceil((LAUNCH_FEE_PROMO_END - Date.now()) / 86_400_000));
export const LAUNCHPAD_FEE_USD = isLaunchFeePromoActive() ? 0 : BASE_LAUNCH_FEE_USD;

/** Trading fee on every buy/sell of OrbitX-launched tokens (45 bps = 0.45%). */
export const CREATOR_FEE_BPS = 45;

/**
 * How claimed trading fees split (must sum to 100).
 * Example: $1 of fees → $0.013 admin dashboard, $0.987 creator.
 */
export const TRADE_FEE_PLATFORM_SHARE_PCT = 1.3;
export const TRADE_FEE_CREATOR_SHARE_PCT = 98.7;

/** Dollars from every $1 of fees for a share percent (1.3 → "0.013"). */
export function tradeFeeSharePerDollar(pct: number): string {
  const usd = pct / 100;
  const decimals = Number.isInteger(pct) ? 2 : 3;
  return usd.toFixed(decimals);
}

const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

/** Associated token account of the platform wallet for `mint` (Jupiter feeAccount). */
export function deriveFeeAccount(mint: string): string | undefined {
  try {
    const [ata] = PublicKey.findProgramAddressSync(
      [new PublicKey(PLATFORM_WALLET).toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), new PublicKey(mint).toBuffer()],
      ASSOCIATED_TOKEN_PROGRAM_ID,
    );
    return ata.toBase58();
  } catch {
    return undefined;
  }
}
