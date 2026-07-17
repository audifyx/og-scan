/**
 * Orbitx Rescue — "Rent Refund" + "Burn" utilities.
 *
 * RENT REFUND
 *   Every SPL token account costs ~0.00203 SOL in rent. Once its balance hits
 *   zero (sold, burned, dusted) that rent just sits there until the account
 *   is closed. This scans the wallet's token accounts (both legacy SPL Token
 *   and Token-2022), finds the empty ones, and closes them — reclaiming the
 *   exact rent lamports back to the owner. Optionally the reclaimed SOL can
 *   be swapped to USDC via Jupiter in the same flow.
 *
 * BURN
 *   Standard SPL/Token-2022 `burn` instruction, signed by the holder. A user
 *   can only ever burn tokens sitting in their own account — this never
 *   touches supply they don't hold. Percent presets are computed against the
 *   mint's total supply (capped to what the wallet actually holds); manual
 *   entry burns the exact raw token count typed, independent of USD value.
 */
import {
  Connection, PublicKey, Transaction, TransactionInstruction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID,
  createCloseAccountInstruction, createBurnInstruction,
} from "@solana/spl-token";

export const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const JUP_QUOTE_API = "https://quote-api.jup.ag/v6/quote";
const JUP_SWAP_API = "https://quote-api.jup.ag/v6/swap";

/* ─────────────────────────── Rent refund ─────────────────────────── */

export type EmptyTokenAccount = {
  pubkey: PublicKey;
  mint: string;
  programId: PublicKey;
  lamports: number;
};

/** Scan both token programs for zero-balance accounts owned by `owner`. */
export async function scanEmptyTokenAccounts(
  connection: Connection,
  owner: PublicKey,
): Promise<EmptyTokenAccount[]> {
  const [legacy, token22] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);

  const all = [
    ...legacy.value.map((a) => ({ ...a, programId: TOKEN_PROGRAM_ID })),
    ...token22.value.map((a) => ({ ...a, programId: TOKEN_2022_PROGRAM_ID })),
  ];

  return all
    .filter((a) => {
      const info = a.account.data.parsed.info;
      return Number(info.tokenAmount.amount) === 0 && !info.isNative;
    })
    .map((a) => ({
      pubkey: a.pubkey,
      mint: a.account.data.parsed.info.mint as string,
      programId: a.programId,
      lamports: a.account.lamports,
    }));
}

export function totalReclaimableSol(accounts: EmptyTokenAccount[]): number {
  return accounts.reduce((sum, a) => sum + a.lamports, 0) / 1e9;
}

/**
 * Build one or more close-account transactions for the given empty accounts.
 * Batches ~20 instructions per tx to stay under the transaction size limit.
 */
export function buildCloseAccountsTransactions(
  owner: PublicKey,
  accounts: EmptyTokenAccount[],
  batchSize = 20,
): Transaction[] {
  const txs: Transaction[] = [];
  for (let i = 0; i < accounts.length; i += batchSize) {
    const batch = accounts.slice(i, i + batchSize);
    const tx = new Transaction();
    for (const a of batch) {
      tx.add(createCloseAccountInstruction(a.pubkey, owner, owner, [], a.programId));
    }
    txs.push(tx);
  }
  return txs;
}

export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111");

/** Generic Jupiter quote + swap-transaction builder. */
export async function buildJupiterSwapTransaction(
  owner: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey,
  amountRaw: bigint,
  slippageBps = 100,
): Promise<{ swapTransactionB64: string; outAmount: string }> {
  const quoteUrl = `${JUP_QUOTE_API}?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${amountRaw.toString()}&slippageBps=${slippageBps}`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) throw new Error("Jupiter quote failed");
  const quote = await quoteRes.json();
  if (quote.error) throw new Error(quote.error);

  const swapRes = await fetch(JUP_SWAP_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: owner.toBase58(),
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: "auto",
    }),
  });
  if (!swapRes.ok) throw new Error("Jupiter swap build failed");
  const swap = await swapRes.json();
  return { swapTransactionB64: swap.swapTransaction, outAmount: quote.outAmount };
}

/** Fetch a Jupiter swap transaction converting `lamportsIn` SOL → USDC for `owner`. */
export async function buildSolToUsdcSwapTransaction(
  owner: PublicKey,
  lamportsIn: number,
): Promise<{ swapTransactionB64: string; outAmount: string }> {
  return buildJupiterSwapTransaction(owner, SOL_MINT, USDC_MINT, BigInt(lamportsIn));
}

/**
 * "Sell all" — for every held token (excluding the target mint itself),
 * build a Jupiter swap transaction that sells the wallet's ENTIRE balance of
 * that token into `targetMint` (USDC_MINT or SOL_MINT). Quote-building runs
 * per-token so one bad/illiquid mint doesn't block the rest — failures are
 * returned alongside successes so the caller can report per-token status.
 */
export type SellAllQuote =
  | { mint: string; ok: true; swapTransactionB64: string; outAmount: string }
  | { mint: string; ok: false; error: string };

export async function buildSellAllQuotes(
  owner: PublicKey,
  tokens: BurnableToken[],
  targetMint: PublicKey,
): Promise<SellAllQuote[]> {
  const sellable = tokens.filter((t) => t.mint !== targetMint.toBase58() && t.balanceRaw > BigInt(0));
  const results: SellAllQuote[] = [];
  for (const t of sellable) {
    try {
      const { swapTransactionB64, outAmount } = await buildJupiterSwapTransaction(
        owner, new PublicKey(t.mint), targetMint, t.balanceRaw,
      );
      results.push({ mint: t.mint, ok: true, swapTransactionB64, outAmount });
    } catch (e) {
      results.push({ mint: t.mint, ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return results;
}

/* ─────────────────────────── Burn ─────────────────────────── */

export type BurnableToken = {
  mint: string;
  programId: PublicKey;
  tokenAccount: PublicKey;
  decimals: number;
  balanceRaw: bigint;   // held by this wallet
  supplyRaw: bigint;    // total supply of the mint
  symbol?: string;
  logoUrl?: string;
};

/** Scan the wallet for tokens it holds (balance > 0), with mint supply/decimals attached. */
export async function scanBurnableTokens(
  connection: Connection,
  owner: PublicKey,
): Promise<BurnableToken[]> {
  const [legacy, token22] = await Promise.all([
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_PROGRAM_ID }),
    connection.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM_ID }),
  ]);

  const all = [
    ...legacy.value.map((a) => ({ ...a, programId: TOKEN_PROGRAM_ID })),
    ...token22.value.map((a) => ({ ...a, programId: TOKEN_2022_PROGRAM_ID })),
  ];

  const held = all.filter((a) => {
    const info = a.account.data.parsed.info;
    return Number(info.tokenAmount.amount) > 0 && !info.isNative;
  });

  const mintPubkeys = held.map((a) => new PublicKey(a.account.data.parsed.info.mint));
  const mintInfos = await connection.getMultipleParsedAccounts(mintPubkeys);

  return held.map((a, i) => {
    const info = a.account.data.parsed.info;
    const mintParsed = mintInfos.value[i]?.data && "parsed" in mintInfos.value[i]!.data
      ? (mintInfos.value[i]!.data as { parsed: { info: { supply: string; decimals: number } } }).parsed.info
      : null;
    return {
      mint: info.mint as string,
      programId: a.programId,
      tokenAccount: a.pubkey,
      decimals: info.tokenAmount.decimals as number,
      balanceRaw: BigInt(info.tokenAmount.amount),
      supplyRaw: mintParsed ? BigInt(mintParsed.supply) : BigInt(info.tokenAmount.amount),
    };
  });
}

/**
 * Resolve a "10%" / "25%" ... preset against total supply, capped at what the
 * wallet actually holds. Returns the raw token amount to burn.
 */
export function resolvePercentBurnAmount(token: BurnableToken, percent: number): bigint {
  const targetOfSupply = (token.supplyRaw * BigInt(Math.round(percent * 100))) / BigInt(10000);
  return targetOfSupply > token.balanceRaw ? token.balanceRaw : targetOfSupply;
}

/**
 * Convert a plain typed-in token count (e.g. "10") into the raw burn amount,
 * using the mint's decimals. This is a token count, never a USD value.
 */
export function parseManualBurnAmount(input: string, decimals: number): bigint {
  const [whole, frac = ""] = input.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  const combined = `${whole || "0"}${fracPadded}`;
  return BigInt(combined || "0");
}

export type BurnTokenMeta = { name: string; symbol: string; logoUrl: string | null };

/**
 * Best-effort name/symbol/logo lookup for the "thanks for burning" announcement.
 * Uses Jupiter's public token metadata endpoint (no API key required); falls
 * back to a short mint-based label if the mint isn't in Jupiter's list yet.
 */
export async function fetchBurnTokenMeta(mint: string): Promise<BurnTokenMeta> {
  try {
    const res = await fetch(`https://lite-api.jup.ag/tokens/v1/token/${mint}`);
    if (res.ok) {
      const j = await res.json();
      if (j?.symbol) {
        return { name: j.name || j.symbol, symbol: j.symbol, logoUrl: j.logoURI || null };
      }
    }
  } catch {
    // fall through to fallback below
  }
  const short = `${mint.slice(0, 4)}…${mint.slice(-4)}`;
  return { name: short, symbol: short, logoUrl: null };
}

export function buildBurnTransaction(
  owner: PublicKey,
  token: BurnableToken,
  amountRaw: bigint,
): Transaction {
  const ix: TransactionInstruction = createBurnInstruction(
    token.tokenAccount,
    new PublicKey(token.mint),
    owner,
    amountRaw,
    [],
    token.programId,
  );
  return new Transaction().add(ix);
}
