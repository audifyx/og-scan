/**
 * Owner desk — obscure UI entry (not a security boundary for APIs).
 * Server ADMIN_PASS / JWT owner checks remain the real API auth.
 *
 * Desk URL (bookmark this; it is not linked in the product):
 *   /ox-desk-m4k9q
 *   /ORBITX_DEX/ox-desk-m4k9q
 */
export const OWNER_DESK_PATH = "ox-desk-m4k9q";
export const OWNER_DESK_HREF = `/${OWNER_DESK_PATH}`;
export const OWNER_DESK_DEX_HREF = `/ORBITX_DEX/${OWNER_DESK_PATH}`;

/** Manual UI unlock code — client obscurity only; never use as server ADMIN_PASS. */
export const OWNER_DESK_CODE = "0129";

/** Sole owner email for desk UI + owner-gated APIs. */
export const OWNER_EMAIL = "audifyx@gmail.com";
export const OWNER_EMAILS = [OWNER_EMAIL] as const;

/**
 * Owner Solana wallets that may unlock the desk via wallet SIWS.
 * Set `VITE_OWNER_WALLETS=addr1,addr2` in env (comma-separated).
 * Wallet sessions use `{pubkey}@wallet.orbitx.app` as email.
 */
function parseOwnerWallets(): readonly string[] {
  try {
    const raw =
      (typeof import.meta !== "undefined" && (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_OWNER_WALLETS) ||
      "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}
export const OWNER_WALLETS = parseOwnerWallets();

export const OWNER_DESK_UNLOCK_KEY = "ox_desk_sess_v1";
export const OWNER_DESK_UNLOCK_EVENT = "ox-desk-unlock";

/** True if this identity is the platform owner (email and/or wallet). */
export function isOwnerIdentity(opts: {
  email?: string | null;
  wallet?: string | null;
}): boolean {
  const email = (opts.email || "").toLowerCase().trim();
  const wallet = (opts.wallet || "").trim();

  if (email && (OWNER_EMAILS as readonly string[]).includes(email)) return true;

  if (wallet && OWNER_WALLETS.some((w) => w === wallet)) return true;

  // Wallet SIWS sessions: {pubkey}@wallet.orbitx.app
  const m = email.match(/^([1-9a-zA-Z]{32,44})@wallet\.orbitx\.app$/i);
  if (m && OWNER_WALLETS.some((w) => w === m[1] || w.toLowerCase() === m[1].toLowerCase())) return true;

  return false;
}
