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
//   { action: "list_messages", chat_id? } -> recent bot messages
//   { action: "delete_message", chat_id, message_id } -> delete one message
//   { action: "bulk_delete", chat_id, message_ids[] } -> delete many messages
//   { action: "clear_all", chat_id? } -> delete every logged message (all chats, or one chat)
//   { action: "sweep_range", chat_id, from_id, to_id } -> delete a contiguous range of message IDs (the bot only removes its own)
//   { action: "list_chats" } -> chats the bot is in (for the picker)
//   { action: "auto_clean_chat", chat, depth? } -> resolve a chat (id / public link / picked), probe latest msg id, sweep & delete the bot's own recent messages

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { BOT_MODELS, resolveModel } from "../_shared/models.ts";

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
  ai_model: b.ai_model,
  auto_scan: b.auto_scan, digest_enabled: b.digest_enabled,
  min_marketcap: b.min_marketcap, created_at: b.created_at,
});

// Commands the bot handles natively — users can't override these.
const RESERVED_COMMANDS = new Set([
  "start", "help", "chat", "ask", "grim", "c", "scan", "analyze",
  "news", "alpha", "calls", "callouts", "migrations", "migrated",
  "graduations", "alerts", "digest",
  "vibecodeanything", "vibecode", "vibe", "vca",
  "price", "p", "btc", "eth", "sol", "global", "market", "fear", "fng", "feargreed", "tvl",
  "trending", "trend", "wallet", "portfolio", "pnl", "holders", "watch", "watchlist", "unwatch", "report", "pdf",
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
    { command: "vibecodeanything", description: "Build ANY custom HTML5 page from a prompt" },
    { command: "wallet", description: "Wallet portfolio snapshot" },
    { command: "pnl", description: "Wallet PnL (last 100 txns)" },
    { command: "holders", description: "Top holder distribution" },
    { command: "watch", description: "Watch a token for price moves" },
    { command: "watchlist", description: "Show your watchlist" },
    { command: "trending", description: "Top trending tokens (24h)" },
    { command: "price", description: "Price + stats for any coin" },
    { command: "btc", description: "Bitcoin price" },
    { command: "eth", description: "Ethereum price" },
    { command: "sol", description: "Solana price" },
    { command: "global", description: "Global market cap + dominance" },
    { command: "fear", description: "Crypto Fear & Greed index" },
    { command: "tvl", description: "DeFi TVL by chain" },
    { command: "news", description: "Latest crypto headlines" },
    { command: "alpha", description: "Community alpha callouts" },
    { command: "migrations", description: "Pump.fun graduations (last 24h)" },
    { command: "alerts", description: "Migration alerts: on | off" },
    { command: "digest", description: "Daily digest: on | off" },
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
      if (typeof body.auto_scan === "boolean") patch.auto_scan = body.auto_scan;
      if (typeof body.digest_enabled === "boolean") patch.digest_enabled = body.digest_enabled;
      if (typeof body.ai_model === "string") patch.ai_model = resolveModel(body.ai_model);
      const { data, error } = await admin.from("telegram_bots").update(patch).eq("user_id", user.id).select().maybeSingle();
      if (error) return json({ error: error.message }, 400);
      return json({ bot: safe(data) });
    }

    if (action === "models") {
      return json({ models: BOT_MODELS });
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

      // Register the full command menu so every command is pre-installed.
      await refreshCommandMenu(admin, botToken, saved.id);

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

    // ── Message management ────────────────────────────────────────────────────

    if (action === "list_messages") {
      const { data: botRow } = await admin.from("telegram_bots").select("id").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ messages: [] });
      let q = (admin.from("telegram_bot_messages") as any)
        .select("id, chat_id, chat_title, message_id, text_preview, sent_at")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("sent_at", { ascending: false })
        .limit(60);
      if (body.chat_id) q = q.eq("chat_id", String(body.chat_id));
      const { data } = await q;
      return json({ messages: data || [] });
    }

    if (action === "delete_message") {
      const { data: botRow } = await admin.from("telegram_bots").select("bot_token").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ error: "No bot connected." }, 400);
      const { chat_id, message_id } = body;
      if (!chat_id || !message_id) return json({ error: "chat_id and message_id are required." }, 400);
      const tg = await fetch(`https://api.telegram.org/bot${botRow.bot_token}/deleteMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id, message_id: Number(message_id) }),
      }).then(r => r.json());
      await admin.from("telegram_bot_messages")
        .update({ deleted_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("chat_id", String(chat_id))
        .eq("message_id", String(message_id))
        .catch(() => {});
      if (!tg.ok) return json({ error: tg.description || "Telegram refused to delete." }, 400);
      return json({ ok: true });
    }

    if (action === "bulk_delete") {
      const { data: botRow } = await admin.from("telegram_bots").select("bot_token").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ error: "No bot connected." }, 400);
      const { chat_id, message_ids } = body;
      if (!chat_id || !Array.isArray(message_ids) || !message_ids.length)
        return json({ error: "chat_id and message_ids[] are required." }, 400);
      const results = await Promise.allSettled(
        message_ids.map((mid: number) =>
          fetch(`https://api.telegram.org/bot${botRow.bot_token}/deleteMessage`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id, message_id: Number(mid) }),
          }).then(r => r.json())
        )
      );
      const deleted: number[] = [], failed: number[] = [];
      results.forEach((r, i) => {
        if (r.status === "fulfilled" && (r.value as any).ok) deleted.push(message_ids[i]);
        else failed.push(message_ids[i]);
      });
      if (deleted.length) {
        await admin.from("telegram_bot_messages")
          .update({ deleted_at: new Date().toISOString() })
          .eq("user_id", user.id)
          .eq("chat_id", String(chat_id))
          .in("message_id", deleted.map(String))
          .catch(() => {});
      }
      return json({ ok: true, deleted, failed });
    }

    if (action === "clear_all") {
      const { data: botRow } = await admin.from("telegram_bots").select("bot_token").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ error: "No bot connected." }, 400);
      const scopeChat = body.chat_id != null ? String(body.chat_id) : null;

      // Pull every still-live (not-yet-deleted) logged message for this user.
      let q = (admin.from("telegram_bot_messages") as any)
        .select("id, chat_id, message_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("sent_at", { ascending: false })
        .limit(2000);
      if (scopeChat) q = q.eq("chat_id", scopeChat);
      const { data: rows } = await q;
      const msgs = (rows || []) as { id: string; chat_id: string; message_id: string | number }[];
      if (!msgs.length) return json({ ok: true, deleted: 0, failed: 0 });

      // Delete from Telegram in small concurrent batches to respect rate limits.
      const deletedIds: string[] = [];
      let failed = 0;
      const BATCH = 20;
      for (let i = 0; i < msgs.length; i += BATCH) {
        const batch = msgs.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((mm) =>
            fetch(`https://api.telegram.org/bot${botRow.bot_token}/deleteMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: mm.chat_id, message_id: Number(mm.message_id) }),
            }).then((r) => r.json())
          )
        );
        results.forEach((r, idx) => {
          const v: any = r.status === "fulfilled" ? r.value : null;
          // Treat "message can't be deleted / already gone" as success so the log clears.
          if (v?.ok || /message to delete not found|message can't be deleted/i.test(v?.description || "")) {
            deletedIds.push(batch[idx].id);
          } else {
            failed++;
          }
        });
      }

      if (deletedIds.length) {
        // Mark cleared rows deleted in chunks (avoid oversized IN clauses).
        for (let i = 0; i < deletedIds.length; i += 200) {
          await admin.from("telegram_bot_messages")
            .update({ deleted_at: new Date().toISOString() })
            .in("id", deletedIds.slice(i, i + 200))
            .catch(() => {});
        }
      }
      return json({ ok: true, deleted: deletedIds.length, failed, scope: scopeChat || "all" });
    }

    if (action === "sweep_range") {
      const { data: botRow } = await admin.from("telegram_bots").select("id, user_id, bot_token").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ error: "No bot connected." }, 400);
      const chat_id = body.chat_id != null ? String(body.chat_id) : "";
      let from = Math.floor(Number(body.from_id));
      let to = Math.floor(Number(body.to_id));
      if (!chat_id || !Number.isFinite(from) || !Number.isFinite(to) || from <= 0 || to <= 0)
        return json({ error: "chat_id, from_id and to_id are required." }, 400);
      if (from > to) { const t = from; from = to; to = t; }
      const MAX_SPAN = 2000;
      if (to - from + 1 > MAX_SPAN) return json({ error: `Range too large — max ${MAX_SPAN} message IDs at a time.` }, 400);

      const ids: number[] = [];
      for (let i = from; i <= to; i++) ids.push(i);

      // Try to delete each ID. Telegram silently fails for IDs the bot didn't send
      // (or that don't exist), so only the bot's own messages actually get removed.
      const deleted: number[] = [];
      let failed = 0;
      const BATCH = 20;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((mid) =>
            fetch(`https://api.telegram.org/bot${botRow.bot_token}/deleteMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id, message_id: mid }),
            }).then((r) => r.json())
          )
        );
        results.forEach((r, idx) => {
          const v: any = r.status === "fulfilled" ? r.value : null;
          if (v?.ok) deleted.push(batch[idx]);
          else failed++;
        });
      }

      // Reflect any deletions in the logged table too.
      if (deleted.length) {
        for (let i = 0; i < deleted.length; i += 200) {
          await admin.from("telegram_bot_messages")
            .update({ deleted_at: new Date().toISOString() })
            .eq("user_id", botRow.user_id)
            .eq("chat_id", chat_id)
            .in("message_id", deleted.slice(i, i + 200).map(String))
            .catch(() => {});
        }
      }
      return json({ ok: true, deleted: deleted.length, scanned: ids.length, removedIds: deleted });
    }

    if (action === "list_chats") {
      const { data: botRow } = await admin.from("telegram_bots").select("id").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ chats: [] });
      const { data } = await admin.from("telegram_alert_chats")
        .select("chat_id, chat_title")
        .eq("bot_id", botRow.id)
        .order("chat_title", { ascending: true });
      const chats = (data || []).map((c: any) => ({ chat_id: String(c.chat_id), chat_title: c.chat_title || String(c.chat_id) }));
      return json({ chats });
    }

    if (action === "auto_clean_chat") {
      const { data: botRow } = await admin.from("telegram_bots").select("id, user_id, bot_token").eq("user_id", user.id).maybeSingle();
      if (!botRow) return json({ error: "No bot connected." }, 400);

      const raw = String(body.chat || "").trim();
      if (!raw) return json({ error: "Pick a chat or paste a public link / chat ID." }, 400);
      let depth = Math.floor(Number(body.depth) || 1000);
      if (!Number.isFinite(depth) || depth <= 0) depth = 1000;
      depth = Math.min(depth, 3000);

      // ── Resolve chat_id from a numeric id, a public t.me/<username>, or @username ──
      let chatId: string | null = null;
      if (/^-?\d+$/.test(raw)) {
        chatId = raw;
      } else if (/\/\+|joinchat/i.test(raw)) {
        return json({ error: "Private invite links can't be resolved by Telegram's bot API. Pick the group from the dropdown instead — your bot already knows the chats it's in." }, 400);
      } else {
        const m = raw.match(/(?:https?:\/\/)?t\.me\/([^/?\s]+)/i) || raw.match(/^@?([A-Za-z0-9_]{4,})$/);
        const handle = m ? m[1].replace(/^@/, "") : "";
        if (handle) {
          const gc = await fetch(`https://api.telegram.org/bot${botRow.bot_token}/getChat`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: `@${handle}` }),
          }).then((r) => r.json());
          if (gc?.ok && gc.result?.id) chatId = String(gc.result.id);
          else return json({ error: "Couldn't resolve that link (private or not found). Pick the group from the dropdown, or paste a numeric chat ID." }, 400);
        }
      }
      if (!chatId) return json({ error: "Couldn't parse that chat. Use the dropdown or a numeric chat ID." }, 400);

      // ── Probe the latest message id by sending then deleting a tiny message ──
      const probe = await fetch(`https://api.telegram.org/bot${botRow.bot_token}/sendMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: "\uD83E\uDDF9", disable_notification: true }),
      }).then((r) => r.json());
      if (!probe?.ok || !probe.result?.message_id) {
        return json({ error: probe?.description || "The bot can't post in that chat (is it still a member?)." }, 400);
      }
      const latest: number = probe.result.message_id;
      const chatTitle = probe.result.chat?.title || null;
      await fetch(`https://api.telegram.org/bot${botRow.bot_token}/deleteMessage`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, message_id: latest }),
      }).catch(() => {});

      // ── Sweep from newest down; Telegram only lets us delete the bot's OWN messages ──
      const from = Math.max(1, latest - depth);
      const ids: number[] = [];
      for (let i = latest - 1; i >= from; i--) ids.push(i);

      const deleted: number[] = [];
      let rateLimited = false;
      const BATCH = 15;
      for (let i = 0; i < ids.length; i += BATCH) {
        const batch = ids.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map((mid) =>
            fetch(`https://api.telegram.org/bot${botRow.bot_token}/deleteMessage`, {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ chat_id: chatId, message_id: mid }),
            }).then((r) => r.json())
          )
        );
        let batch429 = 0;
        results.forEach((r, idx) => {
          const v: any = r.status === "fulfilled" ? r.value : null;
          if (v?.ok) deleted.push(batch[idx]);
          else if (v?.error_code === 429) batch429++;
        });
        if (batch429 >= BATCH) { rateLimited = true; break; } // hard throttle — stop, let them re-run
      }

      // Reflect in the logged table.
      if (deleted.length) {
        for (let i = 0; i < deleted.length; i += 200) {
          await admin.from("telegram_bot_messages").update({ deleted_at: new Date().toISOString() })
            .eq("user_id", botRow.user_id).eq("chat_id", chatId)
            .in("message_id", deleted.slice(i, i + 200).map(String)).catch(() => {});
        }
      }
      return json({ ok: true, chat_id: chatId, chat_title: chatTitle, deleted: deleted.length, scanned: ids.length, rateLimited });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
