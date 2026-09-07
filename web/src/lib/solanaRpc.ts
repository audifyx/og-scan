import { PUBLIC_SOLANA_RPC } from "../../shared/pump-claim.js";

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

export { PUBLIC_SOLANA_RPC };
