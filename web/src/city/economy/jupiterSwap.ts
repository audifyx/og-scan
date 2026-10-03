/**
 * OrbitX City — Jupiter swaps signed by the player's hub wallet.
 *
 * Uses the Jupiter Lite public API (same endpoints as the OrbitX Mobile app).
 * No key custody: the OrbitxWalletHub inject wallet (Phantom / Jupiter)
 * signs via its provider; we only build the transaction.
 */
import { VersionedTransaction } from "@solana/web3.js";

const JUP = "https://lite-api.jup.ag";

export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const ORBITX_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";

export interface JupTokenMeta {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

export interface JupQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  [k: string]: unknown;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Search Jupiter's token list (by symbol, name, or mint). */
export async function searchJupTokens(query: string): Promise<JupTokenMeta[]> {
  const r = await fetch(`${JUP}/tokens/v2/search?query=${encodeURIComponent(query)}`);
  if (!r.ok) throw new Error("Token search failed");
  const d = await r.json();
  const list = Array.isArray(d) ? d : [];
  return list.slice(0, 20).map((t: any) => ({
    address: String(t.address ?? ""),
    symbol: String(t.symbol ?? "?"),
    name: String(t.name ?? ""),
    decimals: Number(t.decimals ?? 9),
    logoURI: t.logoURI,
  }));
}

/** Default trade pairs, with real ORBITX decimals resolved when possible. */
export async function defaultSwapTokens(): Promise<JupTokenMeta[]> {
  const base: JupTokenMeta[] = [
    { address: SOL_MINT, symbol: "SOL", name: "Solana", decimals: 9 },
    { address: USDC_MINT, symbol: "USDC", name: "USD Coin", decimals: 6 },
    { address: ORBITX_MINT, symbol: "ORBITX", name: "OrbitX", decimals: 9 },
  ];
  try {
    const found = await searchJupTokens(ORBITX_MINT);
    const hit = found.find((t) => t.address === ORBITX_MINT);
    const o = base.find((t) => t.address === ORBITX_MINT);
    if (hit && o && Number.isFinite(hit.decimals)) o.decimals = hit.decimals;
  } catch {
    /* 9 stands */
  }
  return base;
}

/** Get a swap quote. amount is in the input token's base units (string). */
export async function getJupQuote(
  inputMint: string,
  outputMint: string,
  amountBaseUnits: string,
  slippageBps = 100,
): Promise<JupQuote> {
  const r = await fetch(
    `${JUP}/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountBaseUnits}&slippageBps=${slippageBps}`,
  );
  if (!r.ok) throw new Error("No route found for this pair");
  return r.json();
}

/**
 * Build the unsigned swap transaction for the hub wallet to sign+send.
 * Caller signs via the wallet hub's sendTransaction (it signs, then broadcasts).
 */
export async function buildJupSwapTransaction(
  quote: JupQuote,
  userPublicKey: string,
): Promise<VersionedTransaction> {
  const r = await fetch(`${JUP}/swap/v1/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!r.ok) throw new Error("Failed to build swap transaction");
  const { swapTransaction } = await r.json();
  if (typeof swapTransaction !== "string" || !swapTransaction) {
    throw new Error("Bad swap response");
  }
  return VersionedTransaction.deserialize(base64ToBytes(swapTransaction));
}

/** Human amount → base units string. */
export function toBaseUnits(human: string, decimals: number): string {
  const [wholeRaw = "0", fracRaw = ""] = human.trim().split(".");
  const whole = wholeRaw.replace(/[^0-9]/g, "") || "0";
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals).replace(/[^0-9]/g, "") || "0";
  return (BigInt(whole) * BigInt(10 ** decimals) + BigInt(frac)).toString();
}

/** Base units string → human amount string. */
export function fromBaseUnits(base: string, decimals: number): string {
  try {
    const b = BigInt(base);
    const d = BigInt(10 ** decimals);
    const w = b / d;
    const f = (b % d).toString().padStart(decimals, "0").replace(/0+$/, "");
    return f ? `${w}.${f}` : w.toString();
  } catch {
    return "0";
  }
}
