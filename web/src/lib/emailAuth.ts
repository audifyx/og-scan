import { fetchWithTimeout } from "@/lib/fetchTimeout";
import { installSupabaseSession, tokensFromAuthPayload } from "@/lib/authSession";

function errorText(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (typeof obj.message === "string" && obj.message) return obj.message;
    if (typeof obj.error === "string" && obj.error) return obj.error;
  }
  return String(raw || "Sign-in failed");
}

export function emailAuthErrorMessage(raw: unknown): string {
  const text = errorText(raw).replace(/^Auth error:\s*/i, "");
  if (/invalid login|invalid credentials|INVALID_CREDENTIALS/i.test(text)) return "Invalid email or password";
  if (/email not confirmed/i.test(text)) return "Confirm your email first — check your inbox";
  if (/timed out|timeout|503/i.test(text)) return "Login service timed out. Please try again.";
  return text || "Sign-in failed";
}

function isAbort(err: unknown): boolean {
  return (err instanceof DOMException && err.name === "AbortError")
    || (err instanceof Error && err.name === "AbortError");
}

/** Email login via same-origin /api/auth-login (never the hung public GoTrue /token). */
export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  let res: Response;
  try {
    res = await fetchWithTimeout(
      "/api/auth-login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      },
      18_000,
    );
  } catch (err) {
    if (isAbort(err)) throw new Error("Login service timed out. Please try again.");
    throw err;
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || json.success === false) {
    throw new Error(emailAuthErrorMessage(json.error || json.msg || json.message || `Sign-in failed (${res.status})`));
  }
  const tokens = tokensFromAuthPayload(json);
  if (!tokens) throw new Error("Sign-in failed — no session returned");
  const user = json.user && typeof json.user === "object" ? json.user as Record<string, unknown> : null;
  await installSupabaseSession(tokens, user);
}
