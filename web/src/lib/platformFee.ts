/* Platform fee config (Phase 4).
   Solana-only: 1% trading fee + $1.50 launchpad fee, routed to the platform wallet. */
import { PublicKey } from "@solana/web3.js";

export const PLATFORM_WALLET = "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE";
export const PLATFORM_FEE_BPS = 100;          // 1% trading fee
export const PLATFORM_FEE_ENABLED = true;     // kill-switch if a fee account issue arises
export const LAUNCHPAD_FEE_USD = 1.5;         // Solana launch fee (other chains free)

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
