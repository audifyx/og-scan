/**
 * OrbitX billing auth — auth ONCE, spend seamlessly after.
 *
 * Uses the existing dashboard auth-code flow (mintMcpChatAuth /
 * approveMcpLinkAuth in @/lib/orbitxMcp). The authCode is a scoped
 * credential: it lets the supercomputer backend sign ORBITX burns from
 * the user's sealed desk wallet. It is NOT a private key and never
 * leaves this device except to our own backend.
 */
import { approveMcpLinkAuth, mintMcpChatAuth } from "@/lib/orbitxMcp";
import { BILLING_AUTHCODE_KEY } from "./constants";

export function getBillingAuthCode(): string | null {
  try {
    const v = localStorage.getItem(BILLING_AUTHCODE_KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

function storeBillingAuthCode(code: string): void {
  try {
    localStorage.setItem(BILLING_AUTHCODE_KEY, code.trim());
  } catch {
    /* storage unavailable — auth stays in-memory only */
  }
}

export function clearBillingAuth(): void {
  try {
    localStorage.removeItem(BILLING_AUTHCODE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Thrown when the wallet link is attempted without a platform sign-in.
 * UI should route the user to /auth (with a return URL) instead of
 * showing a dead-end error — this is the normal case on mobile, where
 * the user often opens the city directly without signing in first.
 */
export class BillingNotSignedInError extends Error {
  constructor() {
    super("Sign in to link your in-app wallet.");
    this.name = "BillingNotSignedInError";
  }
}

/** True when an error is the sign-in gate (route to /auth, don't show copy). */
export function isBillingSignInError(e: unknown): boolean {
  return (
    e instanceof BillingNotSignedInError ||
    (e instanceof Error && /not signed in/i.test(e.message))
  );
}

/**
 * Auth-once flow: mint a pre-authorized authCode (no mid-flow click) and
 * persist it. Resolves with the code. Throws BillingNotSignedInError when
 * there is no platform session (caller should send the user to /auth),
 * or a human-readable error for genuine link failures.
 */
export async function requestBillingAuth(walletAddress?: string): Promise<string> {
  try {
    const minted = await mintMcpChatAuth(walletAddress);
    if (minted?.authCode) {
      storeBillingAuthCode(minted.authCode);
      return minted.authCode;
    }
  } catch (e) {
    if (isBillingSignInError(e)) throw new BillingNotSignedInError();
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Wallet link failed (${msg}). Check your connection and tap again — no extra steps needed.`,
    );
  }
  throw new Error("Wallet link didn't return a code. Tap again to retry.");
}

/**
 * Complete a dashboard link-auth session (user clicked approve in the
 * dashboard with a `code` query param, e.g. /agent/link-auth?code=...).
 */
export async function approveBillingLinkAuth(
  code: string,
  walletAddress?: string,
): Promise<string> {
  const res = await approveMcpLinkAuth(code, walletAddress);
  if (!res?.authCode) throw new Error("Link approval did not return an authCode.");
  storeBillingAuthCode(res.authCode);
  return res.authCode;
}
