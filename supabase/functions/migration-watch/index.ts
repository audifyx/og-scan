// migration-watch — conversational persistent watches on the pump.fun migration
// firehose. AI turns "alert me on any migration with 50+ holders and revoked
// mint over $30k mcap" into structured conditions; the poller evaluates every
// new migration against them. JWT-gated CRUD + parse + test.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const NVIDIA_API_KEY = Deno.env.get("NVIDIA_API_KEY") || "";
const NVIDIA_BASE = Deno.env.get("NVIDIA_BASE_URL") || "https://integrate.api.nvidia.com/v1";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const WEBHOOK_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

// Turn a natural-language migration filter into structured conditions.
async function parseConditions(nl: string): Promise<any[]> {
  if (!nl.trim() || !NVIDIA_API_KEY) return [];
  const prompt = `Convert this pump.fun migration filter into a JSON array of condition objects, evaluated once on a freshly migrated token. Request: "${nl}"\n\n` +
    `Allowed conditions:\n` +
    `{"metric":"mcap","op":"above|below","value":<usd>}\n` +
    `{"metric":"liquidity","op":"above|below","value":<usd>}\n` +
    `{"metric":"holders","op":"above|below","value":<count>}\n` +
    `{"metric":"momentum","op":"above|below","value":<0-100>}\n` +
    `{"metric":"og_score","op":"above|below","value":<0-100>}\n` +
    `{"metric":"mint_revoked","value":true|false}\n` +
    `{"metric":"freeze_revoked","value":true|false}\n` +
    `Rules: "locked/safe/revoked mint" -> mint_revoked true; "renounced/safe authority" -> freeze_revoked true; "50+ holders" -> holders above 50; "$30k mcap" -> mcap above 30000; "high momentum" -> momentum above 60. Only use the metrics above; ignore anything you cannot map. Output ONLY the JSON array.`;
  try {
    const r = await fetch(`${NVIDIA_BASE}/chat/completions`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${NVIDIA_API_KEY}` },
      body: JSON.stringify({ model: "meta/llama-3.1-8b-instruct", messages: [{ role: "system", content: "Output only a JSON array." }, { role: "user", content: prompt }], temperature: 0.2, max_tokens: 500 }),
    });
    const j = await r.json();
    let t = String(j.choices?.[0]?.message?.content || "").trim();
    const a = t.indexOf("["), b = t.lastIndexOf("]");
    if (a >= 0 && b > a) t = t.slice(a, b + 1);
    const arr = JSON.parse(t);
    return Array.isArray(arr) ? arr.filter((c) => c && c.metric) : [];
  } catch { return []; }
}

const safe = (w: any) => w && ({ id: w.id, nl_request: w.nl_request, conditions: w.conditions, channel_type: w.channel_type, enabled: w.enabled, min_age_min: w.min_age_min, created_at: w.created_at, last_fired_at: w.last_fired_at, webhook_hint: w.webhook_url ? w.webhook_url.replace(/\/[\w-]+$/, "/••••") : null });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authH = req.headers.get("Authorization") || "";
    if (!authH) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authH } } }).auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "list";

    if (action === "list") {
      const { data } = await admin.from("migration_watches").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      return json({ watches: (data || []).map(safe) });
    }
    if (action === "parse") { return json({ conditions: await parseConditions(String(body.nl_request || "")) }); }
    if (action === "test") {
      const url = String(body.webhook_url || "").trim();
      if (!WEBHOOK_RE.test(url) && !/^https:\/\//.test(url)) return json({ error: "Enter a valid webhook URL" }, 400);
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: "✅ OG Scan migration watch connected. New pump.fun migrations matching your filter will land here." }) });
      return json({ ok: r.ok });
    }
    if (action === "create") {
      const url = String(body.webhook_url || "").trim();
      if (!url) return json({ error: "Webhook URL required" }, 400);
      let conditions = Array.isArray(body.conditions) ? body.conditions : [];
      if (!conditions.length && body.nl_request) conditions = await parseConditions(String(body.nl_request));
      const row = { user_id: user.id, nl_request: body.nl_request || null, conditions, channel_type: body.channel_type || "discord", webhook_url: url, min_age_min: Number(body.min_age_min) || 0, enabled: body.enabled !== false };
      const { data, error } = await admin.from("migration_watches").insert(row).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ watch: safe(data) });
    }
    if (action === "update") {
      const patch: any = {};
      for (const k of ["enabled", "conditions", "webhook_url", "channel_type", "nl_request", "min_age_min"]) if (k in body) patch[k] = body[k];
      const { data, error } = await admin.from("migration_watches").update(patch).eq("id", body.id).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ watch: safe(data) });
    }
    if (action === "delete") {
      await admin.from("migration_watches").delete().eq("id", body.id).eq("user_id", user.id);
      return json({ ok: true });
    }
    return json({ error: "Unknown action" }, 400);
  } catch (e) { return json({ error: (e as Error).message }, 500); }
});
