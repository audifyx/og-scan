import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/admin-tokens — owner-only launchpad admin writes.
 *
 * Uses the Supabase SERVICE ROLE key (server-only) to bypass RLS for
 * feature/hide updates and to list every token (including hidden). The caller
 * must send their Supabase auth JWT as `Authorization: Bearer <access_token>`;
 * we verify it maps to an owner email before doing anything.
 *
 * Actions: "list" | "set_featured" | "set_hidden"  (value: boolean, mint: string)
 */
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const OWNER_EMAILS = ["audifyx@gmail.com", "beatsbyaid3n@gmail.com"];

async function emailFromToken(token: string): Promise<string | null> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!res.ok) return null;
  const u = await res.json().catch(() => null);
  return u?.email ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    if (!SERVICE_KEY) return res.status(500).json({ error: "Server not configured (missing service role key)" });

    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing auth token" });

    const email = await emailFromToken(token);
    if (!email || !OWNER_EMAILS.includes(email.toLowerCase())) {
      return res.status(403).json({ error: "Not authorized" });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const { action, mint, value } = body;
    const svc = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" };

    if (action === "list") {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/orbitx_tokens?select=*&order=created_at.desc&limit=2000`, { headers: svc });
      const tokens = await r.json();
      if (!r.ok) return res.status(500).json({ error: tokens?.message || "list failed" });
      return res.status(200).json({ tokens });
    }

    if (action === "set_featured" || action === "set_hidden") {
      if (!mint) return res.status(400).json({ error: "mint required" });
      const col = action === "set_featured" ? "is_featured" : "is_hidden";
      const r = await fetch(
        `${SUPABASE_URL}/rest/v1/orbitx_tokens?mint_address=eq.${encodeURIComponent(mint)}`,
        { method: "PATCH", headers: { ...svc, Prefer: "return=representation" }, body: JSON.stringify({ [col]: !!value }) },
      );
      const out = await r.json();
      if (!r.ok) {
        const msg = out?.message || "update failed";
        const hint = /column .* does not exist/i.test(msg)
          ? " — run migration 20260721221500_orbitx_tokens_admin_flags.sql (adds is_featured/is_hidden)"
          : "";
        return res.status(500).json({ error: msg + hint });
      }
      return res.status(200).json({ ok: true, token: Array.isArray(out) ? out[0] : out });
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message || "Internal error" });
  }
}
