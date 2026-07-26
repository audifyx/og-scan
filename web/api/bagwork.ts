/**
 * /api/bagwork — Bagwork task marketplace API
 *
 * GET  ?action=tasks
 * GET  ?action=stats
 * GET  ?action=leaderboard
 * GET  ?action=my_submissions          (auth)
 * GET  ?action=admin_tasks             (owner)
 * GET  ?action=admin_submissions       (owner)
 * POST action=submit                   (auth) { task_id, wallet_address, proof_text?, proof_url?, proof_file_name? }
 * POST action=upsert_task              (owner)
 * POST action=delete_task              (owner) { id }
 * POST action=review                   (owner) { id, status, admin_note?, tx_signature? }
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const OWNER_EMAILS = ["audifyx@gmail.com"];
const OWNER_WALLETS = String(process.env.OWNER_WALLETS || process.env.VITE_OWNER_WALLETS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Content-Type": "application/json",
};

function json(res: VercelResponse, body: unknown, status = 200) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
  return res.status(status).json(body);
}

function isOwnerEmail(email: string | null): boolean {
  if (!email) return false;
  const e = email.toLowerCase();
  if (OWNER_EMAILS.includes(e)) return true;
  const m = e.match(/^([1-9a-zA-Z]{32,44})@wallet\.orbitx\.app$/i);
  if (m && OWNER_WALLETS.some((w) => w === m[1] || w.toLowerCase() === m[1].toLowerCase())) return true;
  return false;
}

function svc() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error("missing_service_role");
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}

async function userFromAuth(req: VercelRequest): Promise<{ id: string; email: string | null } | null> {
  const auth = String(req.headers.authorization || "");
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token || !SUPABASE_URL || !ANON_KEY) return null;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? null };
}

function bodyOf(req: VercelRequest): Record<string, unknown> {
  if (typeof req.body === "string") {
    try { return JSON.parse(req.body || "{}"); } catch { return {}; }
  }
  return (req.body || {}) as Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === "OPTIONS") {
    for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v);
    return res.status(204).end();
  }

  try {
    const q = req.query || {};
    const action = String(q.action || bodyOf(req).action || "").toLowerCase();
    const db = svc();

    if (req.method === "GET" && (action === "tasks" || !action)) {
      const { data, error } = await db
        .from("bagwork_tasks")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { tasks: data ?? [] });
    }

    if (req.method === "GET" && action === "stats") {
      const [tasks, subs, paid] = await Promise.all([
        db.from("bagwork_tasks").select("id", { count: "exact", head: true }).eq("active", true),
        db.from("bagwork_submissions").select("id", { count: "exact", head: true }),
        db.from("bagwork_submissions").select("id", { count: "exact", head: true }).in("status", ["approved", "paid"]),
      ]);
      const { data: payouts } = await db.from("bagwork_payouts").select("amount_usdc");
      const paidUsdc = (payouts ?? []).reduce((a, p) => a + Number(p.amount_usdc || 0), 0);
      return json(res, {
        active_tasks: tasks.count ?? 0,
        total_submissions: subs.count ?? 0,
        approved_submissions: paid.count ?? 0,
        paid_usdc: paidUsdc,
      });
    }

    if (req.method === "GET" && action === "leaderboard") {
      const { data: rows, error } = await db
        .from("bagwork_submissions")
        .select("user_id, wallet_address, status, bagwork_tasks(reward_usdc)")
        .in("status", ["approved", "paid"]);
      if (error) return json(res, { error: error.message }, 500);
      const map = new Map<string, { user_id: string; wallet: string; earned: number; count: number }>();
      for (const r of rows ?? []) {
        const key = r.user_id as string;
        const reward = Number((r as any).bagwork_tasks?.reward_usdc ?? 0);
        const cur = map.get(key) || { user_id: key, wallet: r.wallet_address as string, earned: 0, count: 0 };
        cur.earned += reward;
        cur.count += 1;
        cur.wallet = (r.wallet_address as string) || cur.wallet;
        map.set(key, cur);
      }
      const leaderboard = [...map.values()].sort((a, b) => b.earned - a.earned).slice(0, 50);
      return json(res, { leaderboard });
    }

    const user = await userFromAuth(req);

    if (req.method === "GET" && action === "my_submissions") {
      if (!user) return json(res, { error: "unauthorized" }, 401);
      const { data, error } = await db
        .from("bagwork_submissions")
        .select("*, bagwork_tasks(title, reward_usdc, category, difficulty)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { submissions: data ?? [] });
    }

    if (req.method === "POST" && action === "submit") {
      if (!user) return json(res, { error: "unauthorized" }, 401);
      const b = bodyOf(req);
      const taskId = String(b.task_id || "");
      const wallet = String(b.wallet_address || "").trim();
      if (!taskId || wallet.length < 32) return json(res, { error: "task_id and wallet_address required" }, 400);

      const { data: task, error: te } = await db.from("bagwork_tasks").select("*").eq("id", taskId).eq("active", true).maybeSingle();
      if (te || !task) return json(res, { error: "task not found" }, 404);

      if (task.max_submissions_per_user != null) {
        const { count } = await db
          .from("bagwork_submissions")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("task_id", taskId);
        if ((count ?? 0) >= task.max_submissions_per_user) {
          return json(res, { error: "submission limit reached" }, 400);
        }
      }

      const { data, error } = await db
        .from("bagwork_submissions")
        .insert({
          task_id: taskId,
          user_id: user.id,
          wallet_address: wallet,
          proof_text: b.proof_text ? String(b.proof_text).trim() : null,
          proof_url: b.proof_url ? String(b.proof_url) : null,
          proof_file_name: b.proof_file_name ? String(b.proof_file_name) : null,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { submission: data });
    }

    // ── Owner routes ──
    const owner = user && isOwnerEmail(user.email);

    if (req.method === "GET" && action === "admin_tasks") {
      if (!owner) return json(res, { error: "forbidden" }, 403);
      const { data, error } = await db.from("bagwork_tasks").select("*").order("sort_order", { ascending: false });
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { tasks: data ?? [] });
    }

    if (req.method === "GET" && action === "admin_submissions") {
      if (!owner) return json(res, { error: "forbidden" }, 403);
      const { data, error } = await db
        .from("bagwork_submissions")
        .select("*, bagwork_tasks(title, reward_usdc, category)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { submissions: data ?? [] });
    }

    if (req.method === "POST" && action === "upsert_task") {
      if (!owner || !user) return json(res, { error: "forbidden" }, 403);
      const b = bodyOf(req);
      const row: Record<string, unknown> = {
        title: String(b.title || "").trim(),
        description: String(b.description || "").trim(),
        instructions: String(b.instructions || "").trim(),
        reward_usdc: Number(b.reward_usdc ?? 0),
        active: b.active !== false,
        max_submissions_per_user: b.max_submissions_per_user == null || b.max_submissions_per_user === ""
          ? null
          : Number(b.max_submissions_per_user),
        sort_order: Number(b.sort_order ?? 0),
        category: String(b.category || "general"),
        difficulty: String(b.difficulty || "easy"),
        tags: Array.isArray(b.tags) ? b.tags : [],
      };
      if (!row.title) return json(res, { error: "title required" }, 400);
      const id = b.id ? String(b.id) : null;
      if (id) {
        const { data, error } = await db.from("bagwork_tasks").update(row).eq("id", id).select("*").single();
        if (error) return json(res, { error: error.message }, 500);
        return json(res, { task: data });
      }
      row.created_by = user.id;
      const { data, error } = await db.from("bagwork_tasks").insert(row).select("*").single();
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { task: data });
    }

    if (req.method === "POST" && action === "delete_task") {
      if (!owner) return json(res, { error: "forbidden" }, 403);
      const id = String(bodyOf(req).id || "");
      if (!id) return json(res, { error: "id required" }, 400);
      const { error } = await db.from("bagwork_tasks").delete().eq("id", id);
      if (error) return json(res, { error: error.message }, 500);
      return json(res, { ok: true });
    }

    if (req.method === "POST" && action === "review") {
      if (!owner || !user) return json(res, { error: "forbidden" }, 403);
      const b = bodyOf(req);
      const id = String(b.id || "");
      const status = String(b.status || "");
      if (!id || !["approved", "rejected", "paid", "pending"].includes(status)) {
        return json(res, { error: "id and valid status required" }, 400);
      }
      const patch: Record<string, unknown> = {
        status,
        admin_note: b.admin_note ? String(b.admin_note) : null,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      };
      if (status === "paid") patch.paid_at = new Date().toISOString();

      const { data: sub, error } = await db.from("bagwork_submissions").update(patch).eq("id", id).select("*, bagwork_tasks(reward_usdc)").single();
      if (error) return json(res, { error: error.message }, 500);

      if (status === "paid" && sub) {
        const amount = Number((sub as any).bagwork_tasks?.reward_usdc ?? 0);
        await db.from("bagwork_payouts").upsert({
          submission_id: sub.id,
          user_id: sub.user_id,
          wallet_address: sub.wallet_address,
          amount_usdc: amount,
          tx_signature: b.tx_signature ? String(b.tx_signature) : null,
          note: b.admin_note ? String(b.admin_note) : null,
          paid_by: user.id,
        }, { onConflict: "submission_id" });
      }
      return json(res, { submission: sub });
    }

    return json(res, { error: `unknown action: ${action}` }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "missing_service_role") return json(res, { error: "Server not configured" }, 500);
    return json(res, { error: msg }, 500);
  }
}
