/**
 * Orbitx custom lane — Raydium CPMM pool creation (mainnet).
 *
 * Seeds a real, immediately-tradable SOL pool for a freshly minted custom
 * token. CPMM supports Token-2022 mints with the transfer-fee extension, so
 * the 0.30% creator fee keeps accruing on every pool buy/sell.
 *
 * The Raydium SDK is heavy, so it is imported lazily — only when a launcher
 * actually enables "Add liquidity at launch".
 */
import { Connection, PublicKey, Transaction, ComputeBudgetProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddressSync,
  createTransferCheckedInstruction, createAssociatedTokenAccountIdempotentInstruction,
} from "@solana/spl-token";

export interface CreatePoolParams {
  connection: Connection;
  owner: PublicKey;
  signAllTransactions: <T extends import("@solana/web3.js").Transaction | import("@solana/web3.js").VersionedTransaction>(txs: T[]) => Promise<T[]>;
  mint: string;                // custom token mint (Token-2022)
  decimals: number;
  tokenAmountRaw: bigint;      // token base units to seed
  solLamports: bigint;         // SOL lamports to seed
}

export interface CreatePoolResult {
  poolId: string;
  lpMint: string;
  txId: string;
}

const WSOL = "So11111111111111111111111111111111111111112";
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
/** Solana's canonical incinerator — LP sent here is provably gone forever. */
export const INCINERATOR = new PublicKey("1nc1nerator11111111111111111111111111111111");

export async function createCpmmPool(p: CreatePoolParams): Promise<CreatePoolResult> {
  const sdk = await import("@raydium-io/raydium-sdk-v2");
  const { Raydium, TxVersion, CREATE_CPMM_POOL_PROGRAM, CREATE_CPMM_POOL_FEE_ACC } = sdk;
  const BN = (await import("bn.js")).default;

  const raydium = await Raydium.load({
    connection: p.connection,
    owner: p.owner,
    signAllTransactions: p.signAllTransactions,
    cluster: "mainnet",
    disableFeatureCheck: true,
    disableLoadToken: true,
    blockhashCommitment: "confirmed",
  });

  const feeConfigs = await raydium.api.getCpmmConfigs();
  if (!feeConfigs?.length) throw new Error("Could not load Raydium CPMM fee configs");

  // SDK sorts the mint pair internally; amounts follow their mints.
  const { execute, extInfo } = await raydium.cpmm.createPool({
    programId: CREATE_CPMM_POOL_PROGRAM,
    poolFeeAccount: CREATE_CPMM_POOL_FEE_ACC,
    mintA: { address: WSOL, decimals: 9, programId: TOKEN_PROGRAM },
    mintB: { address: p.mint, decimals: p.decimals, programId: TOKEN_2022_PROGRAM_ID.toBase58() },
    mintAAmount: new BN(p.solLamports.toString()),
    mintBAmount: new BN(p.tokenAmountRaw.toString()),
    startTime: new BN(0),
    feeConfig: feeConfigs[0],
    associatedOnly: false,
    ownerInfo: { useSOLBalance: true },
    txVersion: TxVersion.V0,
  });

  const { txId } = await execute({ sendAndConfirm: true });
  const addr = extInfo.address as unknown as Record<string, { toString(): string }>;
  return {
    poolId: addr.poolId.toString(),
    lpMint: addr.lpMint.toString(),
    txId,
  };
}

/**
 * Burn LP forever by transferring the wallet's entire LP balance to the
 * incinerator (LP mint is a classic SPL token).
 */
export async function buildBurnLpTransaction(
  connection: Connection,
  owner: PublicKey,
  lpMintAddr: string,
): Promise<{ tx: Transaction; amountRaw: bigint; decimals: number } | null> {
  const lpMint = new PublicKey(lpMintAddr);
  const TOKEN_PROGRAM_ID = new PublicKey(TOKEN_PROGRAM);
  const ownerAta = getAssociatedTokenAddressSync(lpMint, owner, false, TOKEN_PROGRAM_ID);
  const bal = await connection.getTokenAccountBalance(ownerAta, "confirmed").catch(() => null);
  const amountRaw = BigInt(bal?.value?.amount ?? "0");
  const decimals = bal?.value?.decimals ?? 0;
  if (amountRaw <= BigInt(0)) return null;

  const incAta = getAssociatedTokenAddressSync(lpMint, INCINERATOR, true, TOKEN_PROGRAM_ID);
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }));
  tx.add(createAssociatedTokenAccountIdempotentInstruction(owner, incAta, INCINERATOR, lpMint, TOKEN_PROGRAM_ID));
  tx.add(createTransferCheckedInstruction(ownerAta, lpMint, incAta, owner, amountRaw, decimals, [], TOKEN_PROGRAM_ID));
  return { tx, amountRaw, decimals };
}
