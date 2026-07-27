/**
 * Owner-side platform fee claim helpers.
 * Fee SOL lands in PLATFORM_WALLET / ROUTED_FEE_WALLET; the matching wallet
 * must be connected to sign a sweep to a payout destination.
 */
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import { PLATFORM_WALLET } from "@/lib/platformFee";
import { ROUTED_FEE_WALLET } from "./feeRouting";
import { getPumpClaimableSol, buildPumpClaimTransaction } from "./claim";

/** Leave enough SOL so the fee wallet can still pay rent + a future tx. */
export const FEE_WALLET_RESERVE_LAMPORTS = 5_000_000; // 0.005 SOL

export const PLATFORM_FEE_SOURCES = [
  { id: "platform", label: "Platform (launch + swap fees)", wallet: PLATFORM_WALLET },
  { id: "routed", label: "Routed revenue (25% of trade fees)", wallet: ROUTED_FEE_WALLET },
] as const;

export type PlatformFeeSourceId = (typeof PLATFORM_FEE_SOURCES)[number]["id"];

export function matchFeeSource(connected: string | null | undefined) {
  if (!connected) return null;
  return PLATFORM_FEE_SOURCES.find((s) => s.wallet === connected) ?? null;
}

/** Claimable native SOL above the reserve floor. */
export async function getSweepableSol(connection: Connection, wallet: string): Promise<number> {
  const bal = await connection.getBalance(new PublicKey(wallet), "confirmed");
  return Math.max(0, bal - FEE_WALLET_RESERVE_LAMPORTS) / LAMPORTS_PER_SOL;
}

/** Build a SystemProgram transfer sweeping claimable SOL to `destination`. */
export async function buildPlatformFeeSweepTx(
  connection: Connection,
  fromWallet: string,
  destination: string,
): Promise<{ tx: Transaction; lamports: number; sol: number }> {
  const from = new PublicKey(fromWallet);
  const to = new PublicKey(destination);
  if (from.equals(to)) throw new Error("Destination must be a different wallet than the fee source");

  const bal = await connection.getBalance(from, "confirmed");
  const lamports = bal - FEE_WALLET_RESERVE_LAMPORTS;
  if (lamports <= 0) throw new Error("Nothing to claim — balance is at/below the 0.005 SOL reserve");

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction();
  tx.feePayer = from;
  tx.recentBlockhash = blockhash;
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 }));
  tx.add(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports }));
  return { tx, lamports, sol: lamports / LAMPORTS_PER_SOL, blockhash, lastValidBlockHeight };
}

/** Pump creator-vault claimable for a fee wallet (if it ever launched coins). */
export async function getPlatformPumpClaimableSol(connection: Connection, wallet: string): Promise<number> {
  return getPumpClaimableSol(connection, new PublicKey(wallet));
}

export async function buildPlatformPumpClaimTx(wallet: string) {
  return buildPumpClaimTransaction(new PublicKey(wallet));
}

export { LAMPORTS_PER_SOL };
