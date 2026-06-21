// discord-bot-connect — Bring-your-own Discord bot (full slash-command bot,
// not the alerts-only webhook integration). JWT-gated CRUD over discord_bots.
//
// The user creates a Discord application (developer portal), then pastes:
//   - application_id  (Application ID)
//   - public_key      (used by discord-interactions to verify request sigs)
//   - bot_token       (Bot token, used here to register slash commands)
//
// On connect we validate the token (GET /users/@me as the bot), register the
// global slash commands, and store the credentials. discord-interactions then
// serves commands multi-tenant by looking up the bot via application_id.
//
// POST actions (Authorization: Bearer <user JWT>):
//   { action: "connect", application_id, public_key, bot_token }
//   { action: "status" }
//   { action: "settings", ai_enabled?, enabled? }
//   { action: "disconnect" }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const DISCORD_API = "https://discord.com/api/v10";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (o: unknown, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

// What the public (UI) is allowed to see — never leak the bot token.
const safe = (d: any) =>
  d && {
    id: d.id,
    application_id: d.application_id,
    bot_username: d.bot_username,
    ai_enabled: d.ai_enabled,
    enabled: d.enabled,
    created_at: d.created_at,
    token_hint: d.bot_token ? `••••${String(d.bot_token).slice(-4)}` : null,
  };

// Slash commands the BYO bot exposes (mirrors discord-interactions handlers).
const COMMANDS = [
  {
    name: "chat",
    description: "Ask Grim anything about a token, wallet or the market",
    options: [
      { name: "message", description: "Your question or a contract address", type: 3, required: true },
    ],
  },
  { name: "migrations", description: "Latest pump.fun migrations (last 24h)" },
  { name: "news", description: "Latest crypto news" },
  { name: "alpha", description: "Latest alpha callouts" },
  { name: "subscribe", description: "Get pump.fun migration alerts in this channel" },
  { name: "unsubscribe", description: "Stop migration alerts in this channel" },
];

async function registerCommands(appId: string, botToken: string) {
  const r = await fetch(`${DISCORD_API}/applications/${appId}/commands`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bot ${botToken}` },
    body: JSON.stringify(COMMANDS),
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`Discord command registration failed (${r.status}): ${t.slice(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const { data: { user } } = await createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    }).auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    if (action === "status") {
      const { data } = await admin.from("discord_bots").select("*").eq("user_id", user.id).maybeSingle();
      return json({ bot: safe(data) });
    }

    if (action === "connect") {
      const application_id = String(body.application_id || "").trim();
      const public_key = String(body.public_key || "").trim();
      const bot_token = String(body.bot_token || "").trim();
      if (!application_id || !public_key || !bot_token) {
        return json({ error: "application_id, public_key and bot_token are all required" }, 400);
      }
      if (!/^\d{15,25}$/.test(application_id)) return json({ error: "application_id looks invalid (should be a numeric snowflake)" }, 400);
      if (!/^[0-9a-f]{64}$/i.test(public_key)) return json({ error: "public_key looks invalid (should be 64 hex chars)" }, 400);

      // Validate the bot token by fetching the bot user.
      const me = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bot ${bot_token}` } });
      if (!me.ok) return json({ error: "Bot token rejected by Discord. Double-check the token." }, 400);
      const meJson = await me.json();
      const bot_username = meJson.username ? `${meJson.username}` : null;
      if (meJson.id && meJson.id !== application_id) {
        // Bot user id should equal the application id for a bot account.
        return json({ error: "Bot token does not match this application_id." }, 400);
      }

      // Register the slash commands on the user's application.
      try {
        await registerCommands(application_id, bot_token);
      } catch (e) {
        return json({ error: (e as Error).message }, 400);
      }

      const row = {
        user_id: user.id,
        application_id,
        public_key,
        bot_token,
        bot_username,
        enabled: true,
        updated_at: new Date().toISOString(),
      };
      const { data, error } = await admin
        .from("discord_bots")
        .upsert(row, { onConflict: "user_id" })
        .select()
        .maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({
        bot: safe(data),
        interactions_url: `${SUPABASE_URL}/functions/v1/discord-interactions`,
      });
    }

    if (action === "settings") {
      const patch: any = { updated_at: new Date().toISOString() };
      if (typeof body.ai_enabled === "boolean") patch.ai_enabled = body.ai_enabled;
      if (typeof body.enabled === "boolean") patch.enabled = body.enabled;
      const { data, error } = await admin.from("discord_bots").update(patch).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ bot: safe(data) });
    }

    if (action === "register") {
      const { data } = await admin.from("discord_bots").select("application_id, bot_token").eq("user_id", user.id).maybeSingle();
      if (!data) return json({ error: "Connect a bot first" }, 400);
      try { await registerCommands(data.application_id, data.bot_token); }
      catch (e) { return json({ error: (e as Error).message }, 400); }
      return json({ ok: true });
    }

    if (action === "disconnect") {
      await admin.from("discord_bots").delete().eq("user_id", user.id);
      return json({ ok: true });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
