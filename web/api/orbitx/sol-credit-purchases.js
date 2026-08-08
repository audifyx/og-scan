import { TREASURY_WALLET } from "./credit-service.js";

const SOLANA_RPC = process.env.SOLANA_RPC_URL || process.env.VITE_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
const QUOTE_TTL_MS = 5 * 60 * 1000;

export async function getSolUsdQuote() {
  const response = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
  if (!response.ok) throw new Error("sol_price_unavailable");
  const data = await response.json();
  const solUsd = Number(data?.solana?.usd);
  if (!Number.isFinite(solUsd) || solUsd <= 0) throw new Error("invalid_sol_price");
  return { solUsd, expiresAt: Date.now() + QUOTE_TTL_MS };
}

export function calculateLamports(usdValue, solUsd) {
  if (!Number.isFinite(usdValue) || usdValue <= 0 || !Number.isFinite(solUsd) || solUsd <= 0) throw new Error("invalid_purchase_quote");
  return Math.ceil((usdValue / solUsd) * 1_000_000_000);
}

async function rpc(method, params) {
  const response = await fetch(SOLANA_RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
  if (!response.ok) throw new Error("solana_rpc_failed");
  const payload = await response.json();
  if (payload.error) throw new Error(`solana_${payload.error.code}`);
  return payload.result;
}

export async function verifySolPayment({ signature, senderWallet, expectedLamports, commitment = "finalized" }) {
  if (!signature || !senderWallet || !Number.isInteger(expectedLamports) || expectedLamports <= 0) throw new Error("invalid_payment_verification_request");
  const tx = await rpc("getTransaction", [signature, { encoding: "jsonParsed", commitment, maxSupportedTransactionVersion: 0 }]);
  if (!tx || tx.meta?.err) throw new Error("payment_not_finalized");
  const keys = tx.transaction?.message?.accountKeys || [];
  const sender = keys.find((key) => key.signer)?.pubkey;
  if (sender !== senderWallet) throw new Error("payment_sender_mismatch");
  const transfer = tx.transaction.message.instructions.find((instruction) => instruction.program === "system" && instruction.parsed?.type === "transfer" && instruction.parsed?.info?.destination === TREASURY_WALLET);
  if (!transfer || Number(transfer.parsed.info.lamports) < expectedLamports) throw new Error("payment_amount_or_destination_mismatch");
  return { signature, senderWallet: sender, destinationWallet: TREASURY_WALLET, receivedLamports: Number(transfer.parsed.info.lamports), commitment };
}
