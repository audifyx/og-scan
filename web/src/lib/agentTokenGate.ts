/** DEF / platform wallets that skip the $10 ORBITX Agent MCP hold requirement. */
export const TOKEN_GATE_EXEMPT_WALLETS = [
  "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd",
] as const;

export function isTokenGateExemptWallet(wallet?: string | null): boolean {
  const addr = (wallet || "").trim();
  if (!addr) return false;
  return TOKEN_GATE_EXEMPT_WALLETS.some((w) => w === addr);
}
