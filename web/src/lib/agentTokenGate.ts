/** DEF / platform wallets that skip the $10 ORBITX Agent MCP hold requirement. */
export const TOKEN_GATE_EXEMPT_WALLETS = [
  "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd",
] as const;

/** Official ORBITX mint — same CA as OfficialToken / token-gating. */
export const AGENT_HOLD_MINT = "13H4WJvGEg4xrrBwWn2vsQgz7xhmhxgNdw19i1QsxPX9";
export const AGENT_HOLD_MIN_USD = 10;

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

export type HoldVerifyResult = {
  ok: boolean;
  meetsRequirement: boolean;
  exempt?: boolean;
  wallet?: string | null;
  mint: string;
  minUsd: number;
  holdingAmount?: number;
  priceUsd?: number | null;
  holdingUsd?: number;
  holdUrl?: string;
  buyUrl?: string;
  error?: string;
  message?: string;
};

export async function verifyAgentHold(wallet?: string | null): Promise<HoldVerifyResult> {
  if (isTokenGateExemptWallet(wallet)) {
    return {
      ok: true,
      meetsRequirement: true,
      exempt: true,
      wallet: wallet || null,
      mint: AGENT_HOLD_MINT,
      minUsd: AGENT_HOLD_MIN_USD,
      message: "Exempt wallet",
    };
  }

  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    return {
      ok: false,
      meetsRequirement: false,
      wallet: wallet || null,
      mint: AGENT_HOLD_MINT,
      minUsd: AGENT_HOLD_MIN_USD,
      error: "unauthorized",
      message: "Sign in to verify ORBITX holdings.",
    };
  }

  const r = await fetch("/api/orbitx-agent/verify-hold", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ walletAddress: wallet || undefined }),
  });
  const json = (await r.json().catch(() => ({}))) as HoldVerifyResult;
  if (!r.ok && !json.error) {
    return {
      ok: false,
      meetsRequirement: false,
      wallet: wallet || null,
      mint: AGENT_HOLD_MINT,
      minUsd: AGENT_HOLD_MIN_USD,
      error: "hold_check_failed",
      message: String((json as { message?: string }).message || `Verify failed (${r.status})`),
    };
  }
  return {
    mint: AGENT_HOLD_MINT,
    minUsd: AGENT_HOLD_MIN_USD,
    ...json,
    meetsRequirement: Boolean(json.meetsRequirement || json.exempt),
    ok: Boolean(json.ok ?? json.meetsRequirement ?? json.exempt),
  };
}
