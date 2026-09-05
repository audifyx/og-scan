import { supabase } from "@/lib/supabase";
import { invokeEdgeFn } from "@/lib/edgeFn";

function tokensFrom(json: Record<string, unknown>): { access_token: string; refresh_token: string } | null {
  const session = json.session && typeof json.session === "object" ? json.session as Record<string, unknown> : null;
  const access = json.access_token || session?.access_token;
  const refresh = json.refresh_token || session?.refresh_token;
  if (typeof access === "string" && access && typeof refresh === "string" && refresh) {
    return { access_token: access, refresh_token: refresh };
  }
  return null;
}

export function emailAuthErrorMessage(raw: unknown): string {
  const text = String(raw || "Sign-in failed").replace(/^Auth error:\s*/i, "");
  if (/invalid login|invalid credentials/i.test(text)) return "Invalid email or password";
  if (/email not confirmed/i.test(text)) return "Confirm your email first — check your inbox";
  if (/timed out/i.test(text)) return "Login service timed out. Please try again.";
  return text || "Sign-in failed";
}

/** Email/password login via the auth-signin edge function (same-origin /ai-fn proxy).
 *  Browser → GoTrue password grant is flaky/slow and can deadlock supabase-js. */
export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  let json: Record<string, unknown>;
  try {
    json = await invokeEdgeFn("auth-signin", { email, password });
  } catch (err) {
    throw new Error(emailAuthErrorMessage(err instanceof Error ? err.message : err));
  }
  if (json.success === false || json.error) {
    throw new Error(emailAuthErrorMessage(json.error || json.message));
  }
  const tokens = tokensFrom(json);
  if (!tokens) throw new Error("Sign-in failed — no session returned");
  const { error } = await supabase.auth.setSession(tokens);
  if (error) throw error;
}
