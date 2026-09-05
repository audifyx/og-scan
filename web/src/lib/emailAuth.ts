import { supabase } from "@/lib/supabase";

export function emailAuthErrorMessage(raw: unknown): string {
  const text = String(raw || "Sign-in failed").replace(/^Auth error:\s*/i, "");
  if (/invalid login|invalid credentials/i.test(text)) return "Invalid email or password";
  if (/email not confirmed/i.test(text)) return "Confirm your email first — check your inbox";
  if (/timed out|timeout/i.test(text)) return "Login service timed out. Please try again.";
  return text || "Sign-in failed";
}

/** Email/password via supabase-js GoTrue. This is the supported login path. */
export async function signInWithEmailPassword(email: string, password: string): Promise<void> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new Error(emailAuthErrorMessage(error.message));
  if (!data.session) throw new Error("Sign-in failed — no session returned");
}
