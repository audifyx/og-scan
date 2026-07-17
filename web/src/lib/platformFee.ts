/* Platform fee config — pump.fun fee-structure parity (see pump.fun/docs/fees).
   - Launch fee: flat $1.50 (in SOL), identical on BOTH lanes (pump + custom),
     routed to PLATFORM_WALLET at launch time.
   - In-app swap fee: 0.95% — the same protocol-fee rate pump.fun charges on
     its bonding curve (0.95%) — routed to the platform wallet's ATA via
     Jupiter's feeAccount.
   - Creator trading fee: 0.30% per buy/sell (pump.fun bonding-curve creator
     rate). On the pump lane this is native pump.fun behaviour; on the custom
     lane it's enforced on-chain via the Token-2022 transfer-fee extension
     (see lib/orbitx/token22.ts) and claimable in-app at /orbitxlaunch/claim. */
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

/** Creator fee charged on every buy/sell — pump.fun bonding-curve creator rate. */
export const CREATOR_FEE_BPS = 30;            // 0.30%

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
