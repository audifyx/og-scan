// OrbitX — Sign-In-With-Solana client. Talks to the wallet-auth edge function,
// verifies a signed nonce, and installs the returned Supabase session so
// auth.uid() (and every existing RLS-protected feature) works unchanged.
import bs58 from "bs58";
import { supabase } from "@/lib/supabase";
import { invokeEdgeFn } from "@/lib/edgeFn";
import { installSupabaseSession } from "@/lib/authSession";

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

/** Full SIWS: nonce -> sign -> verify -> setSession. Returns whether the wallet
 *  account was just created (so the UI can offer the one-time merge).
 *  By default refuses to overwrite an existing non-wallet (email) session. */
export async function signInWithWallet(
  pubkey: string,
  signMessage: SignMessageFn,
  opts?: { replaceEmailSession?: boolean },
): Promise<{ isNew: boolean }> {
  // Explicit wallet login (e.g. /auth) must not wait on a hung getSession /
  // token refresh — we are about to overwrite the session anyway.
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
        // Keep email login; caller can still use the connected wallet for txs.
        return { isNew: false };
      }
    } catch {
      /* hung GoTrue — continue wallet login */
    }
  }

  const nonceResponse = await post({ action: "nonce", pubkey });
  const message = typeof nonceResponse?.message === "string" ? nonceResponse.message : "";
  const nonce = typeof nonceResponse?.nonce === "string" ? nonceResponse.nonce : "";
  if (!message || !nonce) {
    throw new Error("Wallet login could not request a nonce. Please reconnect your wallet and try again.");
  }

  // Never sign or verify until the nonce request has returned a complete SIWS message.
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
  await installSupabaseSession({ access_token, refresh_token });
  return { isNew: !!verified.isNew };
}

/** One-time legacy migration: verify old email/password server-side and repoint
 *  every user_id row to the connected wallet's account. */
export async function mergeLegacyAccount(email: string, password: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Connect and sign in with your wallet first");
  return post({ action: "merge", email, password }, session.access_token);
}
