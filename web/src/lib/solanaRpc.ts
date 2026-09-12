import { Connection } from "@solana/web3.js";
import {
  CLAIM_RPC_URLS,
  isRpcUnavailableError,
  PUBLIC_SOLANA_RPC,
} from "../../shared/pump-claim.js";

/**
 * Browser wallet Connection URL. Never embed Helius/Alchemy keys in `VITE_*`.
 * Production uses the same-origin JSON-RPC proxy; local Vite has no /api, so
 * public mainnet is the fallback.
 */
export function browserWalletRpcUrl(): string {
  const custom = import.meta.env.VITE_SOLANA_RPC_URL;
  if (typeof custom === "string" && /^https?:\/\//i.test(custom.trim())) {
    return custom.trim();
  }
  if (typeof window === "undefined") return PUBLIC_SOLANA_RPC;
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return PUBLIC_SOLANA_RPC;
  return `${window.location.origin}/api/ogdex/rpc`;
}

export { PUBLIC_SOLANA_RPC, CLAIM_RPC_URLS };

function rpcSendCandidates(preferred?: Connection): Connection[] {
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

/**
 * Broadcast a signed tx, hopping off exhausted Helius / 403 public mainnet
 * onto Ankr / PublicNode / dRPC without making the user re-sign.
 */
export async function sendRawWithFallback(
  raw: Uint8Array,
  preferred?: Connection,
  opts?: { skipPreflight?: boolean; maxRetries?: number },
): Promise<string> {
  const sendOpts = {
    skipPreflight: opts?.skipPreflight ?? false,
    maxRetries: opts?.maxRetries ?? 3,
  };
  let lastErr: unknown;
  for (const conn of rpcSendCandidates(preferred)) {
    try {
      return await conn.sendRawTransaction(raw, sendOpts);
    } catch (e) {
      lastErr = e;
      if (!isRpcUnavailableError(e)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Solana RPC send failed"));
}

export async function confirmSignatureWithFallback(
  signature: string,
  preferred: Connection | undefined,
  options?: { blockhash?: string; lastValidBlockHeight?: number; commitment?: "processed" | "confirmed" | "finalized" },
): Promise<void> {
  const commitment = options?.commitment ?? "confirmed";
  let lastErr: unknown;
  for (const conn of rpcSendCandidates(preferred)) {
    try {
      if (options?.blockhash && options.lastValidBlockHeight != null) {
        await conn.confirmTransaction(
          { signature, blockhash: options.blockhash, lastValidBlockHeight: options.lastValidBlockHeight },
          commitment,
        );
      } else {
        await conn.confirmTransaction(signature, commitment);
      }
      return;
    } catch (e) {
      lastErr = e;
      const msg = e instanceof Error ? e.message : String(e);
      if (/already been processed|already processed/i.test(msg)) return;
      try {
        const st = await conn.getSignatureStatus(signature);
        if (st?.value && !st.value.err) return;
      } catch {
        /* status is best-effort */
      }
      if (!isRpcUnavailableError(e)) throw e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr || "Solana RPC confirm failed"));
}
