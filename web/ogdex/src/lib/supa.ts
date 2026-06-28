// Lightweight Supabase REST reader for OG Dex (no @supabase/supabase-js dependency).
// Uses the public anon key + URL injected at build time (same project as OG Scan).
export const SUPABASE_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
export const SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || "";

export async function supaSelect<T = any>(table: string, query = ""): Promise<T[]> {
  if (!SUPABASE_ANON_KEY) return [];
  const url = `${SUPABASE_URL}/rest/v1/${table}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) throw new Error(`supa ${table} ${res.status}`);
  return res.json();
}
