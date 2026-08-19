/**
 * Official OrbitX Telegram bot + web companion.
 *
 * POST  Telegram webhook (secret header)
 * POST  { action: "web.*" } with Supabase JWT for /telegram
 * GET   ?action=health | configure
 *
 * Token: TELEGRAM_ORBITX_BOT_TOKEN (Vercel env — never commit).
 */
export const config = { maxDuration: 120 };

import { randomUUID } from "crypto";
import {
  GROUP_COMMANDS,
  OFFICIAL_BOT_ABOUT,
  OFFICIAL_BOT_NAME,
  OFFICIAL_BOT_SHORT,
  OFFICIAL_BOT_USERNAME,
  PRIVATE_COMMANDS,
  argsFromCommand,
  cmdsPage,
  collectMediaUrls,
  formatMcpResultForTelegram,
  inferPublicTool,
  isPrivilegedTelegramTool,
  isPublicTelegramTool,
  loginCode,
  parseCallInvocation,
  resolveOfficialCommand,
} from "./orbitx/telegram-orbitx-lib.js";
import {
  DEFAULT_TELEGRAM_NIM_MODEL,
  ORBITX_TELEGRAM_BLURB,
} from "./orbitx/orbitx-telegram-knowledge.js";
import { nvidiaChat, postTweetOAuth2 } from "./orbitx/x-agent-lib.js";
import { memoryRateLimit } from "./orbitx/ai-runtime.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const FALLBACK = "https://www.orbitx.world";
const BOT_TOKEN = process.env.TELEGRAM_ORBITX_BOT_TOKEN || "";
const WEBHOOK_SECRET =
  process.env.TELEGRAM_ORBITX_WEBHOOK_SECRET ||
  (BOT_TOKEN ? BOT_TOKEN.slice(-24).replace(/[^a-zA-Z0-9]/g, "x") : "");

function json(res, body, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function ok(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("ok");
}

function header(req, name) {
  const h = req.headers || {};
  return h[name.toLowerCase()] || h[name] || "";
}

function officialOrigin() {
  const env = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (env) return String(env).replace(/\/$/, "").replace("://orbitx.world", "://www.orbitx.world");
  return FALLBACK;
}

function publicBase(req) {
  return officialOrigin();
}

async function readBody(req) {
  try {
    if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
    if (typeof req.body === "string") return JSON.parse(req.body || "{}");
    const chunks = [];
    for await (const c of req) chunks.push(typeof c === "string" ? Buffer.from(c) : c);
    const raw = Buffer.concat(chunks).toString("utf8");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function sb(path, init = {}) {
  if (!SUPA_URL || !SRK) throw new Error("supabase_not_configured");
  const r = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SRK,
      Authorization: `Bearer ${SRK}`,
      "Content-Type": "application/json",
      Prefer: init.headers?.Prefer || "return=representation",
      ...(init.headers || {}),
    },
  });
  if (!r.ok) {
    const t = await r.text().catch(() => "");
    throw new Error(`supabase ${r.status}: ${t.slice(0, 220)}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

async function getJwtUser(req) {
  const auth = header(req, "authorization");
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email || null } : null;
}

async function tg(method, body, { form } = {}) {
  if (!BOT_TOKEN) return { ok: false, description: "TELEGRAM_ORBITX_BOT_TOKEN missing" };
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: form ? undefined : { "Content-Type": "application/json" },
    body: form || JSON.stringify(body),
  });
  return r.json().catch(() => ({ ok: false }));
}

async function sendLong(chatId, text, extra = {}) {
  const MAX = 3800;
  const str = String(text || "");
  if (str.length <= MAX) {
    return tg("sendMessage", { chat_id: chatId, text: str, disable_web_page_preview: true, ...extra });
  }
  let buf = "";
  for (const line of str.split("\n")) {
    if ((buf + "\n" + line).length > MAX) {
      await tg("sendMessage", { chat_id: chatId, text: buf, disable_web_page_preview: true, ...extra });
      buf = line;
    } else buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) await tg("sendMessage", { chat_id: chatId, text: buf, disable_web_page_preview: true, ...extra });
}

async function sendMedia(chatId, urls) {
  for (const media of urls || []) {
    const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(media) || /video/i.test(media);
    if (isVid) await tg("sendVideo", { chat_id: chatId, video: media });
    else await tg("sendPhoto", { chat_id: chatId, photo: media });
  }
}

async function loadLink(telegramUserId) {
  const id = String(telegramUserId || "").trim();
  if (!id) return null;
  try {
    const rows = await sb(
      `telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(id)}&select=telegram_user_id,user_id,telegram_username,wallet_address&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch {
    return null;
  }
}

async function loadWallet(userId) {
  const rows = await sb(
    `wallet_identities?user_id=eq.${encodeURIComponent(userId)}&select=wallet&order=created_at.asc&limit=1`,
  );
  return Array.isArray(rows) ? rows[0]?.wallet || null : null;
}

async function runTool({ tool, args, req, link, allowPrivileged }) {
  const hub = await import("./orbitx-hub.js");
  const name = String(tool || "").trim();
  if (!name) return { ok: false, error: "tool_required" };
  if (!hub.hasEmbeddedAgentTool(name) && name !== "x_post") {
    return { ok: false, error: `Unknown OrbitX tool: ${name}` };
  }
  const privileged = isPrivilegedTelegramTool(name) || name === "x_post";
  if (privileged && !allowPrivileged) {
    return {
      ok: false,
      error: "login_required",
      message: "This action needs a linked OrbitX account. Message @theorbitxmcpbot privately and tap /login.",
    };
  }
  if (privileged && !link?.user_id) {
    return {
      ok: false,
      error: "login_required",
      message: "Link your OrbitX wallet first: /login",
    };
  }
  if (name === "x_post") {
    return postLinkedX(link.user_id, args);
  }
  if (privileged) {
    const emailRows = await sb(
      `wallet_identities?user_id=eq.${encodeURIComponent(link.user_id)}&select=wallet&limit=1`,
    ).catch(() => []);
    return hub.runEmbeddedAgentTool({
      userId: link.user_id,
      walletAddress: link.wallet_address || emailRows?.[0]?.wallet || null,
      toolName: name,
      args,
      req,
    });
  }
  return hub.runPublicOrbitXTool({ toolName: name, args, req });
}

async function postLinkedX(userId, args) {
  const text = String(args.text || args.prompt || args.q || "").trim();
  if (!text) return { ok: false, error: "text_required", message: "Usage: /tweet your post" };
  let profile;
  try {
    const rows = await sb(
      `profiles?user_id=eq.${encodeURIComponent(userId)}&select=twitter_access_token,twitter_username,twitter_oauth_scopes&limit=1`,
    );
    profile = Array.isArray(rows) ? rows[0] : null;
  } catch {
    profile = null;
  }
  if (!profile?.twitter_access_token) {
    return {
      ok: false,
      error: "x_not_connected",
      message: "Connect X at https://www.orbitx.world/x then retry /tweet.",
    };
  }
  const posted = await postTweetOAuth2(profile.twitter_access_token, { text: text.slice(0, 280) });
  if (!posted?.ok) {
    return {
      ok: false,
      error: posted?.error || "x_post_failed",
      message: posted?.message || "X rejected the post. Reconnect at /x.",
    };
  }
  return {
    ok: true,
    message: `Posted as @${profile.twitter_username || "account"}`,
    tweetId: posted.tweetId || posted.id || null,
  };
}

function helpText(isPrivate, linked) {
  return [
    `<b>OrbitX</b> · @${OFFICIAL_BOT_USERNAME}`,
    ORBITX_TELEGRAM_BLURB.replace("no trading in Telegram.", isPrivate && linked ? "linked account · trade & X unlocked." : "groups are public · DMs unlock trade & X."),
    "",
    "<b>Groups (no login)</b>",
    "/token mint · /chart ca · /img prompt · /vid prompt · /cmds",
    "Or just paste a CA, or say “generate an image of …”",
    "",
    "<b>Private</b>",
    linked
      ? "Account linked. /me · /buy · /sell · /tweet · /post · /launch · /call tool"
      : "/login to bind this Telegram to your OrbitX wallet.",
    "",
    "Groups: privacy mode is on — use a slash command or mention @theorbitxmcpbot.",
    "Web: https://www.orbitx.world/telegram",
    "Full catalog (~5000 live tools): /cmds or /call name args",
  ].join("\n");
}

async function handleCmds(text, tools) {
  const rest = String(text || "").replace(/^\/cmds(@\w+)?\s*/i, "").trim();
  const pageMatch = rest.match(/^(\d+)$/);
  const page = pageMatch ? Number(pageMatch[1]) : 1;
  const query = pageMatch ? "" : rest;
  return cmdsPage(tools, { page, query });
}

async function askAi(prompt, { linked }) {
  const system = `You are the official OrbitX Telegram bot (@${OFFICIAL_BOT_USERNAME}).
Groups are public: token intel, charts, Grok image/video. Private DMs can /login to trade, tweet, and use write tools.
Never ask for a seed phrase. Prefer a concrete /command the user can tap.
Reply in plain Telegram text. No markdown code fences.`;
  const nim = await nvidiaChat({
    system: linked ? `${system}\nThis user is linked to their OrbitX account.` : system,
    user: String(prompt || "gm").slice(0, 6000),
    model: process.env.TELEGRAM_NIM_MODEL || DEFAULT_TELEGRAM_NIM_MODEL,
    maxTokens: 700,
    temperature: 0.55,
  });
  if (nim.ok && nim.content) return String(nim.content).replace(/```[\s\S]*?```/g, "").trim().slice(0, 3900);
  return nim.message || "OrbitX AI is offline (NVIDIA_API_KEY). Slash commands still work: /token /chart /img /cmds.";
}

async function startLogin(telegramUser, base) {
  const code = loginCode();
  const expires = new Date(Date.now() + 15 * 60_000).toISOString();
  await sb("telegram_orbitx_login_codes", {
    method: "POST",
    body: JSON.stringify({
      code,
      telegram_user_id: String(telegramUser.id),
      telegram_username: telegramUser.username || null,
      expires_at: expires,
    }),
  });
  const url = `${base}/telegram?code=${encodeURIComponent(code)}`;
  return [
    "<b>Link OrbitX</b>",
    "1. Open the secure page (expires in 15 minutes)",
    url,
    "2. Sign in with the wallet you use on OrbitX",
    "3. Confirm. Then /buy /sell /tweet /post work in this DM.",
  ].join("\n");
}

async function handleTelegramUpdate(update, req) {
  const msg = update.message || update.edited_message || update.channel_post;
  if (!msg) return;
  const text = String(msg.text || msg.caption || "").trim();
  const chatId = msg.chat?.id;
  if (!chatId) return;
  const chatType = String(msg.chat?.type || "");
  const isGroup = chatType === "group" || chatType === "supergroup";
  const from = msg.from || {};
  const replyExtra = isGroup ? { reply_to_message_id: msg.message_id } : {};
  const link = from.id ? await loadLink(from.id) : null;
  const limit = memoryRateLimit(
    `tg-orbitx:${isGroup ? chatId : from.id || chatId}`,
    isGroup ? 40 : 60,
    60_000,
  );
  if (limit.limited) {
    await tg("sendMessage", { chat_id: chatId, text: "Slow down — too many OrbitX requests.", ...replyExtra });
    return;
  }

  const bare = text.toLowerCase().split(/\s+/)[0].replace(/@.*$/, "").replace(/^\//, "");
  const mentioned =
    new RegExp(`@${OFFICIAL_BOT_USERNAME}\\b`, "i").test(text) ||
    Boolean(msg.reply_to_message?.from?.username?.toLowerCase() === OFFICIAL_BOT_USERNAME);

  if (isGroup && text && !text.startsWith("/") && !mentioned) return;

  const hub = await import("./orbitx-hub.js");
  const tools = hub.listAllOrbitXTools();

  if (bare === "start" || bare === "help") {
    await sendLong(chatId, helpText(!isGroup, Boolean(link)), { parse_mode: "HTML", ...replyExtra });
    return;
  }

  if (bare === "login" || bare === "auth") {
    if (isGroup) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Login is private. Message @theorbitxmcpbot directly and send /login.",
        ...replyExtra,
      });
      return;
    }
    try {
      const body = await startLogin(from, publicBase(req));
      await sendLong(chatId, body, { parse_mode: "HTML" });
    } catch (error) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: `Could not start login: ${error?.message || error}`,
      });
    }
    return;
  }

  if (bare === "logout") {
    if (isGroup) return;
    if (link) {
      await sb(`telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(String(from.id))}`, { method: "DELETE" });
    }
    await tg("sendMessage", { chat_id: chatId, text: "Unlinked. This chat is public-only until /login." });
    return;
  }

  if (bare === "me") {
    if (!link) {
      await tg("sendMessage", { chat_id: chatId, text: "Not linked. Send /login in this private chat." });
      return;
    }
    await sendLong(
      chatId,
      `<b>Linked OrbitX</b>\nuser: <code>${link.user_id}</code>\nwallet: <code>${link.wallet_address || "n/a"}</code>\ntelegram: @${link.telegram_username || from.username || "user"}`,
      { parse_mode: "HTML" },
    );
    return;
  }

  if (bare === "cmds") {
    const page = await handleCmds(text, tools);
    await sendLong(chatId, page.text, { parse_mode: "HTML", ...replyExtra });
    return;
  }

  let tool = "";
  let args = {};
  if (bare === "call") {
    const parsed = parseCallInvocation(text);
    tool = parsed.tool;
    args = parsed.args;
  } else if (bare === "ask" || (text && !text.startsWith("/"))) {
    const inferred = inferPublicTool(text.replace(new RegExp(`@${OFFICIAL_BOT_USERNAME}`, "ig"), " ").trim());
    if (inferred) {
      tool = inferred.tool;
      args = inferred.args;
    } else {
      await tg("sendChatAction", { chat_id: chatId, action: "typing" });
      const prompt = bare === "ask" ? text.replace(/^\S+\s*/, "").trim() || "gm" : text;
      const answer = await askAi(prompt, { linked: Boolean(link) });
      await sendLong(chatId, answer, replyExtra);
      return;
    }
  } else {
    const resolved = resolveOfficialCommand(bare);
    if (resolved.kind === "tool" && resolved.tool) {
      tool = resolved.tool;
      args = argsFromCommand(resolved.command, text);
    }
  }

  if (!tool) {
    if (text.startsWith("/")) {
      await tg("sendMessage", {
        chat_id: chatId,
        text: "Unknown command. Try /cmds or /call toolname args.",
        ...replyExtra,
      });
    }
    return;
  }

  await tg("sendChatAction", {
    chat_id: chatId,
    action: tool.includes("video") ? "upload_video" : tool.includes("image") || tool.includes("grok") ? "upload_photo" : "typing",
  });
  try {
    const result = await runTool({
      tool,
      args,
      req,
      link,
      allowPrivileged: !isGroup && Boolean(link),
    });
    await sendLong(chatId, formatMcpResultForTelegram(result), replyExtra);
    await sendMedia(chatId, collectMediaUrls(result));
  } catch (error) {
    await tg("sendMessage", {
      chat_id: chatId,
      text: `OrbitX tool error: ${error?.message || error}`,
      ...replyExtra,
    });
  }
}

async function configureBot(req) {
  if (!BOT_TOKEN) return { ok: false, error: "TELEGRAM_ORBITX_BOT_TOKEN is not set" };
  const base = officialOrigin();
  const webhookUrl = `${base}/api/telegram-orbitx`;
  const me = await tg("getMe", {});
  const name = await tg("setMyName", { name: OFFICIAL_BOT_NAME });
  const short = await tg("setMyShortDescription", { short_description: OFFICIAL_BOT_SHORT.slice(0, 120) });
  const about = await tg("setMyDescription", { description: OFFICIAL_BOT_ABOUT.slice(0, 512) });
  const groupCmds = await tg("setMyCommands", {
    commands: GROUP_COMMANDS.slice(0, 100),
    scope: { type: "all_group_chats" },
  });
  const privateCmds = await tg("setMyCommands", {
    commands: PRIVATE_COMMANDS.slice(0, 100),
    scope: { type: "all_private_chats" },
  });
  const defaultCmds = await tg("setMyCommands", { commands: GROUP_COMMANDS.slice(0, 100) });
  const webhook = await tg("setWebhook", {
    url: webhookUrl,
    secret_token: process.env.TELEGRAM_ORBITX_WEBHOOK_SECRET || undefined,
    allowed_updates: ["message", "edited_message", "channel_post", "callback_query"],
    drop_pending_updates: false,
  });
  const photo = await setBotPhoto(base);
  return {
    ok: Boolean(me?.ok && webhook?.ok),
    me: me?.result || null,
    webhook: webhook?.ok ? webhookUrl : webhook,
    name,
    short,
    about,
    photo,
    groupCmds: groupCmds?.ok,
    privateCmds: privateCmds?.ok,
    defaultCmds: defaultCmds?.ok,
  };
}

async function setBotPhoto(base) {
  try {
    const url = `${base}/brand/orbitx-telegram-bot.png`;
    const img = await fetch(url);
    if (!img.ok) return { ok: false, skipped: true, status: img.status };
    const buf = Buffer.from(await img.arrayBuffer());
    const form = new FormData();
    form.append("photo", JSON.stringify({ type: "static", photo: "attach://pic" }));
    form.append("pic", new Blob([buf], { type: "image/png" }), "orbitx-telegram-bot.png");
    return tg("setMyProfilePhoto", null, { form });
  } catch (error) {
    return { ok: false, error: error?.message || "photo_failed" };
  }
}

let lastWebhookEnsure = 0;
const WEBHOOK_ENSURE_MS = 5 * 60_000;

async function ensureWebhook(req) {
  if (!BOT_TOKEN) return { ok: false, skipped: true, error: "no_token" };
  const want = `${officialOrigin()}/api/telegram-orbitx`;
  if (Date.now() - lastWebhookEnsure < WEBHOOK_ENSURE_MS) {
    return { ok: true, cached: true, url: want };
  }
  lastWebhookEnsure = Date.now();
  const info = await tg("getWebhookInfo", {});
  const current = String(info?.result?.url || "");
  if (current === want) return { ok: true, already: true, url: want };
  return configureBot(req);
}

async function handleWeb(req, res, body) {
  const action = String(body.action || "").toLowerCase();
  const user = await getJwtUser(req);
  const hub = await import("./orbitx-hub.js");

  if (action === "web.status") {
    let links = [];
    if (user?.id) {
      links = await sb(
        `telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}&select=telegram_user_id,telegram_username,wallet_address,created_at&limit=5`,
      ).catch(() => []);
    }
    return json(res, {
      ok: true,
      bot: { username: OFFICIAL_BOT_USERNAME, name: OFFICIAL_BOT_NAME, about: OFFICIAL_BOT_SHORT },
      signedIn: Boolean(user?.id),
      links: Array.isArray(links) ? links : [],
      tools: hub.listAllOrbitXTools().length,
    });
  }

  if (action === "web.cmds") {
    const tools = hub.listAllOrbitXTools();
    const page = await handleCmds(`/cmds ${body.query || body.page || ""}`, tools);
    return json(res, { ok: true, ...page, tools: tools.slice(0, 80) });
  }

  if (action === "web.link") {
    if (!user?.id) return json(res, { error: "unauthorized", message: "Sign in with your OrbitX wallet first." }, 401);
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return json(res, { error: "code_required" }, 400);
    const rows = await sb(
      `telegram_orbitx_login_codes?code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
    );
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return json(res, { error: "invalid_code" }, 404);
    if (row.consumed_at) return json(res, { error: "code_already_used" }, 409);
    if (new Date(row.expires_at).getTime() <= Date.now()) return json(res, { error: "code_expired" }, 410);
    const telegramUserId = String(row.telegram_user_id);
    const wallet = await loadWallet(user.id);
    const link = {
      telegram_user_id: telegramUserId,
      user_id: user.id,
      telegram_username: row.telegram_username,
      wallet_address: wallet,
      updated_at: new Date().toISOString(),
    };
    await sb(
      `telegram_orbitx_links?user_id=eq.${encodeURIComponent(user.id)}&telegram_user_id=neq.${encodeURIComponent(telegramUserId)}`,
      { method: "DELETE" },
    ).catch(() => null);
    const existing = await loadLink(telegramUserId);
    if (existing) {
      await sb(`telegram_orbitx_links?telegram_user_id=eq.${encodeURIComponent(telegramUserId)}`, {
        method: "PATCH",
        body: JSON.stringify(link),
      });
    } else {
      await sb("telegram_orbitx_links", { method: "POST", body: JSON.stringify(link) });
    }
    await sb(`telegram_orbitx_login_codes?code=eq.${encodeURIComponent(code)}`, {
      method: "PATCH",
      body: JSON.stringify({ consumed_at: new Date().toISOString() }),
    });
    if (BOT_TOKEN) {
      await tg("sendMessage", {
        chat_id: telegramUserId,
        text: "OrbitX linked. You can now /buy /sell /tweet /post and /call write tools in this private chat.",
      });
    }
    return json(res, { ok: true, link: { telegramUserId, wallet } });
  }

  if (action === "web.call") {
    const tool = String(body.tool || "").trim();
    const args = body.args && typeof body.args === "object" && !Array.isArray(body.args) ? body.args : {};
    const privileged = isPrivilegedTelegramTool(tool) || tool === "x_post";
    if (privileged && !user?.id) {
      return json(res, { error: "unauthorized", message: "Sign in with your OrbitX wallet to run this tool." }, 401);
    }
    const wallet = user?.id ? await loadWallet(user.id) : null;
    const result = await runTool({
      tool,
      args,
      req,
      link: user?.id ? { user_id: user.id, wallet_address: wallet } : null,
      allowPrivileged: Boolean(user?.id),
    });
    return json(res, {
      ok: result?.ok !== false,
      tool,
      text: formatMcpResultForTelegram(result),
      imageUrls: collectMediaUrls(result),
      result,
    });
  }

  return json(res, { error: "unknown_web_action" }, 400);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token");
    res.statusCode = 204;
    return res.end();
  }

  try {
    if (req.method === "GET") {
      const url = new URL(req.url || "/", FALLBACK);
      const action = String(url.searchParams.get("action") || "health");
      if (action === "configure") {
        const provided =
          url.searchParams.get("secret") ||
          header(req, "x-orbitx-telegram-secret") ||
          "";
        if (!WEBHOOK_SECRET || provided !== WEBHOOK_SECRET) {
          return json(res, { error: "forbidden" }, 403);
        }
        return json(res, await configureBot(req));
      }
      const hub = await import("./orbitx-hub.js");
      const webhook = await ensureWebhook(req).catch((error) => ({
        ok: false,
        error: error?.message || "ensure_failed",
      }));
      return json(res, {
        ok: true,
        service: "telegram-orbitx",
        bot: OFFICIAL_BOT_USERNAME,
        tools: hub.listAllOrbitXTools().length,
        tokenConfigured: Boolean(BOT_TOKEN),
        webhook: webhook?.url || webhook,
        webhookOk: webhook?.ok !== false,
      });
    }

    if (req.method !== "POST") return json(res, { error: "method_not_allowed" }, 405);
    const secret = header(req, "x-telegram-bot-api-secret-token");
    const body = await readBody(req);

    if (String(body.action || "").startsWith("web.")) {
      return handleWeb(req, res, body);
    }

    if (WEBHOOK_SECRET && secret && secret !== WEBHOOK_SECRET) {
      res.statusCode = 403;
      return res.end("forbidden");
    }

    // Telegram webhook updates have update_id; never require JWT.
    if (body.update_id != null || body.message || body.channel_post) {
      await handleTelegramUpdate(body, req);
      return ok(res);
    }

    return json(res, { error: "unknown_payload" }, 400);
  } catch (error) {
    console.error("[telegram-orbitx]", error);
    if (header(req, "x-telegram-bot-api-secret-token") || req.method === "POST") return ok(res);
    return json(res, { error: error?.message || "internal_error" }, 500);
  }
}
