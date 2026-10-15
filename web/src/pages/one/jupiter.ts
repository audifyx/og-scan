import { JUPITER_QUOTE_API } from "./config";

export interface QuoteResult {
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  raw: any;
}

export async function getQuote(
  inputMint: string,
  outputMint: string,
  amountBaseUnits: string,
  slippageBps = 50
): Promise<QuoteResult> {
  const qs = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountBaseUnits,
    slippageBps: String(slippageBps),
    onlyDirectRoutes: "false",
  });
  const res = await fetch(`${JUPITER_QUOTE_API}/quote?${qs.toString()}`);
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter quote failed (${res.status}): ${body.slice(0, 120)}`);
  }
  const raw = await res.json();
  return {
    inAmount: raw.inAmount,
    outAmount: raw.outAmount,
    priceImpactPct: raw.priceImpactPct ?? "0",
    raw,
  };
}

/** Builds a swap transaction (base64). The caller must have the USER'S wallet sign it — never auto-sign. */
export async function buildSwapTransaction(
  quoteResponse: any,
  userPublicKey: string
): Promise<string> {
  const res = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      quoteResponse,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jupiter swap build failed (${res.status}): ${body.slice(0, 120)}`);
  }
  const json = await res.json();
  if (!json.swapTransaction) throw new Error("Jupiter returned no swap transaction");
  return json.swapTransaction as string;
}

export function formatUnits(amount: string, decimals: number, maxFrac = 6): string {
  const n = Number(amount) / 10 ** decimals;
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}
