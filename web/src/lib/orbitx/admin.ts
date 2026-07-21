// Client for the owner-only launchpad admin API (/api/admin-tokens).
// Sends the current Supabase session JWT so the server can verify ownership.
import { supabase } from "@/lib/supabase";
import type { OrbitxToken } from "./registry";

async function call<T>(body: Record<string, unknown>): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in with your owner email to use admin tools");
  const res = await fetch("/api/admin-tokens", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error || `Request failed (${res.status})`);
  return json as T;
}

export async function adminListTokens(): Promise<OrbitxToken[]> {
  const { tokens } = await call<{ tokens: OrbitxToken[] }>({ action: "list" });
  return tokens ?? [];
}
export const adminSetFeatured = (mint: string, value: boolean) =>
  call<{ ok: boolean }>({ action: "set_featured", mint, value });
export const adminSetHidden = (mint: string, value: boolean) =>
  call<{ ok: boolean }>({ action: "set_hidden", mint, value });
