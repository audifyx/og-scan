/** DEF / platform wallets that skip the $10 ORBITX Agent MCP hold requirement. */
export const TOKEN_GATE_EXEMPT_WALLETS = [
  "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd",
] as const;

export function isTokenGateExemptWallet(wallet?: string | null): boolean {
  const addr = (wallet || "").trim();
  if (!addr) return false;
  // Accept raw pubkey or SIWS email form: {pubkey}@wallet.orbitx.app
  const bare = addr.includes("@") ? addr.split("@")[0] : addr;
  return TOKEN_GATE_EXEMPT_WALLETS.some((w) => w === bare || w === addr);
}

/** Resolve Solana wallet from adapter + SIWS/auth identity (same sources as owner desk). */
export function resolveAuthWallet(opts: {
  connectedPk?: string | null;
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
  profileWallet?: string | null;
}): string | null {
  if (opts.connectedPk) return opts.connectedPk.trim();

  const meta = opts.userMetadata?.wallet;
  if (typeof meta === "string" && meta.length > 20) return meta.trim();

  if (opts.profileWallet && opts.profileWallet.length > 20) {
    return opts.profileWallet.trim();
  }

  const email = (opts.email || "").trim();
  const m = email.match(/^([1-9A-HJ-NP-Za-km-z]{32,44})@wallet\.orbitx\.app$/i);
  return m?.[1] ?? null;
}
