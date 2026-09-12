import { SOL_MINT } from "./types";

export type JupiterHopPreview = {
  inMint: string;
  outMint: string;
  inAmount: string;
  outAmount: string;
  inUi: number;
  outUi: number;
};

export function firstBuyLamports(sol: number): number {
  if (!Number.isFinite(sol) || sol <= 0) return 0;
  return Math.round(sol * 1_000_000_000);
}

export function needsQuoteHop(quoteMint: string): boolean {
  return quoteMint !== SOL_MINT;
}

export function jupiterQuoteUrl(inputMint: string, outputMint: string, amount: number, slippageBps = 50): string {
  const q = new URLSearchParams({
    inputMint,
    outputMint,
    amount: String(amount),
    slippageBps: String(slippageBps),
  });
  return `https://lite-api.jup.ag/swap/v1/quote?${q.toString()}`;
}

export async function quoteToBuyPreview(
  inputMint: string,
  outputMint: string,
  amount: number,
  decimalsOut = 6,
): Promise<JupiterHopPreview> {
  if (amount <= 0) {
    return { inMint: inputMint, outMint: outputMint, inAmount: "0", outAmount: "0", inUi: 0, outUi: 0 };
  }
  const res = await fetch(jupiterQuoteUrl(inputMint, outputMint, amount));
  if (!res.ok) throw new Error("Jupiter quote failed");
  const q = await res.json();
  const inAmount = String(q.inAmount ?? amount);
  const outAmount = String(q.outAmount ?? "0");
  return {
    inMint: inputMint,
    outMint: outputMint,
    inAmount,
    outAmount,
    inUi: Number(inAmount) / 1e9,
    outUi: Number(outAmount) / 10 ** decimalsOut,
  };
}
