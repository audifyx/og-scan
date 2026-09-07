/**
 * Orbitx creator-fee claims — both lanes, in-app, non-custodial.
 *
 * PUMP LANE — the exact system pump.fun itself uses:
 *   Creator fees accrue in the Pump program's creator-vault PDA
 *   (seeds ["creator-vault", creator]). Claiming runs the Pump program's
 *   `collectCreatorFee` instruction, SIGNED BY THE SAME WALLET THAT CREATED
 *   the coins. One claim collects fees across ALL of the wallet's pump coins
 *   (bonding curve + graduated PumpSwap pools).
 *   PumpPortal /api/trade-local is tried first; on 429 "max usage reached"
 *   (Helius quota) we build the instruction locally and use public Solana RPC.
 *
 * CUSTOM LANE — same economics, enforced by the Token-2022 transfer-fee
 *   extension: 0.45% of every buy/sell is withheld on-chain. Only the
 *   creator wallet (withdraw-withheld authority) can claim, by signing
 *   WithdrawWithheldTokensFromAccounts / ...FromMint. At claim time OrbitX
 *   skims 1.3% to the admin wallet and the creator keeps 98.7%.
 */
import {
  Connection, PublicKey, Transaction, TransactionInstruction, VersionedTransaction, LAMPORTS_PER_SOL, ComputeBudgetProgram,
  TransactionMessage, SystemProgram, type AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
  PUBLIC_SOLANA_RPC,
  PUMP_CREATOR_VAULT_SEED,
  PUMP_EVENT_AUTHORITY_SEED,
  PUMP_PROGRAM_ID as PUMP_PROGRAM_ID_STR,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  isRpcQuotaError,
} from "../../../shared/pump-claim.js";
import { buildJupiterSwapTransaction, SOL_MINT } from "./rescue";
import { computeSkim, routedFeeDestination, DEFAULT_FEE_ROUTING, type FeeRoutingConfig } from "./feeRouting";
import {
  TOKEN_2022_PROGRAM_ID, unpackMint, unpackAccount, getTransferFeeConfig, getTransferFeeAmount,
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction, createWithdrawWithheldTokensFromMintInstruction,
} from "@solana/spl-token";

/* ─────────────────────────── Pump lane ─────────────────────────── */

export const PUMP_PROGRAM_ID = new PublicKey(PUMP_PROGRAM_ID_STR);
export { isRpcQuotaError, SYSTEM_ACCOUNT_RENT_LAMPORTS };

/** Pump program creator-vault PDA — where pump.fun accrues this wallet's creator fees. */
export function pumpCreatorVaultPda(creator: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(PUMP_CREATOR_VAULT_SEED), creator.toBytes()],
    PUMP_PROGRAM_ID,
  )[0];
}

export function pumpEventAuthorityPda(): PublicKey {
  return PublicKey.findProgramAddressSync(
    [new TextEncoder().encode(PUMP_EVENT_AUTHORITY_SEED)],
    PUMP_PROGRAM_ID,
  )[0];
}

/** Official Pump `collect_creator_fee` — no PumpPortal / Helius required. */
export function buildCollectCreatorFeeInstruction(creator: PublicKey): TransactionInstruction {
  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: creator, isSigner: true, isWritable: true },
      { pubkey: pumpCreatorVaultPda(creator), isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: pumpEventAuthorityPda(), isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from(COLLECT_CREATOR_FEE_DISCRIMINATOR),
  });
}

function publicRpcConnection(): Connection {
  return new Connection(PUBLIC_SOLANA_RPC, "confirmed");
}

async function withRpcFallback<T>(preferred: Connection | undefined, fn: (conn: Connection) => Promise<T>): Promise<T> {
  const tried = new Set<string>();
  const candidates: Connection[] = [];
  if (preferred) candidates.push(preferred);
  candidates.push(publicRpcConnection());
  let lastErr: unknown;
  for (const conn of candidates) {
    const key = conn.rpcEndpoint;
    if (tried.has(key)) continue;
    tried.add(key);
    try {
      return await fn(conn);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Solana RPC failed"));
}

async function vaultClaimableSol(connection: Connection, vault: PublicKey): Promise<number> {
  const bal = await connection.getBalance(vault);
  let rentFloor = SYSTEM_ACCOUNT_RENT_LAMPORTS;
  try {
    rentFloor = await connection.getMinimumBalanceForRentExemption(0);
  } catch {
    /* ogdex rpc may not allow this method; 890880 is the 0-byte system rent */
  }
  return Math.max(0, bal - rentFloor) / LAMPORTS_PER_SOL;
}

/** Claimable pump.fun creator fees (SOL) sitting in the wallet's creator vault. */
export async function getPumpClaimableSol(connection: Connection, creator: PublicKey): Promise<number> {
  const vault = pumpCreatorVaultPda(creator);
  return withRpcFallback(connection, (conn) => vaultClaimableSol(conn, vault));
}

async function buildPumpClaimViaPumpPortal(creator: PublicKey): Promise<VersionedTransaction> {
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.toBase58(),
      action: "collectCreatorFee",
      priorityFee: 0.000001,
    }),
    signal: typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(8000)
      : undefined,
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`PumpPortal claim build failed (${res.status}): ${msg || res.statusText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return VersionedTransaction.deserialize(bytes);
}

/** Local collectCreatorFee + compute budget. Used when PumpPortal/Helius quota is exhausted. */
export async function buildLocalPumpClaimTransaction(
  creator: PublicKey,
  connection?: Connection,
): Promise<VersionedTransaction> {
  const { blockhash } = await withRpcFallback(connection, (conn) => conn.getLatestBlockhash("confirmed"));
  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
      buildCollectCreatorFeeInstruction(creator),
    ],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/**
 * Build the pump.fun claim transaction. Tries PumpPortal first; on 429
 * "max usage reached" (or any PumpPortal failure) builds collectCreatorFee locally.
 */
export async function buildPumpClaimTransaction(
  creator: PublicKey,
  connection?: Connection,
): Promise<VersionedTransaction> {
  try {
    return await buildPumpClaimViaPumpPortal(creator);
  } catch (e) {
    console.warn("[claim] PumpPortal unavailable, building collectCreatorFee locally", e);
    return buildLocalPumpClaimTransaction(creator, connection);
  }
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

/** Scan a custom token's accrued (unclaimed) 0.45% trading fees. */
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


/* ─────────────────── Platform fee routing (1.3% at claim) ─────────────────── */

/**
 * Append a single SystemProgram.transfer (lamports, `from` → `to`) to an
 * already-built VersionedTransaction, preserving its payer, blockhash and any
 * address-lookup tables. Used to skim the platform revenue-share into the
 * routed-fee wallet atomically inside the same claim/swap the user signs.
 * Resets signatures (the caller signs the returned tx).
 */
export async function appendSolTransferToVersionedTx(
  connection: Connection,
  vtx: VersionedTransaction,
  from: PublicKey,
  to: PublicKey,
  lamports: number,
): Promise<VersionedTransaction> {
  if (!lamports || lamports <= 0) return vtx;
  const lookups = vtx.message.addressTableLookups ?? [];
  const alts: AddressLookupTableAccount[] = [];
  for (const l of lookups) {
    const res = await withRpcFallback(connection, (conn) => conn.getAddressLookupTable(l.accountKey));
    if (res.value) alts.push(res.value);
  }
  const msg = TransactionMessage.decompile(vtx.message, { addressLookupTableAccounts: alts });
  // Keep fee payer as the connected wallet so Phantom/Jupiter only need one signature.
  msg.payerKey = from;
  msg.instructions.push(SystemProgram.transfer({ fromPubkey: from, toPubkey: to, lamports: Math.floor(lamports) }));
  // Fresh unsigned v0 message — caller must sign (do not reuse prior partial sigs).
  return new VersionedTransaction(msg.compileToV0Message(alts));
}

export interface PumpClaimPlan {
  tx: VersionedTransaction;
  grossLamports: number;
  skimLamports: number;
  netLamports: number;
}

/**
 * Build the pump.fun claim transaction WITH the platform revenue-share skim
 * appended: reads the currently-claimable amount, computes the configured cut
 * (default 1.3%), and appends a transfer of that cut to the routed-fee wallet
 * inside the same transaction the creator signs. The creator nets the rest.
 * Fail-closed: if the skim can't be computed/appended it throws rather than
 * claiming without the cut.
 */
export async function buildPumpClaimWithSkim(
  connection: Connection,
  creator: PublicKey,
  cfg: FeeRoutingConfig = DEFAULT_FEE_ROUTING,
): Promise<PumpClaimPlan> {
  const grossSol = await getPumpClaimableSol(connection, creator);
  const grossLamports = Math.floor(grossSol * LAMPORTS_PER_SOL);
  const { skimRaw, netRaw } = computeSkim(BigInt(grossLamports), cfg);
  const skimLamports = Number(skimRaw);
  let tx = await buildPumpClaimTransaction(creator, connection);
  if (skimLamports > 0) {
    tx = await appendSolTransferToVersionedTx(connection, tx, creator, routedFeeDestination(cfg.wallet), skimLamports);
  }
  return { tx, grossLamports, skimLamports, netLamports: Number(netRaw) };
}

/**
 * Build a pump.fun BUY transaction (via PumpPortal) spending `solAmount` SOL on
 * `mint`, signed by the creator. Used for "claim + auto-buyback": after a claim
 * settles, re-buy the creator's own coin with the freshly-claimed SOL.
 * pool:"auto" lets PumpPortal route to the bonding curve or graduated pool.
 */
export async function buildPumpBuyTransaction(
  creator: PublicKey,
  mint: string,
  solAmount: number,
): Promise<VersionedTransaction> {
  const res = await fetch("https://pumpportal.fun/api/trade-local", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.toBase58(),
      action: "buy",
      mint,
      denominatedInSol: "true",
      amount: solAmount,
      slippage: 15,
      priorityFee: 0.00005,
      pool: "auto",
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`PumpPortal buy build failed (${res.status}): ${msg || res.statusText}`);
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  return VersionedTransaction.deserialize(bytes);
}

export interface CustomSwapPlan {
  tx: VersionedTransaction;
  /** Expected SOL out (lamports) before skim. */
  grossLamports: number;
  skimLamports: number;
  netLamports: number;
}

/**
 * Build a Jupiter swap of `amountRaw` of a custom-lane token → SOL for the
 * creator, WITH the platform skim appended. This is how the custom lane pays
 * creator fees "in SOL": the on-chain fee accrues in-token (Token-2022), we
 * withdraw it (see buildCustomClaimTransactions) and then swap it to SOL here.
 */
export async function buildCustomSwapToSolWithSkim(
  connection: Connection,
  creator: PublicKey,
  mint: string,
  amountRaw: bigint,
  cfg: FeeRoutingConfig = DEFAULT_FEE_ROUTING,
): Promise<CustomSwapPlan> {
  const { swapTransactionB64, outAmount } = await buildJupiterSwapTransaction(
    creator, new PublicKey(mint), SOL_MINT, amountRaw, 150,
  );
  const grossLamports = Number(outAmount);
  const { skimRaw, netRaw } = computeSkim(BigInt(outAmount), cfg);
  const skimLamports = Number(skimRaw);
  let tx = VersionedTransaction.deserialize(Buffer.from(swapTransactionB64, "base64"));
  if (skimLamports > 0) {
    tx = await appendSolTransferToVersionedTx(connection, tx, creator, routedFeeDestination(cfg.wallet), skimLamports);
  }
  return { tx, grossLamports, skimLamports, netLamports: Number(netRaw) };
}
