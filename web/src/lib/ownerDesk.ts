/**
 * Owner desk — obscure UI entry (not a security boundary for APIs).
 * Server ADMIN_AUTH / JWT owner checks remain the real API auth.
 *
 * Desk URL (bookmark this; it is not linked in the product):
 *   /ox-desk-m4k9q
 *   /ORBITX_DEX/ox-desk-m4k9q
 */
import {
  TOKEN_GATE_EXEMPT_EMAILS_BASE,
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  isExemptEmailInList,
  isExemptWalletInList,
} from "../../shared/token-gate-exempt.js";

export const OWNER_DESK_PATH = "ox-desk-m4k9q";
export const OWNER_DESK_HREF = `/${OWNER_DESK_PATH}`;
export const OWNER_DESK_DEX_HREF = `/ORBITX_DEX/${OWNER_DESK_PATH}`;

export {
  DESK_SESS_KEY as OWNER_DESK_UNLOCK_KEY,
  DESK_TOKEN_KEY as OWNER_DESK_TOKEN_KEY,
  DESK_UNLOCK_EVENT as OWNER_DESK_UNLOCK_EVENT,
} from "../../shared/desk-unlock-client.js";

/** Sole owner email for desk UI + owner-gated APIs. */
export const OWNER_EMAIL = TOKEN_GATE_EXEMPT_EMAILS_BASE[0] || "audifyx@gmail.com";
export const OWNER_EMAILS = [OWNER_EMAIL] as const;

/**
 * Owner Solana wallets that may unlock the desk via wallet SIWS.
 * Same allowlist as Agent MCP hold exemption (web/shared/token-gate-exempt.js).
 * Extras via `VITE_OWNER_WALLETS=addr1,addr2` (comma-separated).
 */
function parseOwnerWallets(): readonly string[] {
  let extras: string[] = [];
  try {
    const raw =
      (typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_OWNER_WALLETS) ||
      "";
    extras = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    extras = [];
  }
  return [...TOKEN_GATE_EXEMPT_WALLETS_BASE, ...extras].filter((w, i, arr) => arr.indexOf(w) === i);
}
export const OWNER_WALLETS = parseOwnerWallets();

/** True if this identity is the platform owner (email and/or wallet). */
export function isOwnerIdentity(opts: {
  email?: string | null;
  wallet?: string | null;
}): boolean {
  if (isExemptWalletInList(opts.wallet, OWNER_WALLETS as unknown as string[])) return true;
  if (isExemptEmailInList(opts.email, OWNER_EMAILS as unknown as string[], OWNER_WALLETS as unknown as string[])) {
    return true;
  }
  return false;
}
