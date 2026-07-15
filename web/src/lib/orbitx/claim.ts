/**
 * Orbitx creator-fee claims — both lanes, in-app, non-custodial.
 *
 * PUMP LANE — the exact system pump.fun itself uses:
 *   Creator fees accrue in the Pump program's creator-vault PDA
 *   (seeds ["creator-vault", creator]). Claiming runs the Pump program's
 *   `collectCreatorFee` instruction, built by PumpPortal /api/trade-local
 *   (action "collectCreatorFee") and SIGNED BY THE SAME WALLET THAT CREATED
 *   the coins. One claim collects fees across ALL of the wallet's pump coins
 *   (bonding curve + graduated PumpSwap pools).
 *
 * CUSTOM LANE — same economics, enforced by the Token-2022 transfer-fee
 *   extension: 0.30% of every buy/sell is withheld on-chain. Only the
 *   creator wallet (withdraw-withheld authority) can claim, by signing
 *   WithdrawWithheldTokensFromAccounts / ...FromMint.
 */
import {
  Connection, PublicKey, Transaction, VersionedTransaction, LAMPORTS_PER_SOL, ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, unpackMint, unpackAccount, getTransferFeeConfig, getTransferFeeAmount,
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction, createWithdrawWithheldTokensFromMintInstruction,
} from "@solana/spl-token";

/* ─────────────────────────── Pump lane ─────────────────────────── */

export const PUMP_PROGRAM_ID = new PublicKey("6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P");

/** Pump program creator-vault PDA — where pump.fun accrues this wallet's creator fees. */
export function pumpCreatorVaultPda(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("creator-vault"), creator.toBuffer()],
    PUMP_PROGRAM_ID,
  )[0];
}

/** Claimable pump.fun creator fees (SOL) sitting in the wallet's creator vault. */
export async function getPumpClaimableSol(connection: Connection, creator: PublicKey): Promise<number> {
  const vault = pumpCreatorVaultPda(creator);
  const [bal, rentFloor] = await Promise.all([
    connection.getBalance(vault),
    connection.getMinimumBalanceForRentExemption(0),
  ]);
  return Math.max(0, bal - rentFloor) / LAMPORTS_PER_SOL;
}

/**
 * Build the pump.fun claim transaction via PumpPortal (action "collectCreatorFee").
 * Must be signed by the creator wallet. Claims across all the wallet's pump coins.
 */
export async function buildPumpClaimTransaction(creator: PublicKey): Promise<VersionedTransaction> {
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.toBase58(),
      action: "collectCreatorFee",
      priorityFee: 0.000001,
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`PumpPortal claim build failed (${res.status}): ${msg || res.statusText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return VersionedTransaction.deserialize(bytes);
}

/* ─────────────────────────── Custom lane ─────────────────────────── */

export interface CustomClaimable {
  /** Raw withheld amount (token base units) across holder accounts. */
  accountsWithheldRaw: bigint;
  /** Raw withheld amount already harvested into the mint itself. */
  mintWithheldRaw: bigint;
  totalRaw: bigint;
  decimals: number;
  /** Human-readable total. */
  totalUi: number;
  /** Holder token accounts carrying withheld fees. */
  feeAccounts: PublicKey[];
  /** The on-chain withdraw authority (must equal the connected wallet to claim). */
  withdrawAuthority: string | null;
  feeBps: number;
}

/** Scan a custom token's accrued (unclaimed) 0.30% trading fees. */
export async function getCustomClaimable(connection: Connection, mintAddr: string): Promise<CustomClaimable> {
  const mint = new PublicKey(mintAddr);
  const mintInfo = await connection.getAccountInfo(mint, "confirmed");
  if (!mintInfo) throw new Error("Mint not found on-chain");
  const parsedMint = unpackMint(mint, mintInfo, TOKEN_2022_PROGRAM_ID);
  const feeCfg = getTransferFeeConfig(parsedMint);
  if (!feeCfg) throw new Error("Token has no transfer-fee config (not a custom-lane token)");

  const mintWithheldRaw = BigInt(feeCfg.withheldAmount.toString());
  const withdrawAuthority = feeCfg.withdrawWithheldAuthority?.toBase58() ?? null;
  const feeBps = feeCfg.newerTransferFee.transferFeeBasisPoints;

  // All token accounts for this mint that carry withheld fees.
  const accounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
  });
  const feeAccounts: PublicKey[] = [];
  let accountsWithheldRaw = BigInt(0);
  for (const { pubkey, account } of accounts) {
    try {
      const parsed = unpackAccount(pubkey, account, TOKEN_2022_PROGRAM_ID);
      const feeAmt = getTransferFeeAmount(parsed);
      if (feeAmt && feeAmt.withheldAmount > BigInt(0)) {
        feeAccounts.push(pubkey);
        accountsWithheldRaw += BigInt(feeAmt.withheldAmount.toString());
      }
    } catch { /* skip non-token accounts */ }
  }

  const totalRaw = accountsWithheldRaw + mintWithheldRaw;
  return {
    accountsWithheldRaw,
    mintWithheldRaw,
    totalRaw,
    decimals: parsedMint.decimals,
    totalUi: Number(totalRaw) / 10 ** parsedMint.decimals,
    feeAccounts,
    withdrawAuthority,
    feeBps,
  };
}

const MAX_ACCOUNTS_PER_WITHDRAW = 25;

/**
 * Build claim transaction(s): withdraw all withheld fees (holder accounts +
 * mint) to the creator's own token account. Signer must be the withdraw
 * authority — i.e. the SAME WALLET THAT CREATED the token.
 */
export function buildCustomClaimTransactions(
  mintAddr: string,
  creator: PublicKey,
  claimable: CustomClaimable,
): Transaction[] {
  const mint = new PublicKey(mintAddr);
  const destAta = getAssociatedTokenAddressSync(mint, creator, false, TOKEN_2022_PROGRAM_ID);
  const txs: Transaction[] = [];

  const first = new Transaction();
  first.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));
  // Make sure the destination exists (idempotent — no-op if it already does).
  first.add(createAssociatedTokenAccountIdempotentInstruction(creator, destAta, creator, mint, TOKEN_2022_PROGRAM_ID));
  if (claimable.mintWithheldRaw > BigInt(0)) {
    first.add(createWithdrawWithheldTokensFromMintInstruction(mint, destAta, creator, [], TOKEN_2022_PROGRAM_ID));
  }
  const chunks: PublicKey[][] = [];
  for (let i = 0; i < claimable.feeAccounts.length; i += MAX_ACCOUNTS_PER_WITHDRAW) {
    chunks.push(claimable.feeAccounts.slice(i, i + MAX_ACCOUNTS_PER_WITHDRAW));
  }
  if (chunks.length > 0) {
    first.add(createWithdrawWithheldTokensFromAccountsInstruction(
      mint, destAta, creator, [], chunks[0], TOKEN_2022_PROGRAM_ID,
    ));
  }
  txs.push(first);

  for (const chunk of chunks.slice(1)) {
    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }));
    tx.add(createWithdrawWithheldTokensFromAccountsInstruction(
      mint, destAta, creator, [], chunk, TOKEN_2022_PROGRAM_ID,
    ));
    txs.push(tx);
  }
  return txs;
}
