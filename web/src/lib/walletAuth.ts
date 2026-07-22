// OrbitX — Sign-In-With-Solana client. Talks to the wallet-auth edge function,
// verifies a signed nonce, and installs the returned Supabase session so
// auth.uid() (and every existing RLS-protected feature) works unchanged.
import bs58 from "bs58";
import { supabase, SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase";

const FN = `${SUPABASE_URL}/functions/v1/wallet-auth`;

async function post(body: Record<string, unknown>, authToken?: string) {
  const res = await fetch(FN, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${authToken ?? SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || "wallet sign-in failed");
  return json;
}

export type SignMessageFn = (message: Uint8Array) => Promise<Uint8Array>;

/** Full SIWS: nonce -> sign -> verify -> setSession. Returns whether the wallet
 *  account was just created (so the UI can offer the one-time merge). */
export async function signInWithWallet(pubkey: string, signMessage: SignMessageFn): Promise<{ isNew: boolean }> {
  const { message } = await post({ action: "nonce", pubkey });
  const signed = await signMessage(new TextEncoder().encode(message));
  const signature = bs58.encode(signed);
  const { access_token, refresh_token, isNew } = await post({ action: "verify", pubkey, signature });
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });
  if (error) throw error;
  return { isNew: !!isNew };
}

/** One-time legacy migration: verify old email/password server-side and repoint
 *  every user_id row to the connected wallet's account. */
export async function mergeLegacyAccount(email: string, password: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Connect and sign in with your wallet first");
  return post({ action: "merge", email, password }, session.access_token);
}
