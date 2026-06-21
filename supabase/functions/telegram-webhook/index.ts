// telegram-webhook — receives updates for ALL user-connected bots (multi-tenant).
// Routed by ?bot=<uuid>; authenticated by per-bot secret_token header.
// Commands: /start /help /chat /migrations /alerts on|off. Any other text -> Grim AI
// (reuses our enhanced-intelligence fn = same NVIDIA models + our live APIs).
// No JWT (Telegram calls it). Deploy with --no-verify-jwt.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

const ok = () => new Response("ok", { status: 200 });

async function tg(botToken: string, method: string, body: object) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    return await r.json();
  } catch (e) { console.error("tg err", method, e); return null; }
}

function escHtml(s: string) {
  return (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Telegram caps messages at 4096 chars — chunk on paragraph/line boundaries.
async function sendLong(botToken: string, chatId: number, text: string, extra: object = {}) {
  const MAX = 3800;
  if (text.length <= MAX) return tg(botToken, "sendMessage", { chat_id: chatId, text, disable_web_page_preview: true, ...extra });
  const parts: string[] = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + "\n" + line).length > MAX) { parts.push(buf); buf = line; }
    else buf = buf ? buf + "\n" + line : line;
  }
  if (buf) parts.push(buf);
  for (const p of parts) await tg(botToken, "sendMessage", { chat_id: chatId, text: p, disable_web_page_preview: true, ...extra });
}

function fmtUsd(n: any) {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return "?";
  if (v >= 1e9) return "$" + (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return "$" + (v / 1e3).toFixed(1) + "K";
  return "$" + v.toFixed(2);
}
function ago(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return m + "m";
  const h = Math.floor(m / 60); if (h < 24) return h + "h";
  return Math.floor(h / 24) + "d";
}

async function getMigrations(hours = 24, limit = 15) {
  const r = await fetch(`${SUPABASE_URL}/functions/v1/pumpfun-migrations`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
    body: JSON.stringify({ hours, limit }),
  });
  const j = await r.json();
  return j.migrations || [];
}

function migrationsText(migs: any[], hours: number) {
  if (!migs.length) return `No pump.fun migrations found in the last ${hours}h.`;
  const lines = migs.map((m, i) => {
    const sym = escHtml(m.symbol || m.mint.slice(0, 6));
    const mc = fmtUsd(m.marketCap);
    const liq = fmtUsd(m.liquidityUsd);
    const url = m.dexUrl || `https://dexscreener.com/solana/${m.mint}`;
    return `${i + 1}. <b>${sym}</b> · MC ${mc} · Liq ${liq} · ${ago(m.migratedAt)} ago\n<a href="${url}">chart</a> · <code>${m.mint}</code>`;
  });
  return `🚀 <b>Pump.fun migrations · last ${hours}h</b> (${migs.length})\n\n` + lines.join("\n\n");
}

// Retrieve the bot owner's uploaded training knowledge most relevant to the
// query (Postgres full-text search) so Grim can use it as extra context.
async function retrieveKnowledge(botRowId: string, query: string): Promise<string> {
  try {
    const { data } = await admin
      .from("bot_knowledge")
      .select("filename, content")
      .eq("bot_id", botRowId)
      .textSearch("tsv", query, { type: "plain", config: "english" })
      .limit(5);
    if (!data || !data.length) return "";
    return data.map((r: any) => `[${r.filename}] ${r.content}`).join("\n---\n").slice(0, 6000);
  } catch { return ""; }
}

async function askGrim(text: string, knowledge = "") {
  try {
    const context = "Source: Telegram bot" + (knowledge
      ? `\n\nThe bot owner trained you with these reference docs — use them when relevant, and prefer them over generic knowledge:\n${knowledge}`
      : "");
    const r = await fetch(`${SUPABASE_URL}/functions/v1/enhanced-intelligence`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE}`, apikey: SERVICE_ROLE },
      body: JSON.stringify({ messages: [{ role: "user", content: text }], context }),
    });
    const j = await r.json();
    return j.content || j.error || "Couldn't read the chain right now, try again.";
  } catch (e) {
    return "Grim's RPC hiccuped. Try again in a sec.";
  }
}

async function registerChat(botRowId: string, chatId: number, title: string | null) {
  await admin.from("telegram_alert_chats").upsert(
    { bot_id: botRowId, chat_id: chatId, chat_title: title, enabled: true },
    { onConflict: "bot_id,chat_id" },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return ok();
  try {
    const url = new URL(req.url);
    const botRowId = url.searchParams.get("bot");
    if (!botRowId) return ok();

    const { data: bot } = await admin.from("telegram_bots").select("*").eq("id", botRowId).maybeSingle();
    if (!bot) return ok();

    const secret = req.headers.get("X-Telegram-Bot-Api-Secret-Token");
    if (secret !== bot.webhook_secret) return new Response("forbidden", { status: 403 });

    const update = await req.json().catch(() => ({}));
    const token = bot.bot_token;

    // Bot added to a group/channel -> auto-subscribe that chat to alerts.
    if (update.my_chat_member) {
      const chat = update.my_chat_member.chat;
      const status = update.my_chat_member.new_chat_member?.status;
      if (chat && ["member", "administrator", "creator"].includes(status)) {
        await registerChat(bot.id, chat.id, chat.title || chat.username || null);
        if (bot.alerts_migrations) await tg(token, "sendMessage", { chat_id: chat.id, text: "✅ Connected. This chat will get pump.fun migration alerts. Send /migrations for the last 24h or just chat to ask Grim anything." });
      }
      return ok();
    }

    const msg = update.message || update.channel_post;
    if (!msg) return ok();
    const chatId = msg.chat.id;
    const text = (msg.text || "").trim();
    if (!text) return ok();

    const cmd = text.toLowerCase().split(/\s+/)[0].replace(/@.*$/, "");

    // Group awareness: in groups, only engage when the bot is actually
    // addressed (@mention or a reply to one of its messages). In DMs, always.
    const chatType = msg.chat?.type || "private";
    const isGroup = chatType === "group" || chatType === "supergroup";
    const botUser = (bot.bot_username || "").toLowerCase();
    const mentionRe = botUser ? new RegExp(`(^|[^a-z0-9_])@${botUser}([^a-z0-9_]|$)`, "i") : null;
    const isMentioned = !!(mentionRe && mentionRe.test(text));
    const isReplyToBot = !!(msg.reply_to_message && msg.reply_to_message.from && msg.reply_to_message.from.id === bot.bot_id);
    const addressed = isMentioned || isReplyToBot;
    // Strip the bot's @handle so Grim gets a clean prompt.
    const cleanText = (botUser ? text.replace(new RegExp(`@${botUser}`, "ig"), " ") : text).replace(/\s+/g, " ").trim();

    if (cmd === "/start" || cmd === "/help") {
      await registerChat(bot.id, chatId, msg.chat.title || msg.chat.username || null);
      await tg(token, "sendMessage", {
        chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true,
        text:
          `💀 <b>Grim is online.</b>\n\nI read the Solana chain and rip tokens apart — no hopium.\n\n` +
          `<b>Commands</b>\n` +
          `/chat — ask Grim anything (works in groups too)\n` +
          `/migrations — pump.fun graduations (last 24h)\n` +
          `/alerts on|off — instant migration alerts in this chat\n` +
          `/help — this menu\n\n` +
          `Or just send me a contract address, a wallet, or a ticker and I'll analyze it live.\n\n` +
          `<b>In groups:</b> tag me <b>@${bot.bot_username}</b> (or reply to my messages) to chat. To let me read every message, open @BotFather → /setprivacy → Disable.`,
      });
      return ok();
    }

    if (cmd === "/migrations" || cmd === "/migrated" || cmd === "/graduations") {
      await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });
      const migs = await getMigrations(24, 15);
      await sendLong(token, chatId, migrationsText(migs, 24), { parse_mode: "HTML" });
      return ok();
    }

    if (cmd === "/alerts") {
      const arg = text.split(/\s+/)[1]?.toLowerCase();
      if (arg === "off") {
        await admin.from("telegram_alert_chats").update({ enabled: false }).eq("bot_id", bot.id).eq("chat_id", chatId);
        await tg(token, "sendMessage", { chat_id: chatId, text: "🔕 Migration alerts OFF for this chat." });
      } else {
        await registerChat(bot.id, chatId, msg.chat.title || null);
        await tg(token, "sendMessage", { chat_id: chatId, text: "🔔 Migration alerts ON. You'll get every pump.fun graduation here instantly." });
      }
      return ok();
    }

    // Explicit chat command — talk to Grim directly. Works everywhere (DMs and
    // groups) WITHOUT needing an @mention, so it's reliable even when Telegram
    // privacy mode hides group messages. Aliases: /ask /grim /c.
    if (cmd === "/chat" || cmd === "/ask" || cmd === "/grim" || cmd === "/c") {
      if (!bot.ai_enabled) {
        await tg(token, "sendMessage", { chat_id: chatId, text: "AI chat is off for this bot. The owner can enable it in OG Scan settings." });
        return ok();
      }
      // Prompt = text after the command, or the message being replied to.
      const afterCmd = text.replace(/^\S+\s*/, "").trim();
      const repliedText = msg.reply_to_message?.text || msg.reply_to_message?.caption || "";
      const prompt = (afterCmd || repliedText).trim();
      if (!prompt) {
        await tg(token, "sendMessage", { chat_id: chatId, text: "\uD83D\uDC80 Ask me something, e.g. /chat is SOL gonna pump? — or reply to any message with /chat." });
        return ok();
      }
      await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });
      const knowledge = await retrieveKnowledge(bot.id, prompt);
      const answer = await askGrim(prompt, knowledge);
      await sendLong(token, chatId, answer, isGroup ? { reply_to_message_id: msg.message_id } : {});
      return ok();
    }

    // Anything else -> Grim AI (same models + APIs as the in-app chat).
    if (bot.ai_enabled) {
      // In groups, only reply when tagged or replied-to — never spam the chat.
      if (isGroup && !addressed) return ok();
      const prompt = cleanText || "gm";
      await tg(token, "sendChatAction", { chat_id: chatId, action: "typing" });
      const knowledge = await retrieveKnowledge(bot.id, prompt);
      const answer = await askGrim(prompt, knowledge);
      // Reply in-thread in groups so the conversation is easy to follow.
      await sendLong(token, chatId, answer, isGroup ? { reply_to_message_id: msg.message_id } : {});
    }
    return ok();
  } catch (e) {
    console.error("webhook error", e);
    return ok(); // always 200 so Telegram doesn't retry-storm
  }
});
