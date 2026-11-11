/**
 * GET /api/ogdex/tg-stats — Telegram bot stats for the operator.
 *
 * Reads the aggregates from the telegram_bot_stats() RPC (Supabase,
 * service-role key — same pattern as web/api/_stats.js). Unlinked and
 * noindex, like the /stats dashboard. Nobody else needs this URL.
 *
 * ?format=json returns the raw aggregates. Default returns a simple
 * black/gold HTML page: headline counts, daily activity (14 days),
 * recent users, recent events.
 */

// MUST be .js, NOT .ts — Vercel does not bundle .ts files dynamically
// imported from the .js ogdex.js ROUTES map.
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  "https://ibojtmeqgzabgeiwbvhf.supabase.co";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtTs(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("en-US", { timeZone: "America/New_York" });
  } catch {
    return String(v);
  }
}

function fmtDay(v) {
  if (!v) return "—";
  return String(v).slice(0, 10);
}

function page(d) {
  const n = (v) => (v == null ? 0 : v);
  const daily = (d.daily || [])
    .map(
      (r) =>
        `<tr><td>${esc(fmtDay(r.day))}</td><td>${n(r.messages)}</td><td>${n(r.scans)}</td><td>${n(r.users)}</td></tr>`,
    )
    .join("");
  const users = (d.recent_users || [])
    .map((u) => {
      const name = [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
      const handle = u.username ? "@" + u.username : "—";
      return `<tr><td>${esc(name)}</td><td>${esc(handle)}</td><td>${esc(u.user_id)}</td><td>${esc(u.chat_type || "—")}</td><td>${esc(u.last_command || "—")}</td><td>${n(u.message_count)}</td><td>${esc(fmtTs(u.last_seen))}</td><td>${esc(fmtTs(u.first_seen))}</td></tr>`;
    })
    .join("");
  const events = (d.recent_events || [])
    .map((e) => {
      const handle = e.username ? "@" + e.username : String(e.user_id ?? "—");
      const detail = e.detail ? esc(String(e.detail).slice(0, 10) + "…" + String(e.detail).slice(-4)) : "—";
      return `<tr><td>${esc(fmtTs(e.created_at))}</td><td>${esc(handle)}</td><td>${esc(e.kind)}</td><td>${detail}</td></tr>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="robots" content="noindex,nofollow">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>OrbitX Telegram bot — stats</title>
<style>
body{background:#050505;color:#f4f4f2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;margin:0;padding:32px}
h1{color:#e8b84a;font-size:28px;margin:0 0 4px}
p.sub{color:#9a9a94;margin:0 0 28px}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:32px}
.card{border:1px solid #2a2a26;border-radius:12px;padding:16px}
.card b{display:block;font-size:30px;color:#e8b84a}
.card span{color:#9a9a94;font-size:13px}
h2{font-size:18px;margin:28px 0 10px}
table{border-collapse:collapse;width:100%;font-size:14px}
th,td{border-bottom:1px solid #22221f;padding:8px 10px;text-align:left;white-space:nowrap}
th{color:#9a9a94;font-weight:600}
td{color:#f4f4f2}
.empty{color:#9a9a94}
</style></head><body>
<h1>OrbitX Telegram bot</h1>
<p class="sub">Usage stats — @Orbitxofficialbot · times in America/New_York · unlinked, private</p>
<div class="grid">
<div class="card"><b>${n(d.total_users)}</b><span>Total users</span></div>
<div class="card"><b>${n(d.new_today)}</b><span>New today</span></div>
<div class="card"><b>${n(d.active_today)}</b><span>Active today</span></div>
<div class="card"><b>${n(d.total_messages)}</b><span>Total messages</span></div>
<div class="card"><b>${n(d.total_scans)}</b><span>Total scans</span></div>
<div class="card"><b>${n(d.messages_today)}</b><span>Messages today</span></div>
<div class="card"><b>${n(d.scans_today)}</b><span>Scans today</span></div>
</div>
<h2>Daily activity — last 14 days</h2>
${daily ? `<table><tr><th>Day</th><th>Messages</th><th>Scans</th><th>Users</th></tr>${daily}</table>` : `<p class="empty">No activity yet.</p>`}
<h2>Recent users</h2>
${users ? `<table><tr><th>Name</th><th>Username</th><th>User ID</th><th>Chat</th><th>Last action</th><th>Messages</th><th>Last seen</th><th>First seen</th></tr>${users}</table>` : `<p class="empty">No users yet — nobody has messaged the bot.</p>`}
<h2>Recent events</h2>
${events ? `<table><tr><th>When</th><th>User</th><th>Action</th><th>Token</th></tr>${events}</table>` : `<p class="empty">No events yet.</p>`}
</body></html>`;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "GET only" }));
  }
  if (!SERVICE_KEY) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Server not configured (missing service role key)" }));
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/telegram_bot_stats`, {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });
    if (!r.ok) throw new Error(`telegram_bot_stats failed (${r.status})`);
    const data = await r.json();
    if (String(req.query.format || "").toLowerCase() === "json") {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).end(JSON.stringify(data));
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).end(page(data || {}));
  } catch (e) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: String((e && e.message) || e).slice(0, 200) }));
  }
}
