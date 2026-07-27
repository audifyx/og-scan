/* Platform fee config — OrbitX launchpad trading + launch fees.
   - Launch fee: flat $1.50 (in SOL), identical on BOTH lanes (pump + custom),
     routed to PLATFORM_WALLET at launch time.
   - In-app swap fee: 0.95% — protocol-rate swap fee on Jupiter swaps,
     routed to the platform wallet's ATA via Jupiter's feeAccount.
   - Trading fee: 0.45% per buy/sell on OrbitX-launched tokens.
     Of every $1 of trading fees claimed:
       · $0.25 (25%) → admin (ROUTED_FEE_WALLET, claimable on Launchpad Admin)
       · $0.75 (75%) → token creator (Claim Fees page)
     Custom lane: enforced on-chain via Token-2022 transfer-fee (see token22.ts).
     Pump lane: pump.fun accrues creator fees to the vault; OrbitX skims the
     25% platform share at claim time (see feeRouting.ts). */
import { PublicKey } from "@solana/web3.js";

export const PLATFORM_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";
export const PLATFORM_FEE_BPS = 95;           // 0.95% swap fee — pump.fun protocol-fee rate
export const PLATFORM_FEE_ENABLED = true;     // kill-switch if a fee account issue arises
/* ── 30-DAY FREE-LAUNCH PROMO ────────────────────────────────────────
   All launches are FREE (fee = $0) until LAUNCH_FEE_PROMO_END. After the
   promo window passes, the flat $1.50 launch fee resumes automatically on
   the next page load — no redeploy needed. Started 2026-07-17. */
export const BASE_LAUNCH_FEE_USD = 1.5;      // normal flat launch fee — SAME on pump + custom lanes
export const LAUNCH_FEE_PROMO_END = Date.parse("2026-08-16T09:33:00Z"); // exactly 30 days from promo start (2026-07-17 09:33 UTC)
export const isLaunchFeePromoActive = (): boolean => Date.now() < LAUNCH_FEE_PROMO_END;
export const launchFeePromoDaysLeft = (): number =>
  Math.max(0, Math.ceil((LAUNCH_FEE_PROMO_END - Date.now()) / 86_400_000));
export const LAUNCHPAD_FEE_USD = isLaunchFeePromoActive() ? 0 : BASE_LAUNCH_FEE_USD;

/** Trading fee on every buy/sell of OrbitX-launched tokens (45 bps = 0.45%). */
export const CREATOR_FEE_BPS = 45;

/**
 * How claimed trading fees split (must sum to 100).
 * Example: $1 of fees → $0.25 admin dashboard, $0.75 creator.
 */
export const TRADE_FEE_PLATFORM_SHARE_PCT = 25;
export const TRADE_FEE_CREATOR_SHARE_PCT = 75;

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
