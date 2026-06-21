// x-poster — Bring-your-own X (Twitter) account auto-poster.
// Per-user OAuth 1.0a credentials (api key/secret + access token/secret) are
// stored in x_accounts and used to post tweets as the user's own account.
//
// JWT-gated actions (Authorization: Bearer <user JWT>):
//   { action: "connect", api_key, api_secret, access_token, access_secret }
//   { action: "status" }
//   { action: "settings", auto_migrations?, auto_reports?, enabled? }
//   { action: "test" }                       -- posts a small verification tweet
//   { action: "disconnect" }
//
// Service-role action (Authorization: Bearer <service role key>):
//   { action: "post", user_id, text }        -- used by pollers/automations
//   { action: "post", text }  with the service role posting requires user_id.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const safe = (d: any) =>
  d && {
    id: d.id,
    handle: d.handle,
    auto_migrations: d.auto_migrations,
    auto_reports: d.auto_reports,
    enabled: d.enabled,
    created_at: d.created_at,
    key_hint: d.api_key ? `••••${String(d.api_key).slice(-4)}` : null,
  };

// ── OAuth 1.0a (RFC 3986 strict) ───────────────────────────────────────────────
function pct(s: string) {
  return encodeURIComponent(s).replace(/[!*'()]/g, (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase());
}

type Creds = { ck: string; cs: string; tk: string; ts: string };

async function sign(method: string, url: string, oauth: Record<string, string>, query: Record<string, string>, c: Creds) {
  const all = { ...oauth, ...query };
  const params = Object.entries(all).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${pct(k)}=${pct(v)}`).join("&");
  const base = `${method.toUpperCase()}&${pct(url)}&${pct(params)}`;
  const signingKey = `${pct(c.cs)}&${pct(c.ts)}`;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(signingKey), { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(base));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function authHeader(method: string, url: string, c: Creds, query: Record<string, string> = {}) {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.ck,
    oauth_nonce: crypto.randomUUID().replace(/-/g, ""),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.tk,
    oauth_version: "1.0",
  };
  oauth.oauth_signature = await sign(method, url, oauth, query, c);
  return "OAuth " + Object.entries(oauth).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${pct(k)}="${pct(v)}"`).join(", ");
}

// Verify credentials + fetch handle via OAuth 1.0a user context.
async function verify(c: Creds): Promise<{ ok: boolean; handle?: string; error?: string }> {
  const url = "https://api.twitter.com/2/users/me";
  const header = await authHeader("GET", url, c);
  const r = await fetch(url, { headers: { Authorization: header } });
  if (r.ok) {
    const j = await r.json().catch(() => ({}));
    return { ok: true, handle: j?.data?.username ? `@${j.data.username}` : undefined };
  }
  const t = await r.text();
  return { ok: false, error: `X rejected the credentials (${r.status}): ${t.slice(0, 160)}` };
}

async function postTweet(c: Creds, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const url = "https://api.twitter.com/2/tweets";
  // JSON body params are NOT part of the OAuth 1.0a signature base string.
  const header = await authHeader("POST", url, c);
  const r = await fetch(url, {
    method: "POST",
    headers: { Authorization: header, "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
  const j = await r.json().catch(() => ({}));
  if (r.ok && j?.data?.id) return { ok: true, id: j.data.id };
  return { ok: false, error: `Tweet failed (${r.status}): ${JSON.stringify(j).slice(0, 200)}` };
}

const credsOf = (d: any): Creds => ({ ck: d.api_key, cs: d.api_secret, tk: d.access_token, ts: d.access_secret });

// Decode a JWT payload (no verification — the platform gateway already verified
// the signature when verify_jwt=true) to read the role claim.
function jwtRole(token: string): string | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = JSON.parse(atob(pad));
    return json.role ?? null;
  } catch {
    return null;
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authH = req.headers.get("Authorization") || "";
    if (!authH) return json({ error: "Unauthorized" }, 401);
    const token = authH.replace("Bearer ", "").trim();
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    // ── Service-role: internal automated posting ──────────────────────────────
    const isService = token === SERVICE_ROLE || jwtRole(token) === "service_role";
    if (action === "post" && isService) {
      const uid = String(body.user_id || "");
      const text = String(body.text || "").trim();
      if (!uid || !text) return json({ error: "user_id and text required" }, 400);
      const { data } = await admin.from("x_accounts").select("*").eq("user_id", uid).maybeSingle();
      if (!data || !data.enabled) return json({ error: "No enabled X account for user" }, 404);
      const res = await postTweet(credsOf(data), text);
      return json(res, res.ok ? 200 : 400);
    }

    // ── Everything else: user JWT ─────────────────────────────────────────────
    const { data: { user } } = await createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authH } },
    }).auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    if (action === "status") {
      const { data } = await admin.from("x_accounts").select("*").eq("user_id", user.id).maybeSingle();
      return json({ account: safe(data) });
    }

    if (action === "connect") {
      const c: Creds = {
        ck: String(body.api_key || "").trim(),
        cs: String(body.api_secret || "").trim(),
        tk: String(body.access_token || "").trim(),
        ts: String(body.access_secret || "").trim(),
      };
      if (!c.ck || !c.cs || !c.tk || !c.ts) {
        return json({ error: "api_key, api_secret, access_token and access_secret are all required" }, 400);
      }
      const v = await verify(c);
      if (!v.ok) return json({ error: v.error }, 400);
      const row = {
        user_id: user.id,
        api_key: c.ck,
        api_secret: c.cs,
        access_token: c.tk,
        access_secret: c.ts,
        handle: v.handle ?? null,
        enabled: true,
      };
      const { data, error } = await admin.from("x_accounts").upsert(row, { onConflict: "user_id" }).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ account: safe(data) });
    }

    if (action === "settings") {
      const patch: any = {};
      if (typeof body.auto_migrations === "boolean") patch.auto_migrations = body.auto_migrations;
      if (typeof body.auto_reports === "boolean") patch.auto_reports = body.auto_reports;
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      const { data, error } = await admin.from("x_accounts").update(patch).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ account: safe(data) });
    }

    if (action === "test") {
      const { data } = await admin.from("x_accounts").select("*").eq("user_id", user.id).maybeSingle();
      if (!data) return json({ error: "Connect an X account first" }, 400);
      const text = `OG Scan connected ✅ auto-posting is live. ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`;
      const res = await postTweet(credsOf(data), text);
      return json(res, res.ok ? 200 : 400);
    }

    if (action === "disconnect") {
      await admin.from("x_accounts").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
