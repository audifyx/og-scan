// telegram-connect — connect/manage a user's OWN Telegram bot (multi-tenant).
// User pastes their BotFather token; we validate it (getMe), set the webhook
// to telegram-webhook with a per-bot secret, and store it. Requires user JWT.
//
// POST actions:
//   { action: "connect", botToken }      -> validate + setWebhook + upsert
//   { action: "disconnect" }             -> deleteWebhook + remove row
//   { action: "status" }                 -> current bot info (no token leaked)
//   { action: "settings", alerts_migrations?, ai_enabled?, min_marketcap? }
//   { action: "set_identity", bot_name?, persona? }  -> name + persona (also set on Telegram)
//   { action: "commands_list" }
//   { action: "command_upsert", command, description?, response_type?, content }
//   { action: "command_delete", command }

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
  bot_name: b.bot_name, persona: b.persona,
  alerts_migrations: b.alerts_migrations, ai_enabled: b.ai_enabled,
  min_marketcap: b.min_marketcap, created_at: b.created_at,
});

// Commands the bot handles natively — users can't override these.
const RESERVED_COMMANDS = new Set([
  "start", "help", "chat", "ask", "grim", "c", "scan", "analyze",
  "news", "alpha", "calls", "callouts", "migrations", "migrated",
  "graduations", "alerts",
]);

function normalizeCommand(raw: string): string {
  return String(raw || "").trim().toLowerCase().replace(/^\//, "").replace(/[^a-z0-9_]/g, "");
}

// Refresh the Telegram command menu = built-ins + this bot's custom commands.
async function refreshCommandMenu(admin: any, botToken: string, botRowId: string) {
  const base = [
    { command: "chat", description: "Chat with the AI analyst" },
    { command: "scan", description: "Full token risk report" },
    { command: "report", description: "PDF intelligence report" },
    { command: "wallet", description: "Wallet portfolio snapshot" },
    { command: "pnl", description: "Wallet PnL (last 100 txns)" },
    { command: "holders", description: "Top holder distribution" },
    { command: "watch", description: "Watch a token for price moves" },
    { command: "watchlist", description: "Show your watchlist" },
    { command: "trending", description: "Top trending tokens (24h)" },
    { command: "news", description: "Latest crypto headlines" },
    { command: "alpha", description: "Community alpha callouts" },
    { command: "migrations", description: "Pump.fun graduations (last 24h)" },
    { command: "alerts", description: "Migration alerts: on | off" },
    { command: "help", description: "Show commands" },
  ];
  const { data: customs } = await admin
    .from("telegram_custom_commands")
    .select("command, description, enabled")
    .eq("bot_id", botRowId).eq("enabled", true).limit(50);
  const extra = (customs || []).map((c: any) => ({
    command: c.command,
    description: (c.description || "Custom command").slice(0, 256),
  }));
  // Telegram allows up to 100 commands; keep within bounds.
  const commands = [...base, ...extra].slice(0, 100);
  await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands }),
  }).catch(() => {});
}

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
            { command: "scan", description: "Full token risk report" },
            { command: "news", description: "Latest crypto headlines" },
            { command: "alpha", description: "Community alpha callouts" },
            { command: "migrations", description: "Pump.fun graduations (last 24h)" },
            { command: "alerts", description: "Migration alerts: on | off" },
            { command: "help", description: "Show commands" },
          ],
        }),
      }).catch(() => {});

      return json({ ok: true, bot: safe(saved) });
    }

    if (action === "set_identity") {
      const { data: existing } = await admin.from("telegram_bots").select("*").eq("user_id", user.id).maybeSingle();
      if (!existing) return json({ error: "Connect a bot first." }, 400);
      const patch: any = { updated_at: new Date().toISOString() };
      if (typeof body.bot_name === "string") patch.bot_name = body.bot_name.trim().slice(0, 64) || null;
      if (typeof body.persona === "string") patch.persona = body.persona.trim().slice(0, 2000) || null;
      const { data, error } = await admin.from("telegram_bots").update(patch).eq("user_id", user.id).select().single();
      if (error) return json({ error: error.message }, 400);
      // Make the name + description permanent on Telegram itself (best-effort).
      if (patch.bot_name) {
        await fetch(`https://api.telegram.org/bot${existing.bot_token}/setMyName`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: patch.bot_name.slice(0, 64) }),
        }).catch(() => {});
      }
      if (patch.persona) {
        const short = patch.persona.slice(0, 120);
        await fetch(`https://api.telegram.org/bot${existing.bot_token}/setMyShortDescription`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ short_description: short }),
        }).catch(() => {});
        await fetch(`https://api.telegram.org/bot${existing.bot_token}/setMyDescription`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: patch.persona.slice(0, 512) }),
        }).catch(() => {});
      }
      return json({ ok: true, bot: safe(data) });
    }

    if (action === "commands_list") {
      const { data: existing } = await admin.from("telegram_bots").select("id").eq("user_id", user.id).maybeSingle();
      if (!existing) return json({ commands: [] });
      const { data } = await admin.from("telegram_custom_commands")
        .select("id, command, description, response_type, content, enabled, updated_at")
        .eq("bot_id", existing.id).order("command", { ascending: true });
      return json({ commands: data || [] });
    }

    if (action === "command_upsert") {
      const { data: existing } = await admin.from("telegram_bots").select("id, bot_token").eq("user_id", user.id).maybeSingle();
      if (!existing) return json({ error: "Connect a bot first." }, 400);
      const command = normalizeCommand(body.command);
      if (!command) return json({ error: "Command must be letters, numbers or underscore." }, 400);
      if (RESERVED_COMMANDS.has(command)) return json({ error: `/${command} is a built-in command and can't be overridden.` }, 400);
      const response_type = body.response_type === "ai" ? "ai" : "text";
      const content = String(body.content || "").slice(0, 4000);
      if (!content.trim()) return json({ error: "Add a response (text or AI instruction)." }, 400);
      const row = {
        bot_id: existing.id, user_id: user.id, command,
        description: String(body.description || "").slice(0, 256) || null,
        response_type, content, enabled: body.enabled !== false,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin.from("telegram_custom_commands")
        .upsert(row, { onConflict: "bot_id,command" }).select().single();
      if (error) return json({ error: error.message }, 400);
      await refreshCommandMenu(admin, existing.bot_token, existing.id);
      return json({ ok: true, command: data });
    }

    if (action === "command_delete") {
      const { data: existing } = await admin.from("telegram_bots").select("id, bot_token").eq("user_id", user.id).maybeSingle();
      if (!existing) return json({ error: "Connect a bot first." }, 400);
      const command = normalizeCommand(body.command);
      await admin.from("telegram_custom_commands").delete().eq("bot_id", existing.id).eq("command", command);
      await refreshCommandMenu(admin, existing.bot_token, existing.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
