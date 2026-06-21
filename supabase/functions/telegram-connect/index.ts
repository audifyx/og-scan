// telegram-connect — connect/manage a user's OWN Telegram bot (multi-tenant).
// User pastes their BotFather token; we validate it (getMe), set the webhook
// to telegram-webhook with a per-bot secret, and store it. Requires user JWT.
//
// POST actions:
//   { action: "connect", botToken }      -> validate + setWebhook + upsert
//   { action: "disconnect" }             -> deleteWebhook + remove row
//   { action: "status" }                 -> current bot info (no token leaked)
//   { action: "settings", alerts_migrations?, ai_enabled?, min_marketcap? }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const safe = (b: any) => b && ({
  id: b.id, bot_username: b.bot_username, bot_id: b.bot_id,
  alerts_migrations: b.alerts_migrations, ai_enabled: b.ai_enabled,
  min_marketcap: b.min_marketcap, created_at: b.created_at,
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    if (!jwt) return json({ error: "Unauthorized" }, 401);

    // Identify the caller from their JWT.
    const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    if (action === "status") {
      const { data } = await admin.from("telegram_bots").select("*").eq("user_id", user.id).maybeSingle();
      return json({ bot: safe(data) });
    }

    if (action === "settings") {
      const patch: any = { updated_at: new Date().toISOString() };
      if (typeof body.alerts_migrations === "boolean") patch.alerts_migrations = body.alerts_migrations;
      if (typeof body.ai_enabled === "boolean") patch.ai_enabled = body.ai_enabled;
      if (body.min_marketcap != null) patch.min_marketcap = Number(body.min_marketcap) || 0;
      const { data, error } = await admin.from("telegram_bots").update(patch).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ bot: safe(data) });
    }

    if (action === "disconnect") {
      const { data: existing } = await admin.from("telegram_bots").select("*").eq("user_id", user.id).maybeSingle();
      if (existing?.bot_token) {
        await fetch(`https://api.telegram.org/bot${existing.bot_token}/deleteWebhook`).catch(() => {});
      }
      await admin.from("telegram_bots").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    if (action === "connect") {
      const botToken = String(body.botToken || "").trim();
      if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(botToken)) return json({ error: "That doesn't look like a valid bot token. Get one from @BotFather." }, 400);

      // Validate the token.
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const me = await meRes.json();
      if (!me.ok) return json({ error: "Telegram rejected that token. Double-check it with @BotFather." }, 400);

      const webhookSecret = crypto.randomUUID().replace(/-/g, "");
      const row = {
        user_id: user.id,
        bot_id: me.result.id,
        bot_username: me.result.username,
        bot_token: botToken,
        webhook_secret: webhookSecret,
        updated_at: new Date().toISOString(),
      };
      // One bot per user: upsert on user_id.
      const { data: existing } = await admin.from("telegram_bots").select("id").eq("user_id", user.id).maybeSingle();
      let saved: any;
      if (existing) {
        const { data, error } = await admin.from("telegram_bots").update(row).eq("user_id", user.id).select().single();
        if (error) return json({ error: error.message }, 400);
        saved = data;
      } else {
        const { data, error } = await admin.from("telegram_bots").insert(row).select().single();
        if (error) return json({ error: error.message }, 400);
        saved = data;
      }

      // Point the bot's webhook at our handler, secured by the per-bot secret.
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook?bot=${saved.id}`;
      const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: webhookSecret,
          allowed_updates: ["message", "my_chat_member", "channel_post"],
          drop_pending_updates: true,
        }),
      });
      const setJson = await setRes.json();
      if (!setJson.ok) return json({ error: "Connected, but failed to set webhook: " + (setJson.description || "unknown") }, 400);

      // Register the command menu so /chat, /migrations, etc. show in Telegram's UI.
      await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commands: [
            { command: "chat", description: "Chat with Grim (AI analyst)" },
            { command: "migrations", description: "Pump.fun graduations (last 24h)" },
            { command: "alerts", description: "Migration alerts: on | off" },
            { command: "help", description: "Show commands" },
          ],
        }),
      }).catch(() => {});

      return json({ ok: true, bot: safe(saved) });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
