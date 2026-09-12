/**
 * GET/POST /api/pad-resolve — permissionless resolve crank (Spec v2-D).
 * Cron: hourly. Uses indexed markets + graduation bit. Pyth HTTP is optional.
 * Writes outcome to orbitx_pad_markets. Does not move funds until market program is live.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const GRACE = 30 * 60;

function json(res: VercelResponse, body: unknown, status = 200) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  return res.status(status).json(body);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") return res.status(204).end();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !key) return json(res, { error: "missing service role" }, 501);

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const now = Math.floor(Date.now() / 1000);
  const { data: markets, error } = await admin
    .from("orbitx_pad_markets")
    .select("*")
    .in("status", ["open", "halted", "preview"])
    .lte("deadline_unix", now)
    .limit(100);
  if (error) return json(res, { error: error.message }, 500);

  const results: Array<{ mint: string; outcome: string; reason: string }> = [];
  for (const m of markets || []) {
    let outcome: "yes" | "no" | "void" | "skip" = "skip";
    let reason = "";
    const deadline = Number(m.deadline_unix);
    if (m.resolver === "metric") {
      const { data: tok } = await admin.from("orbitx_tokens").select("graduated_at").eq("mint_address", m.mint).maybeSingle();
      const grad = tok?.graduated_at ? Math.floor(new Date(tok.graduated_at).getTime() / 1000) : null;
      if (grad && grad <= deadline) { outcome = "yes"; reason = "graduated on or before T"; }
      else if (now >= deadline + GRACE) { outcome = "no"; reason = "did not graduate by T"; }
      else { outcome = "skip"; reason = "grace"; }
    } else if (now >= deadline + GRACE) {
      outcome = "void";
      reason = "unresolved at T+grace → void, not steal";
    } else {
      outcome = "skip";
      reason = "waiting grace / oracle";
    }
    if (outcome === "skip") {
      results.push({ mint: m.mint, outcome, reason });
      continue;
    }
    await admin.from("orbitx_pad_markets").update({
      status: outcome === "void" ? "void" : "resolved",
      outcome,
      resolved_at: new Date().toISOString(),
    }).eq("mint", m.mint);
    results.push({ mint: m.mint, outcome, reason });
  }
  return json(res, { ok: true, cranked: results.length, results });
}
