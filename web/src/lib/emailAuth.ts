import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/supabase";
import { invokeEdgeFn } from "@/lib/edgeFn";
import { AUTH_FETCH_TIMEOUT_MS, fetchWithTimeout } from "@/lib/fetchTimeout";
import { installSupabaseSession, tokensFromAuthPayload } from "@/lib/authSession";

export function emailAuthErrorMessage(raw: unknown): string {
  const text = String(raw || "Sign-in failed").replace(/^Auth error:\s*/i, "");
  if (/invalid login|invalid credentials/i.test(text)) return "Invalid email or password";
  if (/email not confirmed/i.test(text)) return "Confirm your email first — check your inbox";
  if (/timed out/i.test(text)) return "Login service timed out. Please try again.";
  return text || "Sign-in failed";
}

function isCredentialError(text: string): boolean {
  return /invalid login|invalid credentials|email not confirmed/i.test(text);
}

/** Direct GoTrue password grant — this is the path that used to work. */
export async function passwordGrant(email: string, password: string): Promise<Record<string, unknown>> {
  const res = await fetchWithTimeout(
    `${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ email, password }),
    },
    AUTH_FETCH_TIMEOUT_MS,
  );
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(json.msg || json.error_description || json.error || json.message || "Sign-in failed"));
  }
  return json;
}

async function signInViaEdge(email: string, password: string): Promise<Record<string, unknown>> {
  const json = await invokeEdgeFn("auth-signin", { email, password }, { timeoutMs: 20_000 });
  if (json.success === false || json.error) {
    throw new Error(emailAuthErrorMessage(json.error || json.message));
  }
  return json;
}

/** Email/password login. Prefer GoTrue (fast). Fall back to auth-signin only on network/timeout. */
export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  let json: Record<string, unknown>;
  try {
    json = await passwordGrant(email, password);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isCredentialError(msg)) throw new Error(emailAuthErrorMessage(msg));
    try {
      json = await signInViaEdge(email, password);
    } catch (edgeErr) {
      throw new Error(emailAuthErrorMessage(edgeErr instanceof Error ? edgeErr.message : msg));
    }
  }
  const tokens = tokensFromAuthPayload(json);
  if (!tokens) throw new Error("Sign-in failed — no session returned");
  const user = json.user && typeof json.user === "object" ? json.user as Record<string, unknown> : null;
  await installSupabaseSession(tokens, user);
}
