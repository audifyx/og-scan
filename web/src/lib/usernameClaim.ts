import {
  canUseReservedUsername,
  getReservedUsernameMessage,
  isReservedUsername,
  normalizeUsernameForPolicy,
} from "@/lib/usernamePolicy";

/** Auto username from wallet-auth: first4 + last4 of base58 pubkey. */
export function autoUsernameFromPubkey(pubkey: string): string {
  return `${pubkey.slice(0, 4)}${pubkey.slice(-4)}`;
}

/** True when the profile still has the temporary wallet stub (or no name). */
export function needsUsernameClaim(
  username: string | null | undefined,
  walletPubkey?: string | null,
): boolean {
  if (!username || !username.trim()) return true;
  const clean = normalizeUsernameForPolicy(username);
  if (walletPubkey) {
    const stub = normalizeUsernameForPolicy(autoUsernameFromPubkey(walletPubkey));
    if (clean === stub) return true;
  }
  return false;
}

export function validateClaimUsername(
  raw: string,
  userEmail?: string | null,
): { ok: true; username: string } | { ok: false; error: string } {
  const username = normalizeUsernameForPolicy(raw);
  if (username.length < 3) return { ok: false, error: "Username must be at least 3 characters" };
  if (username.length > 24) return { ok: false, error: "Username must be 24 characters or fewer" };
  if (!/^[a-z0-9_]+$/.test(username)) {
    return { ok: false, error: "Use letters, numbers, and underscores only" };
  }
  if (isReservedUsername(username) && !canUseReservedUsername(userEmail)) {
    return { ok: false, error: getReservedUsernameMessage() };
  }
  return { ok: true, username };
}
