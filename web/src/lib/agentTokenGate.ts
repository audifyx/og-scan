/**
 * Client-side Agent MCP hold helpers.
 * Exempt list: web/shared/token-gate-exempt.js (single source of truth).
 */

import {
  TOKEN_GATE_EXEMPT_EMAILS_BASE,
  TOKEN_GATE_EXEMPT_WALLETS_BASE,
  canonicalizeExemptWallet,
  isExemptEmailInList,
  isExemptWalletInList,
  walletFromSiwsEmail,
} from "../../shared/token-gate-exempt.js";
import { OGSCAN_TOKEN_MINT } from "@/lib/og";

export const TOKEN_GATE_EXEMPT_WALLETS = TOKEN_GATE_EXEMPT_WALLETS_BASE;
export const TOKEN_GATE_EXEMPT_EMAILS = TOKEN_GATE_EXEMPT_EMAILS_BASE;

/** Official ORBITX mint — same CA as OfficialToken / token-gating. */
export const AGENT_HOLD_MINT = OGSCAN_TOKEN_MINT;
export const AGENT_HOLD_MIN_USD = 5;

function envOwnerWallets(): string[] {
  try {
    const raw =
      (typeof import.meta !== "undefined" &&
        (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_OWNER_WALLETS) ||
      "";
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Hardcoded owner wallets + optional VITE_OWNER_WALLETS extras. */
export function allExemptWallets(): string[] {
  const merged = [...TOKEN_GATE_EXEMPT_WALLETS, ...envOwnerWallets()];
  return merged.filter((w, i, arr) => arr.indexOf(w) === i);
}

export function isTokenGateExemptWallet(wallet?: string | null): boolean {
  return isExemptWalletInList(wallet, allExemptWallets());
}

export function isTokenGateExemptEmail(email?: string | null): boolean {
  return isExemptEmailInList(email, TOKEN_GATE_EXEMPT_EMAILS as unknown as string[], allExemptWallets());
}

export function isAgentHoldExempt(opts: {
  wallet?: string | null;
  email?: string | null;
}): boolean {
  return isTokenGateExemptWallet(opts.wallet) || isTokenGateExemptEmail(opts.email);
}

/** Prefer canonical allowlist spelling (survives Supabase-lowercased SIWS emails). */
export function normalizeExemptWallet(wallet?: string | null): string | null {
  const raw = (wallet || "").trim();
  if (!raw) return null;
  return canonicalizeExemptWallet(raw, allExemptWallets()) || raw;
}

/** Resolve Solana wallet from adapter + SIWS/auth identity (same sources as owner desk). */
export function resolveAuthWallet(opts: {
  connectedPk?: string | null;
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
  profileWallet?: string | null;
}): string | null {
  if (opts.connectedPk) return normalizeExemptWallet(opts.connectedPk);

  const meta = opts.userMetadata?.wallet;
  if (typeof meta === "string" && meta.length > 20) return normalizeExemptWallet(meta);

  if (opts.profileWallet && opts.profileWallet.length > 20) {
    return normalizeExemptWallet(opts.profileWallet);
  }

  const fromEmail = walletFromSiwsEmail(opts.email, allExemptWallets());
  return fromEmail;
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
  const normalized = normalizeExemptWallet(wallet);
  if (isTokenGateExemptWallet(normalized || wallet)) {
    return {
      ok: true,
      meetsRequirement: true,
      exempt: true,
      wallet: normalized || wallet || null,
      mint: AGENT_HOLD_MINT,
      minUsd: AGENT_HOLD_MIN_USD,
      message: "Exempt wallet",
    };
  }

  const { supabase } = await import("@/lib/supabase");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const email = data.session?.user?.email || null;
  if (isTokenGateExemptEmail(email)) {
    return {
      ok: true,
      meetsRequirement: true,
      exempt: true,
      wallet: normalized || walletFromSiwsEmail(email, allExemptWallets()) || wallet || null,
      mint: AGENT_HOLD_MINT,
      minUsd: AGENT_HOLD_MIN_USD,
      message: "Owner email exempt",
    };
  }

  if (!token) {
    return {
      ok: false,
      meetsRequirement: false,
      wallet: normalized || wallet || null,
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
    body: JSON.stringify({ walletAddress: normalized || wallet || undefined }),
  });
  const json = (await r.json().catch(() => ({}))) as HoldVerifyResult;
  if (!r.ok && !json.error) {
    return {
      ok: false,
      meetsRequirement: false,
      wallet: normalized || wallet || null,
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
