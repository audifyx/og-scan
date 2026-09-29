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
 * Auth-once flow: mint a pre-authorized authCode (no mid-flow click) and
 * persist it. Resolves with the code. Throws a human-readable error when
 * the user must finish the dashboard link step first.
 */
export async function requestBillingAuth(walletAddress?: string): Promise<string> {
  try {
    const minted = await mintMcpChatAuth(walletAddress);
    if (minted?.authCode) {
      storeBillingAuthCode(minted.authCode);
      return minted.authCode;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `Billing auth needs one dashboard link first: ${msg}. ` +
        "Open the Supercomputer → In-App Wallet tab, link once, then retry — " +
        "after that every spend is seamless with no popups.",
    );
  }
  throw new Error(
    "Could not mint a billing authCode. Link your wallet once on the Supercomputer → In-App Wallet tab, then retry.",
  );
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
