/**
 * Desk-wallet trading — the ONLY trade path across OrbitX.
 *
 * Buys and sells run through the supercomputer MCP (orbitx_app_buy /
 * orbitx_app_sell). The backend desk wallet signs — no popup, no extension.
 * Every call needs the billing authCode (one-time dashboard link).
 */
import { callSupercomputerTool, type McpToolResult } from "@/tokenomics/mcpClient";
import { getBillingAuthCode } from "@/tokenomics/auth";

function requireAuthCode(): string {
  const code = getBillingAuthCode();
  if (!code) {
    throw new Error("Link your in-app wallet first — one tap, then trades are seamless.");
  }
  return code;
}

function signatureOf(res: McpToolResult, action: string): string {
  if (!res.ok) {
    throw new Error(res.message || res.error || `${action} failed.`);
  }
  const sig = res.signature;
  if (!sig || typeof sig !== "string") {
    throw new Error(`${action} returned no transaction signature.`);
  }
  return sig;
}

/** Market buy `amountSol` SOL worth of `mint` from the in-app wallet. Returns tx signature. */
export async function deskBuy(
  mint: string,
  amountSol: number,
  slippageBps = 200,
): Promise<string> {
  const authCode = requireAuthCode();
  const res = await callSupercomputerTool("orbitx_app_buy", {
    authCode,
    mint,
    amountSol,
    payWith: "sol",
    slippageBps,
  });
  return signatureOf(res, "Buy");
}

/** Market sell `percent` (1-100) of the in-app wallet's `mint` position. Returns tx signature. */
export async function deskSell(
  mint: string,
  percent: number,
  slippageBps = 200,
): Promise<string> {
  const authCode = requireAuthCode();
  const pct = Math.min(100, Math.max(1, Math.round(percent)));
  const res = await callSupercomputerTool("orbitx_app_sell", {
    authCode,
    mint,
    percent: pct,
    slippageBps,
  });
  return signatureOf(res, "Sell");
}

/** Quote-only check (no signature) via Jupiter through the MCP. */
export async function deskQuote(
  mint: string,
  amountSol: number,
): Promise<McpToolResult> {
  const authCode = requireAuthCode();
  return callSupercomputerTool("orbitx_trade_quote", { authCode, mint, amountSol });
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}`;
}
