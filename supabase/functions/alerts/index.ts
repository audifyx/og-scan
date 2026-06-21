// alerts — manage webhook alert rules (Discord or any custom webhook). JWT-gated.
// Actions: list | create | update | delete | parse | test
//   create/update: { name?, type, mint?, conditions?, nl_request?, channel_type, webhook_url, enabled? }
//   parse: { mint?, nl_request } -> AI converts "alert me when..." into structured conditions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DISCORD_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const URL_RE = /^https:\/\/[^\s]+$/;

// AI: turn "alert me when it 2x's / dips 20% / hits 10M mc" into structured conditions.
async function parseConditions(nl: string): Promise<any[]> {
  const prompt = `Convert this crypto alert request into a JSON array of condition objects. Request: "${nl}"\n\n` +
    `Allowed condition shapes:\n` +
    `{"metric":"price_change_pct","window":"5m|1h|6h|24h","direction":"up|down","value":<percent>}\n` +
    `{"metric":"mcap","op":"above|below","value":<usd>}\n` +
    `{"metric":"price","op":"above|below","value":<usd>}\n` +
    `{"metric":"liquidity","op":"above|below","value":<usd>}\n` +
    `{"metric":"holders","op":"above|below","value":<count>}\n` +
    `{"metric":"new_ath"}\n` +
    `Rules: interpret "2x"/"doubles" as price_change_pct up 100; "10M mc" as mcap above 10000000; "dips 20%" as price_change_pct down 20 (default window 24h if unspecified). Output ONLY the JSON array.`;
  try {
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({ model: "meta/llama-3.1-8b-instruct", messages: [{ role: "system", content: "Output only a JSON array." }, { role: "user", content: prompt }], temperature: 0.2, max_tokens: 500 }),
      signal: AbortSignal.timeout(20000),
    });
    const j = await r.json();
    let t = String(j.choices?.[0]?.message?.content || "").trim();
    const a = t.indexOf("["), b = t.lastIndexOf("]");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    const arr = JSON.parse(t);
    return Array.isArray(arr) ? arr.slice(0, 8) : [];
  } catch { return []; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const { data } = await admin.from("alert_rules").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return json({ rules: (data || []).map((r: any) => ({ ...r, webhook_url: r.webhook_url ? r.webhook_url.replace(/\/[\w-]+$/, "/\u2022\u2022\u2022\u2022") : null })) });
    }

    if (action === "parse") {
      const conditions = await parseConditions(String(body.nl_request || ""));
      return json({ conditions });
    }

    if (action === "delete") {
      await admin.from("alert_rules").delete().eq("id", body.id).eq("user_id", user.id);
      return json({ ok: true });
    }

    if (action === "update") {
      const patch: any = {};
      for (const k of ["name", "enabled", "conditions", "webhook_url", "channel_type", "mint", "symbol", "type", "nl_request"]) if (k in body) patch[k] = body[k];
      const { data, error } = await admin.from("alert_rules").update(patch).eq("id", body.id).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, rule: data });
    }

    if (action === "test") {
      const url = String(body.webhook_url || "");
      if (!URL_RE.test(url)) return json({ error: "Invalid webhook URL." }, 400);
      const isDiscord = DISCORD_RE.test(url);
      const payload = isDiscord
        ? { username: "OG Scan Alerts", embeds: [{ title: "\u2705 OG Scan test alert", description: "Your webhook is connected. You'll receive alerts here.", color: 3066993 }] }
        : { source: "ogscan", event: "test", message: "OG Scan webhook connected." };
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      return json({ ok: r.ok, status: r.status });
    }

    if (action === "create") {
      const url = String(body.webhook_url || "");
      if (!URL_RE.test(url)) return json({ error: "Invalid webhook URL." }, 400);
      const type = body.type === "migrations" ? "migrations" : "token";
      const channel_type = DISCORD_RE.test(url) ? "discord" : (body.channel_type === "discord" ? "discord" : "webhook");
      let conditions = Array.isArray(body.conditions) ? body.conditions : [];
      if (!conditions.length && body.nl_request) conditions = await parseConditions(String(body.nl_request));
      if (type === "token" && !body.mint) return json({ error: "A token alert needs a contract address." }, 400);
      const row = {
        user_id: user.id, name: body.name || (type === "migrations" ? "Pump.fun migrations" : (body.symbol || body.mint)),
        type, mint: body.mint || null, symbol: body.symbol || null,
        conditions, nl_request: body.nl_request || null, channel_type, webhook_url: url, enabled: body.enabled !== false,
      };
      const { data, error } = await admin.from("alert_rules").insert(row).select().single();
      if (error) return json({ error: error.message }, 400);
      return json({ ok: true, rule: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) { return json({ error: e instanceof Error ? e.message : String(e) }, 500); }
});
