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

export const OWNER_DESK_UNLOCK_KEY = "ox_desk_sess_v1";
export const OWNER_DESK_UNLOCK_EVENT = "ox-desk-unlock";
