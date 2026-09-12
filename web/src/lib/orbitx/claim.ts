/**
 * Orbitx creator-fee claims — both lanes, in-app, non-custodial.
 *
 * PUMP LANE — Pump program creator-vault PDA (seeds ["creator-vault", creator]).
 *   Primary instruction is permissionless `collect_creator_fee_v2` (creator is
 *   the destination, not a required ix signer). Anyone may pay gas; SOL still
 *   lands in the registered creator. Built locally — PumpPortal/Helius
 *   "max usage reached" / "used usage" is never on the hot path.
 *   Do not mix collect_* with fee-sharing coins (Pump Fees program owner).
 *
 * CUSTOM LANE — Token-2022 transfer-fee extension: 0.45% withheld on-chain.
 *   Only the creator wallet (withdraw-withheld authority) can claim.
 */
import {
  Connection, PublicKey, Transaction, TransactionInstruction, VersionedTransaction, LAMPORTS_PER_SOL, ComputeBudgetProgram,
  TransactionMessage, SystemProgram, type AddressLookupTableAccount,
} from "@solana/web3.js";
import {
  COLLECT_CREATOR_FEE_DISCRIMINATOR,
  COLLECT_CREATOR_FEE_V2_DISCRIMINATOR,
  CLAIM_RPC_URLS,
  PUMP_CREATOR_VAULT_SEED,
  PUMP_EVENT_AUTHORITY_SEED,
  PUMP_FEES_PROGRAM_ID as PUMP_FEES_PROGRAM_ID_STR,
  PUMP_PROGRAM_ID as PUMP_PROGRAM_ID_STR,
  SYSTEM_ACCOUNT_RENT_LAMPORTS,
  isRpcQuotaError,
  isRpcUnavailableError,
} from "../../../shared/pump-claim.js";
import { buildJupiterSwapTransaction, SOL_MINT } from "./rescue";
import { computeSkim, routedFeeDestination, DEFAULT_FEE_ROUTING, type FeeRoutingConfig } from "./feeRouting";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID,
  unpackMint, unpackAccount, getTransferFeeConfig, getTransferFeeAmount,
  getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createWithdrawWithheldTokensFromAccountsInstruction, createWithdrawWithheldTokensFromMintInstruction,
} from "@solana/spl-token";

/* ─────────────────────────── Pump lane ─────────────────────────── */

export const PUMP_PROGRAM_ID = new PublicKey(PUMP_PROGRAM_ID_STR);
export const PUMP_FEES_PROGRAM_ID = new PublicKey(PUMP_FEES_PROGRAM_ID_STR);
export { isRpcQuotaError, isRpcUnavailableError, SYSTEM_ACCOUNT_RENT_LAMPORTS, CLAIM_RPC_URLS };

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

/** Legacy `collect_creator_fee` — creator MUST sign. Do not send; v2 replaced it. */
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

/**
 * Permissionless `collect_creator_fee_v2`. Creator is the destination (writable,
 * not a required ix signer). For SOL-paired coins the program transfers lamports
 * from the vault and ignores the token accounts.
 */
export function buildCollectCreatorFeeV2Instruction(
  creator: PublicKey,
  quoteMint: PublicKey = SOL_MINT,
  quoteTokenProgram: PublicKey = TOKEN_PROGRAM_ID,
): TransactionInstruction {
  const vault = pumpCreatorVaultPda(creator);
  const creatorAta = getAssociatedTokenAddressSync(quoteMint, creator, true, quoteTokenProgram);
  const vaultAta = getAssociatedTokenAddressSync(quoteMint, vault, true, quoteTokenProgram);
  return new TransactionInstruction({
    programId: PUMP_PROGRAM_ID,
    keys: [
      { pubkey: creator, isSigner: false, isWritable: true },
      { pubkey: creatorAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: vaultAta, isSigner: false, isWritable: true },
      { pubkey: quoteMint, isSigner: false, isWritable: false },
      { pubkey: quoteTokenProgram, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: pumpEventAuthorityPda(), isSigner: false, isWritable: false },
      { pubkey: PUMP_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Uint8Array.from(COLLECT_CREATOR_FEE_V2_DISCRIMINATOR),
  });
}

function claimRpcConnections(preferred?: Connection): Connection[] {
  const tried = new Set<string>();
  const out: Connection[] = [];
  if (preferred) {
    out.push(preferred);
    if (preferred.rpcEndpoint) tried.add(preferred.rpcEndpoint);
  }
  for (const url of CLAIM_RPC_URLS) {
    if (tried.has(url)) continue;
    tried.add(url);
    out.push(new Connection(url, "confirmed"));
  }
  return out;
}

async function withRpcFallback<T>(preferred: Connection | undefined, fn: (conn: Connection) => Promise<T>): Promise<T> {
  let lastErr: unknown;
  for (const conn of claimRpcConnections(preferred)) {
    try {
      return await fn(conn);
    } catch (e) {
      lastErr = e;
      if (!isRpcUnavailableError(e)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Solana RPC failed"));
}

/** Latest blockhash from the first working claim RPC (skips exhausted Helius). */
export async function getClaimBlockhash(connection?: Connection) {
  return withRpcFallback(connection, (conn) => conn.getLatestBlockhash("confirmed"));
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

async function assertNotSharingConfig(connection: Connection | undefined, creator: PublicKey): Promise<void> {
  try {
    const info = await withRpcFallback(connection, (conn) => conn.getAccountInfo(creator, "confirmed"));
    if (info && info.owner.equals(PUMP_FEES_PROGRAM_ID)) {
      throw new Error(
        "This wallet's creator fees were migrated to a sharing config. collect_creator_fee cannot drain them.",
      );
    }
  } catch (e) {
    if (e instanceof Error && /sharing config/i.test(e.message)) throw e;
  }
}

/** Local permissionless collect_creator_fee_v2 + compute budget. No PumpPortal / Helius. */
export async function buildLocalPumpClaimTransaction(
  creator: PublicKey,
  connection?: Connection,
): Promise<VersionedTransaction> {
  await assertNotSharingConfig(connection, creator);
  const { blockhash } = await getClaimBlockhash(connection);
  const message = new TransactionMessage({
    payerKey: creator,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 10_000 }),
      buildCollectCreatorFeeV2Instruction(creator),
    ],
  }).compileToV0Message();
  return new VersionedTransaction(message);
}

/**
 * Build the pump.fun claim transaction locally via collect_creator_fee_v2.
 * PumpPortal is skipped — its Helius backend returns "max usage reached".
 */
export async function buildPumpClaimTransaction(
  creator: PublicKey,
  connection?: Connection,
): Promise<VersionedTransaction> {
  return buildLocalPumpClaimTransaction(creator, connection);
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
  const mintInfo = await withRpcFallback(connection, (conn) => conn.getAccountInfo(mint, "confirmed"));
  if (!mintInfo) throw new Error("Mint not found on-chain");
  const parsedMint = unpackMint(mint, mintInfo, TOKEN_2022_PROGRAM_ID);
  const feeCfg = getTransferFeeConfig(parsedMint);
  if (!feeCfg) throw new Error("Token has no transfer-fee config (not a custom-lane token)");

  const mintWithheldRaw = BigInt(feeCfg.withheldAmount.toString());
  const withdrawAuthority = feeCfg.withdrawWithheldAuthority?.toBase58() ?? null;
  const feeBps = feeCfg.newerTransferFee.transferFeeBasisPoints;

  // All token accounts for this mint that carry withheld fees.
  const accounts = await withRpcFallback(connection, (conn) => conn.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
  }));
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
