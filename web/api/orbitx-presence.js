/**
 * POST /api/orbitx-presence — authenticated heartbeat for the signed-in user.
 *
 * Writes only that user's ox_admin_presence row (service role scoped to JWT uid).
 * PAGE_VIEW events are recorded when `path` changes, not on every beat.
 */
import { appFromPath, deviceFromUserAgent, recordOwnerEvent, upsertPresence } from "./orbitx/owner-command.js";

export const config = { maxDuration: 15 };

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://ffjipnkhcebjvttliptb.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

async function authUser(token) {
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: ANON_KEY },
  });
  if (!r.ok) return null;
  return r.json().catch(() => null);
}

async function sb(path, init = {}) {
  if (!SERVICE_KEY) throw new Error("missing_service_role");
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(text.slice(0, 240) || `supabase ${r.status}`);
  return text ? JSON.parse(text) : null;
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const auth = String(req.headers.authorization || "");
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (!token) return res.status(401).json({ error: "Missing auth token" });
    const user = await authUser(token);
    const uid = user?.id;
    if (!uid) return res.status(401).json({ error: "Invalid session" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    const ua = String(req.headers["user-agent"] || body.userAgent || "");
    const path = String(body.path || body.current_path || "/").slice(0, 240);
    const offline = Boolean(body.offline);
    const username = body.username ? String(body.username).slice(0, 80) : null;
    const avatar = body.avatarUrl || body.avatar_url || null;
    const wallet = body.wallet || body.wallet_address || null;

    await upsertPresence(sb, {
      user_id: uid,
      username,
      avatar_url: avatar,
      wallet_address: wallet,
      status: offline ? "offline" : "online",
      current_path: path,
      current_app: appFromPath(path),
      device: body.device || deviceFromUserAgent(ua),
      user_agent: ua.slice(0, 240),
      session_id: body.sessionId || null,
    });

    if (!offline && body.pageView) {
      await recordOwnerEvent(sb, {
        event_type: "PAGE_VIEW",
        user_id: uid,
        wallet_address: wallet,
        path,
        application: appFromPath(path),
        title: `Opened ${path}`,
        metadata: { device: body.device || deviceFromUserAgent(ua) },
      });
    }
    if (offline) {
      await recordOwnerEvent(sb, {
        event_type: "USER_OFFLINE",
        user_id: uid,
        wallet_address: wallet,
        path,
        title: "Went offline",
      });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    // Presence must never 500 the product if the migration is not applied yet.
    return res.status(200).json({ ok: false, skipped: true, error: String(e?.message || e).slice(0, 120) });
  }
}
