import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
// signup-guard — the ONLY signup path. Enforces:
//   * max 1 account per device (fingerprint)
//   * max 3 accounts per IP
// Runs with the service role; public GoTrue signup is disabled so this can't be bypassed.
const ALLOWED_ORIGINS = [
  "https://ogscan.fun", "https://www.ogscan.fun",
  "https://orbitx.world", "https://www.orbitx.world",
];
const MAX_PER_DEVICE = 1;
const MAX_PER_IP = 3;

function cors(origin: string | null) {
  const o = origin && ALLOWED_ORIGINS.includes(origin) ? origin : "https://www.ogscan.fun";
  return {
    "Access-Control-Allow-Origin": o,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

Deno.serve(async (req) => {
  const headers = { ...cors(req.headers.get("origin")), "Content-Type": "application/json" };
  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "method_not_allowed" }), { status: 405, headers });

  try {
    const { email, password, username, fingerprint } = await req.json();
    if (!email || !password) return new Response(JSON.stringify({ error: "Email and password are required" }), { status: 400, headers });
    if (typeof password !== "string" || password.length < 8) return new Response(JSON.stringify({ error: "Password must be at least 8 characters" }), { status: 400, headers });
    if (!fingerprint || typeof fingerprint !== "string") return new Response(JSON.stringify({ error: "device_fingerprint_required" }), { status: 400, headers });

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? req.headers.get("x-real-ip") ?? req.headers.get("cf-connecting-ip") ?? "unknown";
    const userAgent = req.headers.get("user-agent") ?? "unknown";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1) device limit
    const { count: deviceCount } = await admin.from("account_origins")
      .select("user_id", { count: "exact", head: true }).eq("fingerprint", fingerprint);
    if ((deviceCount ?? 0) >= MAX_PER_DEVICE) {
      return new Response(JSON.stringify({ error: "device_limit", message: "This device already has an account. Only 1 account is allowed per device." }), { status: 429, headers });
    }
    // 2) IP limit
    if (ip !== "unknown") {
      const { count: ipCount } = await admin.from("account_origins")
        .select("user_id", { count: "exact", head: true }).eq("ip", ip);
      if ((ipCount ?? 0) >= MAX_PER_IP) {
        return new Response(JSON.stringify({ error: "ip_limit", message: "Too many accounts created from this network (max 3)." }), { status: 429, headers });
      }
    }

    // 3) create the user (autoconfirm matches project setting)
    const { data, error } = await admin.auth.admin.createUser({
      email, password,
      email_confirm: true,
      user_metadata: { username: username || String(email).split("@")[0] },
    });
    if (error) {
      const dup = /already|registered|exists/i.test(error.message);
      return new Response(JSON.stringify({ error: dup ? "email_exists" : "auth_error", message: error.message }), { status: 400, headers });
    }

    // 4) record origin (best-effort; failure shouldn't block, but log)
    const uid = data.user?.id;
    if (uid) {
      await admin.from("account_origins").insert({ user_id: uid, fingerprint, ip, user_agent: userAgent });
    }

    return new Response(JSON.stringify({ success: true, user: { id: uid, email: data.user?.email } }), { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: "server_error", message: e instanceof Error ? e.message : String(e) }), { status: 500, headers });
  }
});
