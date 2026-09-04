/**
 * Owner desk — obscure UI entry (not a security boundary for APIs).
 * Server ADMIN_AUTH / JWT owner-email checks remain the real API auth.
 *
 * Desk URL (bookmark this; it is not linked in the product):
 *   /ox-desk-m4k9q
 *   /ORBITX_DEX/ox-desk-m4k9q
 *
 * Desk access is the signed-in owner email account only. Wallet/SIWS is not admin.
 * Never print the owner email in UI.
 */
import {
  TOKEN_GATE_EXEMPT_EMAILS_BASE,
} from "../../shared/token-gate-exempt.js";
import { isOwnerEmail } from "../../shared/owner-identity.js";

export const OWNER_DESK_PATH = "ox-desk-m4k9q";
export const OWNER_DESK_HREF = `/${OWNER_DESK_PATH}`;
export const OWNER_DESK_DEX_HREF = `/ORBITX_DEX/${OWNER_DESK_PATH}`;

export {
  DESK_SESS_KEY as OWNER_DESK_UNLOCK_KEY,
  DESK_TOKEN_KEY as OWNER_DESK_TOKEN_KEY,
  DESK_UNLOCK_EVENT as OWNER_DESK_UNLOCK_EVENT,
} from "../../shared/desk-unlock-client.js";

export { isOwnerEmail };

/** @deprecated do not render this in UI — comparison only */
export const OWNER_EMAIL = TOKEN_GATE_EXEMPT_EMAILS_BASE[0] || "";
export const OWNER_EMAILS = TOKEN_GATE_EXEMPT_EMAILS_BASE as readonly string[];

/** Desk owner wallets are unused. Kept empty so old wallet gates stay closed. */
export const OWNER_WALLETS: readonly string[] = [];

/** True only when signed in with the owner email account (not wallet). */
export function isOwnerIdentity(opts: {
  email?: string | null;
  wallet?: string | null;
}): boolean {
  void opts.wallet;
  return isOwnerEmail(opts.email);
}
