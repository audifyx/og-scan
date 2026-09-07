/**
 * Pump.fun creator-fee claim constants shared by the launchpad UI and MCP ops.
 *
 * `collect_creator_fee` discriminator and account layout come from the official
 * Pump IDL. We build this instruction locally so a Helius/PumpPortal
 * "429: max usage reached" cannot block creator claims.
 */
export const PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";
/** Anchor discriminator for `global:collect_creator_fee`. */
export const COLLECT_CREATOR_FEE_DISCRIMINATOR = [20, 22, 86, 123, 198, 28, 219, 132];
export const PUMP_CREATOR_VAULT_SEED = "creator-vault";
export const PUMP_EVENT_AUTHORITY_SEED = "__event_authority";
/** Rent-exempt minimum for a 0-byte system account (lamports). */
export const SYSTEM_ACCOUNT_RENT_LAMPORTS = 890_880;
export const PUBLIC_SOLANA_RPC = "https://api.mainnet-beta.solana.com";

function collectErrorText(err) {
  if (err == null) return "";
  if (typeof err === "string" || typeof err === "number") return String(err);
  const parts = [];
  if (err.message) parts.push(String(err.message));
  if (err.status != null) parts.push(String(err.status));
  if (err.code != null) parts.push(String(err.code));
  if (err.error && err.error !== err) parts.push(collectErrorText(err.error));
  if (err.data && err.data !== err) parts.push(collectErrorText(err.data));
  if (err.raw) parts.push(collectErrorText(err.raw));
  return parts.join(" ");
}

/** True when an RPC/PumpPortal error is Helius credit exhaustion (not a generic 429). */
export function isRpcQuotaError(err) {
  const m = collectErrorText(err).toLowerCase();
  if (!m) return false;
  if (m.includes("max usage reached")) return true;
  if (m.includes("credits exhausted")) return true;
  if (m.includes("credit limit")) return true;
  if (m.includes("usage limit reached")) return true;
  return false;
}
