// OrbitX — Sign-In-With-Solana.
// Prefers native Supabase Web3 (grant_type=web3) via same-origin /api/auth-web3.
// Falls back to the wallet-auth edge function for the legacy
// {pubkey}@wallet.orbitx.app accounts if Web3 is unreachable.
import bs58 from "bs58";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFn } from "@/lib/edgeFn";
import { installSupabaseSession } from "@/lib/authSession";
import {
  buildSolanaSiwsMessage,
  exchangeWeb3Session,
  isLikelyNewAuthUser,
} from "@/lib/web3Auth";

export type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = globalThis.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => { globalThis.clearTimeout(timer); resolve(value); },
      (error) => { globalThis.clearTimeout(timer); reject(error); },
    );
  });
}

async function post(body: Record<string, unknown>, authToken?: string) {
  return invokeEdgeFn("wallet-auth", body, { authToken });
}

function shouldFallbackToLegacy(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  if (/reject|cancel|denied/i.test(msg)) return false;
  if (/invalid signature/i.test(msg)) return false;
  return true;
}

async function signInWithNativeWeb3(
  pubkey: string,
  signMessage: SignMessageFn,
): Promise<{ isNew: boolean }> {
  const message = buildSolanaSiwsMessage(pubkey);
  const signed = await withTimeout(
    signMessage(new TextEncoder().encode(message)),
    25_000,
    "Wallet did not sign the login message. Unlock Jupiter or Phantom and retry.",
  );
  const tokens = await exchangeWeb3Session(message, signed);
  const meta = tokens.user?.user_metadata && typeof tokens.user.user_metadata === "object"
    ? tokens.user.user_metadata as Record<string, unknown>
    : {};
  const user = {
    ...(tokens.user || {}),
    user_metadata: { ...meta, wallet: pubkey, login: "web3" },
  };
  await installSupabaseSession(
    { access_token: tokens.access_token, refresh_token: tokens.refresh_token },
    user,
  );
  return { isNew: isLikelyNewAuthUser(tokens.user) };
}

async function signInWithLegacyWalletAuth(
  pubkey: string,
  signMessage: SignMessageFn,
): Promise<{ isNew: boolean }> {
  const nonceResponse = await post({ action: "nonce", pubkey });
  const message = typeof nonceResponse?.message === "string" ? nonceResponse.message : "";
  const nonce = typeof nonceResponse?.nonce === "string" ? nonceResponse.nonce : "";
  if (!message || !nonce) {
    throw new Error("Wallet login could not request a nonce. Please reconnect your wallet and try again.");
  }

  const signed = await withTimeout(
    signMessage(new TextEncoder().encode(message)),
    25_000,
    "Wallet did not sign the login message. Unlock Jupiter or Phantom and retry.",
  );
  const signature = bs58.encode(signed);
  const verified = await post({ action: "verify", pubkey, nonce, signature });
  const access_token = typeof verified.access_token === "string" ? verified.access_token : "";
  const refresh_token = typeof verified.refresh_token === "string" ? verified.refresh_token : "";
  if (!access_token || !refresh_token) {
    throw new Error(typeof verified.error === "string" ? verified.error : "Wallet sign-in failed to create a session.");
  }
  const user = verified.user && typeof verified.user === "object" ? verified.user as Record<string, unknown> : null;
  await installSupabaseSession({ access_token, refresh_token }, user);
  return { isNew: !!verified.isNew };
}

/** Full SIWS: native Web3 grant, then legacy wallet-auth if needed.
 *  By default refuses to overwrite an existing non-wallet (email) session. */
export async function signInWithWallet(
  pubkey: string,
  signMessage: SignMessageFn,
  opts?: { replaceEmailSession?: boolean },
): Promise<{ isNew: boolean }> {
  if (opts?.replaceEmailSession !== true) {
    try {
      const existing = await Promise.race([
        supabase.auth.getSession().then((r) => r.data.session),
        new Promise<null>((resolve) => {
          globalThis.setTimeout(() => resolve(null), 2_000);
        }),
      ]);
      const existingEmail = existing?.user?.email || "";
      const isEmailSession = !!existingEmail && !/@wallet\.orbitx\.app$/i.test(existingEmail);
      if (isEmailSession) {
        return { isNew: false };
      }
    } catch {
      /* hung GoTrue — continue wallet login */
    }
  }

  try {
    return await signInWithNativeWeb3(pubkey, signMessage);
  } catch (err) {
    if (!shouldFallbackToLegacy(err)) throw err;
    return signInWithLegacyWalletAuth(pubkey, signMessage);
  }
}

/** One-time legacy migration: verify old email/password server-side and repoint
 *  every user_id row to the connected wallet's account. */
export async function mergeLegacyAccount(email: string, password: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Connect and sign in with your wallet first");
  return post({ action: "merge", email, password }, session.access_token);
}
