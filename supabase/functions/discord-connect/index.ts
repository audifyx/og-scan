// discord-connect — connect a Discord channel for pump.fun migration alerts
// via an incoming Webhook URL (Channel Settings > Integrations > Webhooks).
// JWT-gated. The poller posts rich embeds to the stored webhook.
//
// POST actions:
//   { action: "connect", webhookUrl }  -> validate + store + hello message
//   { action: "status" }               -> current integration (url masked)
//   { action: "settings", alerts_migrations?, min_marketcap? }
//   { action: "disconnect" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const WEBHOOK_RE = /^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;
const safe = (d: any) => d && ({
  id: d.id, channel_name: d.channel_name, alerts_migrations: d.alerts_migrations,
  min_marketcap: d.min_marketcap, created_at: d.created_at,
  webhook_hint: d.webhook_url ? d.webhook_url.replace(/\/[\w-]+$/, "/••••") : null,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    if (action === "status") {
      const { data } = await admin.from("discord_integrations").select("*").eq("user_id", user.id).maybeSingle();
      return json({ integration: safe(data) });
    }

    if (action === "settings") {
      const patch: any = { updated_at: new Date().toISOString() };
      if (typeof body.alerts_migrations === "boolean") patch.alerts_migrations = body.alerts_migrations;
      if (body.min_marketcap != null) patch.min_marketcap = Number(body.min_marketcap) || 0;
      const { data, error } = await admin.from("discord_integrations").update(patch).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ integration: safe(data) });
    }

    if (action === "disconnect") {
      await admin.from("discord_integrations").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    if (action === "connect") {
      const webhookUrl = String(body.webhookUrl || "").trim();
      if (!WEBHOOK_RE.test(webhookUrl)) return json({ error: "That's not a valid Discord webhook URL. Channel → Edit → Integrations → Webhooks → Copy URL." }, 400);
      // Validate by fetching the webhook (returns its name/channel) then say hello.
      const check = await fetch(webhookUrl);
      if (!check.ok) return json({ error: "Discord rejected that webhook URL. Make sure it's current." }, 400);
      const meta = await check.json().catch(() => ({}));
      await fetch(webhookUrl, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "OG Scan", content: "✅ Connected to OG Scan. You'll get pump.fun migration alerts here." }),
      }).catch(() => {});

      const row = { user_id: user.id, webhook_url: webhookUrl, channel_name: meta?.name || null, updated_at: new Date().toISOString() };
      const { data: existing } = await admin.from("discord_integrations").select("id").eq("user_id", user.id).maybeSingle();
      let saved: any;
      if (existing) ({ data: saved } = await admin.from("discord_integrations").update(row).eq("user_id", user.id).select().single());
      else ({ data: saved } = await admin.from("discord_integrations").insert(row).select().single());
      return json({ ok: true, integration: safe(saved) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
