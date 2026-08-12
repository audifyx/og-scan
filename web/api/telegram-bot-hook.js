/**
 * /api/telegram-bot-hook — Telegram webhook for MCP-enabled bots (Vercel).
 * Handles MCP /cmds with dashboard auth; forwards everything else to the
 * existing Supabase telegram-webhook (scan/alerts/AI).
 *
 * Query: ?bot=<telegram_bots.id>
 * Header: X-Telegram-Bot-Api-Secret-Token = webhook_secret
 */
export const config = { maxDuration: 120 };

import {
  formatMcpResultForTelegram,
  isAgentTelegramToolAllowed,
  isXTelegramToolAllowed,
  parseCallArgs,
  resolveSlashToTool,
} from "./orbitx/telegram-mcp-allowlist.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const FALLBACK = "https://www.orbitx.world";

function ok(res) {
  res.statusCode = 200;
  res.setHeader("Content-Type", "text/plain");
  res.end("ok");
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
    throw new Error(`supabase ${r.status}: ${t.slice(0, 200)}`);
  }
  if (r.status === 204) return null;
  return r.json();
}

async function tg(token, method, body) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return r.json();
  } catch {
    return null;
  }
}

async function sendLong(token, chatId, text, extra = {}) {
  const MAX = 3800;
  const str = String(text || "");
  if (str.length <= MAX) {
    return tg(token, "sendMessage", { chat_id: chatId, text: str, disable_web_page_preview: true, ...extra });
  }
  const parts = [];
  let buf = "";
  for (const line of str.split("\n")) {
    if ((buf + "\n" + line).length > MAX) {
      parts.push(buf);
      buf = line;
    } else buf = buf ? `${buf}\n${line}` : line;
  }
  if (buf) parts.push(buf);
  for (const p of parts) {
    await tg(token, "sendMessage", { chat_id: chatId, text: p, disable_web_page_preview: true, ...extra });
  }
}

function header(req, name) {
  const h = req.headers || {};
  return h[name.toLowerCase()] || h[name] || "";
}

function publicBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (env) return String(env).replace(/\/$/, "");
  const proto = header(req, "x-forwarded-proto") || "https";
  let host = header(req, "x-forwarded-host") || header(req, "host") || "www.orbitx.world";
  host = String(host).split(",")[0].trim().replace(/:\d+$/, "");
  if (host === "orbitx.world") host = "www.orbitx.world";
  return `${proto}://${host}`;
}

async function forwardToSupabase(botId, secret, update) {
  if (!SUPA_URL) return;
  await fetch(`${SUPA_URL}/functions/v1/telegram-webhook?bot=${encodeURIComponent(botId)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": secret,
    },
    body: JSON.stringify(update),
  }).catch(() => {});
}

const MCP_PRIORITY = new Set(["mcp", "cmds", "img", "vid", "media", "call", "help_mcp"]);
const MCP_AGENT_EXTRA = new Set([
  "token", "screen", "chart", "xray", "research", "search", "menu", "wallet",
  "get_token", "generate_image", "generate_video", "media_status", "grok_image", "grok_video",
  "tools_help", "dex_chart", "get_wallet", "whoami", "platform_stats", "health", "config",
]);

function isMcpSlash(bare, agentOn, xOn) {
  if (MCP_PRIORITY.has(bare)) return true;
  if (agentOn && (MCP_AGENT_EXTRA.has(bare) || /^(generate_|get_|orbitx_|screen_|nft_|social_)/.test(bare))) {
    return true;
  }
  if (!agentOn && xOn) {
    return ["search", "menu", "generate_image", "generate_video", "media_status", "grok_image", "grok_video"].includes(bare);
  }
  return false;
}

async function runMcpCall(bot, kind, command, text, req) {
  const hub = await import("./orbitx-hub.js");
  let tool = "";
  let args = {};
  const cmd = String(command || "").replace(/^\//, "").toLowerCase();

  if (cmd === "cmds") {
    const { AGENT_PRIORITY_CMDS, X_PRIORITY_CMDS, X_TELEGRAM_ALLOW, toolToSlashCommand } = await import(
      "./orbitx/telegram-mcp-allowlist.js"
    );
    const core = typeof hub.listTelegramAgentCoreTools === "function" ? hub.listTelegramAgentCoreTools() : [];
    const inner =
      kind === "x"
        ? [...X_TELEGRAM_ALLOW]
        : core.map((t) => t.name).filter(isAgentTelegramToolAllowed);
    const lines = [
      kind === "x" ? "<b>X MCP · img &amp; vid</b> (dashboard auth)" : "<b>OrbitX Agent MCP</b> (dashboard auth)",
      "No auth tools · no trading",
      "",
      ...inner.slice(0, 80).map((n) => {
        const c = toolToSlashCommand(n, kind === "x" && n.startsWith("x_") ? "x" : "agent");
        return c ? `/${c} → <code>${n}</code>` : `<code>${n}</code>`;
      }),
      "",
      "Usage: /call &lt;tool&gt; prompt=...   or   /img your prompt",
    ];
    return { text: lines.join("\n"), parseMode: "HTML", imageUrls: [] };
  }

  if (cmd === "call") {
    const rest = String(text || "").replace(/^\/call(@\w+)?\s*/i, "").trim();
    const sp = rest.indexOf(" ");
    tool = sp < 0 ? rest : rest.slice(0, sp);
    args = parseCallArgs(sp < 0 ? "" : rest.slice(sp + 1));
  } else if (cmd === "mcp" || cmd === "help_mcp" || cmd === "menu") {
    if (kind === "x") {
      return {
        text: formatMcpResultForTelegram({
          ok: true,
          title: "OrbitX X MCP · Telegram (image & video)",
          note: "Dashboard-auth · no trading · no auth tools.",
          commands: [" /mcp", "/cmds", "/img", "/vid", "/media", "/call"],
        }),
        imageUrls: [],
      };
    }
    tool = "orbitx_menu";
  } else {
    const resolved = resolveSlashToTool(cmd, kind);
    if (resolved) tool = resolved;
    const rest = String(text || "").replace(/^\S+\s*/, "").trim();
    if (rest) args = parseCallArgs(rest);
    if ((cmd === "img" || cmd === "vid") && rest && !args.prompt) args.prompt = rest;
    if (cmd === "media" && rest && !args.taskId) args.taskId = rest.split(/\s+/)[0];
    if ((cmd === "token" || cmd === "chart" || cmd === "xray") && rest && !args.mint) {
      args.mint = rest.split(/\s+/)[0];
      args.ca = args.mint;
    }
    if (cmd === "search" && rest && !args.q) {
      args.q = rest;
      args.query = rest;
    }
    if (cmd === "wallet" && rest && !args.address) {
      args.address = rest.split(/\s+/)[0];
      args.publicKey = args.address;
    }
  }

  if (!tool) return { text: "Unknown MCP command. Try /cmds", imageUrls: [] };
  const allowed = kind === "x" ? isXTelegramToolAllowed(tool) : isAgentTelegramToolAllowed(tool);
  if (!allowed) return { text: `Tool not allowed on Telegram: ${tool}`, imageUrls: [] };

  delete args.authCode;
  delete args.orbitxAuthCode;

  let result;
  if (kind === "x" && (tool === "x_menu" || tool === "x_help" || tool === "x_tools_help" || tool === "search" || tool === "fetch")) {
    result = {
      ok: true,
      text: "X Telegram MCP: /img /vid /media. Full X post/DM stays on Claude·ChatGPT·Grok via /x.",
    };
  } else {
    result = await hub.runTelegramAgentTool(bot.user_id, tool, args, req);
  }

  const imageUrls = [];
  const push = (u) => {
    if (u && typeof u === "string" && /^https?:\/\//i.test(u)) imageUrls.push(u);
  };
  push(result?.imageUrl);
  push(result?.videoUrl);
  if (Array.isArray(result?.urls)) result.urls.forEach(push);
  if (Array.isArray(result?.images)) {
    for (const im of result.images) push(typeof im === "string" ? im : im?.url);
  }

  return { text: formatMcpResultForTelegram(result), imageUrls: imageUrls.slice(0, 6) };
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return ok(res);

  try {
    const url = new URL(req.url || "/", FALLBACK);
    const botId = String(url.searchParams.get("bot") || "").trim();
    if (!botId) return ok(res);

    let rows;
    try {
      rows = await sb(
        `telegram_bots?id=eq.${encodeURIComponent(botId)}&select=id,user_id,bot_token,bot_username,bot_id,webhook_secret,mcp_agent_enabled,mcp_x_enabled&limit=1`,
      );
    } catch (e) {
      // Migration may be missing columns — fall back and forward everything.
      console.error("[telegram-bot-hook] load", e?.message || e);
      return ok(res);
    }
    const bot = Array.isArray(rows) ? rows[0] : null;
    if (!bot?.bot_token) return ok(res);

    const secret = header(req, "x-telegram-bot-api-secret-token");
    if (secret !== bot.webhook_secret) {
      res.statusCode = 403;
      return res.end("forbidden");
    }

    const update = await readBody(req);
        const agentOn = bot.mcp_agent_enabled === true || (bot.mcp_agent_enabled == null && bot.mcp_x_enabled == null);
        const xOn = bot.mcp_x_enabled === true;
        // Flags null = migration missing but webhook is on Vercel → treat as agent MCP.
        const mcpLive = agentOn || xOn;
        if (!mcpLive) {
          await forwardToSupabase(botId, bot.webhook_secret, update);
          return ok(res);
        }

    const msg = update.message || update.channel_post;
    if (!msg?.text) {
      await forwardToSupabase(botId, bot.webhook_secret, update);
      return ok(res);
    }

    const text = String(msg.text || "").trim();
    const bare = text.toLowerCase().split(/\s+/)[0].replace(/@.*$/, "").replace(/^\//, "");
    const kind = agentOn ? "agent" : "x";

    if (bare && isMcpSlash(bare, agentOn, xOn)) {
      const chatId = msg.chat.id;
      const isGroup = msg.chat?.type === "group" || msg.chat?.type === "supergroup";
      await tg(bot.bot_token, "sendChatAction", { chat_id: chatId, action: "typing" });
      try {
        const out = await runMcpCall(bot, kind, bare, text, req);
        await sendLong(bot.bot_token, chatId, out.text || "(no result)", {
          ...(out.parseMode ? { parse_mode: out.parseMode } : {}),
          ...(isGroup ? { reply_to_message_id: msg.message_id } : {}),
        });
        for (const media of out.imageUrls || []) {
          const isVid = /\.(mp4|webm|mov)(\?|$)/i.test(media) || /video/i.test(media);
          if (isVid) await tg(bot.bot_token, "sendVideo", { chat_id: chatId, video: media });
          else await tg(bot.bot_token, "sendPhoto", { chat_id: chatId, photo: media });
        }
      } catch (e) {
        await tg(bot.bot_token, "sendMessage", {
          chat_id: chatId,
          text: `MCP error: ${e?.message || e}`,
        });
      }
      return ok(res);
    }

    // Non-MCP: forward to existing Supabase bot (scan, alerts, Grim, …)
    await forwardToSupabase(botId, bot.webhook_secret, update);
    return ok(res);
  } catch (e) {
    console.error("[telegram-bot-hook]", e);
    return ok(res);
  }
}
