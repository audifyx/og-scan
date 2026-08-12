/**
 * /api/telegram-bot-hook — full Telegram bot for MCP-enabled OrbitX users.
 * - MCP /cmds (dashboard-auth, no trading / auth tools)
 * - AI chat via enhanced-intelligence (same as Grim)
 * - Forwards remaining built-ins (/scan, alerts, …) to Supabase webhook with auth
 */
export const config = { maxDuration: 120 };

import {
  formatMcpResultForTelegram,
  isAgentTelegramToolAllowed,
  isXTelegramToolAllowed,
  parseCallArgs,
  resolveSlashToTool,
} from "./orbitx/telegram-mcp-allowlist.js";
import {
  DEFAULT_TELEGRAM_NIM_MODEL,
  ORBITX_TELEGRAM_BLURB,
  ORBITX_TELEGRAM_SYSTEM,
} from "./orbitx/orbitx-telegram-knowledge.js";
import { nvidiaChat, NIM_MODELS, DEFAULT_NIM_MODEL } from "./orbitx/x-agent-lib.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const FALLBACK = "https://www.orbitx.world";

function resolveTelegramModel(requested) {
  const id = String(requested || "").trim();
  if (id && NIM_MODELS.some((m) => m.id === id)) return id;
  return process.env.TELEGRAM_NIM_MODEL || DEFAULT_TELEGRAM_NIM_MODEL || DEFAULT_NIM_MODEL;
}

async function askOrbitxAi(text, bot) {
  const personaExtra = bot.bot_name || bot.persona
    ? `\nBot display name: ${(bot.bot_name || bot.bot_username || "OrbitX").trim()}.` +
      (bot.persona ? `\nOwner persona notes: ${String(bot.persona).slice(0, 800)}` : "")
    : "";

  const system = `${ORBITX_TELEGRAM_SYSTEM}${personaExtra}`;
  const model = resolveTelegramModel(bot.ai_model);

  // Primary: free NVIDIA NIM (same API as Agent/X MCP backend).
  const nim = await nvidiaChat({
    system,
    user: String(text || "gm").slice(0, 6000),
    model,
    maxTokens: 900,
    temperature: 0.65,
  });
  if (nim.ok && nim.content) return String(nim.content).trim();

  // Fallback: enhanced-intelligence (also NVIDIA-backed on Supabase).
  const key = SRK || ANON;
  if (SUPA_URL && key) {
    try {
      const r = await fetch(`${SUPA_URL}/functions/v1/enhanced-intelligence`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
          apikey: key,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: text }],
          context: system.slice(0, 12000),
          model,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.ok && (j.content || j.error)) return String(j.content || j.error).trim();
    } catch {
      /* ignore */
    }
  }

  return (
    nim.message ||
    "OrbitX AI is offline (NVIDIA_API_KEY missing on Vercel). Add NVIDIA_API_KEY and redeploy, then try again."
  );
}

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

/** Forward to legacy Supabase telegram-webhook (needs apikey even with verify_jwt=false). */
async function forwardToSupabase(botId, secret, update) {
  if (!SUPA_URL || !SRK) return { ok: false, error: "no_supabase" };
  try {
    const r = await fetch(`${SUPA_URL}/functions/v1/telegram-webhook?bot=${encodeURIComponent(botId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": secret,
        Authorization: `Bearer ${SRK}`,
        apikey: SRK,
      },
      body: JSON.stringify(update),
    });
    return { ok: r.ok, status: r.status };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/** Auto-route natural language to MCP when obvious. */
function inferMcpFromText(text, kind) {
  const t = String(text || "").trim();
  const lower = t.toLowerCase();
  if (!t || t.startsWith("/")) return null;

  const img = lower.match(/^(?:generate |make |create )?(?:an? )?(?:image|img|picture|art)\b[:\s-]*(.+)$/i);
  if (img && kind === "agent") return { tool: "orbitx_generate_image", args: { prompt: img[1].trim() } };
  if (img && kind === "x") return { tool: "orbitx_generate_image", args: { prompt: img[1].trim() } };

  const vid = lower.match(/^(?:generate |make |create )?(?:an? )?(?:video|vid|clip)\b[:\s-]*(.+)$/i);
  if (vid) return { tool: "orbitx_generate_video", args: { prompt: vid[1].trim() } };

  const chart = lower.match(/\b(?:chart|dex)\b.*?\b([1-9A-HJ-NP-Za-km-z]{32,44}|0x[a-fA-F0-9]{40})\b/i);
  if (chart && kind === "agent") return { tool: "orbitx_dex_chart", args: { ca: chart[1], mint: chart[1] } };

  const mintOnly = t.match(/^(?:0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (mintOnly && kind === "agent") return { tool: "orbitx_get_token", args: { mint: mintOnly[1] || mintOnly[0] } };

  return null;
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
    const { X_TELEGRAM_ALLOW, toolToSlashCommand } = await import("./orbitx/telegram-mcp-allowlist.js");
    const core = typeof hub.listTelegramAgentCoreTools === "function" ? hub.listTelegramAgentCoreTools() : [];
    const inner =
      kind === "x"
        ? [...X_TELEGRAM_ALLOW]
        : core.map((t) => t.name).filter(isAgentTelegramToolAllowed);
    const lines = [
      kind === "x" ? "<b>X MCP · img &amp; vid</b> + OrbitX AI chat" : "<b>OrbitX Agent MCP</b> + AI chat",
      "Dashboard auth · no auth tools · no trading",
      "",
      ...inner.slice(0, 60).map((n) => {
        const c = toolToSlashCommand(n, kind === "x" && n.startsWith("x_") ? "x" : "agent");
        return c ? `/${c} → <code>${n}</code>` : `<code>${n}</code>`;
      }),
      "",
      "Chat freely for AI · /img prompt · /call tool args",
    ];
    return { text: lines.join("\n"), parseMode: "HTML", imageUrls: [] };
  }

  if (cmd === "call") {
    const rest = String(text || "").replace(/^\/call(@\w+)?\s*/i, "").trim();
    const sp = rest.indexOf(" ");
    tool = sp < 0 ? rest : rest.slice(0, sp);
    args = parseCallArgs(sp < 0 ? "" : rest.slice(sp + 1));
  } else if (cmd === "mcp" || cmd === "help_mcp" || cmd === "menu") {
    tool = kind === "x" ? "" : "orbitx_menu";
    if (kind === "x") {
      return {
        text:
          "<b>X MCP (Telegram)</b>\n/img /vid /media /cmds\n\nChat normally for OrbitX AI.\nClaude/ChatGPT/Grok connectors stay on /x.",
        parseMode: "HTML",
        imageUrls: [],
      };
    }
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

  const result = await hub.runTelegramAgentTool(bot.user_id, tool, args, req);
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

async function loadBotRow(botId) {
  try {
    const rows = await sb(
      `telegram_bots?id=eq.${encodeURIComponent(botId)}&select=id,user_id,bot_token,bot_username,bot_id,bot_name,persona,ai_enabled,ai_model,webhook_secret,mcp_agent_enabled,mcp_x_enabled&limit=1`,
    );
    return Array.isArray(rows) ? rows[0] : null;
  } catch (e) {
    if (!String(e?.message || "").includes("mcp_")) throw e;
    const rows = await sb(
      `telegram_bots?id=eq.${encodeURIComponent(botId)}&select=id,user_id,bot_token,bot_username,bot_id,bot_name,persona,ai_enabled,ai_model,webhook_secret&limit=1`,
    );
    const bot = Array.isArray(rows) ? rows[0] : null;
    return bot ? { ...bot, mcp_agent_enabled: true, mcp_x_enabled: false } : null;
  }
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

    const bot = await loadBotRow(botId);
    if (!bot?.bot_token) return ok(res);

    const secret = header(req, "x-telegram-bot-api-secret-token");
    if (secret && secret !== bot.webhook_secret) {
      res.statusCode = 403;
      return res.end("forbidden");
    }

    const update = await readBody(req);
    const agentOn =
      bot.mcp_agent_enabled === true || (bot.mcp_agent_enabled == null && bot.mcp_x_enabled == null);
    const xOn = bot.mcp_x_enabled === true;
    const kind = agentOn ? "agent" : "x";

    // Non-message updates → legacy handler
    if (!update.message && !update.channel_post) {
      await forwardToSupabase(botId, bot.webhook_secret, update);
      return ok(res);
    }

    const msg = update.message || update.channel_post;
    const text = String(msg.text || msg.caption || "").trim();
    const chatId = msg.chat?.id;
    if (!chatId) return ok(res);

    const isGroup = msg.chat?.type === "group" || msg.chat?.type === "supergroup";
    const bare = text.toLowerCase().split(/\s+/)[0].replace(/@.*$/, "").replace(/^\//, "");
    const replyExtra = isGroup ? { reply_to_message_id: msg.message_id } : {};

    // Always answer /start /help here so the bot is never silent after connect.
    if (bare === "start" || bare === "help") {
      const name = bot.bot_name || bot.bot_username || "OrbitX";
      await sendLong(
        bot.bot_token,
        chatId,
        `<b>${name}</b> is online.\n${ORBITX_TELEGRAM_BLURB}\n\n` +
          `<b>AI chat</b> (NVIDIA free model)\nJust message me, or /chat your question\n\n` +
          `<b>MCP</b> (dashboard auth · no trading)\n` +
          `/mcp · /cmds · /img prompt · /vid prompt\n` +
          (agentOn ? `/token mint · /chart ca · /call tool args\n` : ``) +
          `\nTrained on OrbitX product knowledge · connected to your account.`,
        { parse_mode: "HTML", ...replyExtra },
      );
      return ok(res);
    }

    // MCP slash commands
    if (bare && isMcpSlash(bare, agentOn, xOn)) {
      await tg(bot.bot_token, "sendChatAction", { chat_id: chatId, action: "typing" });
      try {
        const out = await runMcpCall(bot, kind, bare, text, req);
        await sendLong(bot.bot_token, chatId, out.text || "(no result)", {
          ...(out.parseMode ? { parse_mode: out.parseMode } : {}),
          ...replyExtra,
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
          ...replyExtra,
        });
      }
      return ok(res);
    }

    // Natural-language → MCP shortcuts (img/vid/chart/mint)
    if (text && !text.startsWith("/")) {
      const inferred = inferMcpFromText(text, kind);
      if (inferred) {
        await tg(bot.bot_token, "sendChatAction", { chat_id: chatId, action: "typing" });
        try {
          const hub = await import("./orbitx-hub.js");
          const allowed =
            kind === "x" ? isXTelegramToolAllowed(inferred.tool) : isAgentTelegramToolAllowed(inferred.tool);
          if (allowed) {
            const result = await hub.runTelegramAgentTool(bot.user_id, inferred.tool, inferred.args, req);
            const out = formatMcpResultForTelegram(result);
            await sendLong(bot.bot_token, chatId, out, replyExtra);
            const url = result?.imageUrl || result?.videoUrl || result?.urls?.[0];
            if (url) {
              if (/video|\.mp4/i.test(url)) await tg(bot.bot_token, "sendVideo", { chat_id: chatId, video: url });
              else await tg(bot.bot_token, "sendPhoto", { chat_id: chatId, photo: url });
            }
            return ok(res);
          }
        } catch (e) {
          await tg(bot.bot_token, "sendMessage", { chat_id: chatId, text: `MCP: ${e?.message || e}`, ...replyExtra });
          return ok(res);
        }
      }
    }

    // Explicit AI chat + free-text AI (OrbitX enhanced-intelligence)
    const isChatCmd = ["chat", "ask", "grim", "c"].includes(bare);
    const wantAi =
      isChatCmd ||
      (text && !text.startsWith("/")) ||
      (text.startsWith("/") && ["chat", "ask", "grim", "c"].includes(bare));

    if (wantAi && bot.ai_enabled !== false) {
      if (isGroup && !isChatCmd) {
        const botUser = (bot.bot_username || "").toLowerCase();
        const mentioned = botUser && new RegExp(`@${botUser}\\b`, "i").test(text);
        const replyToBot = msg.reply_to_message?.from?.id === bot.bot_id;
        if (!mentioned && !replyToBot) {
          // Let legacy handler deal with group noise / auto-scan
          await forwardToSupabase(botId, bot.webhook_secret, update);
          return ok(res);
        }
      }

      const prompt = isChatCmd
        ? text.replace(/^\S+\s*/, "").trim() || "gm"
        : text.replace(new RegExp(`@${bot.bot_username}`, "ig"), " ").replace(/\s+/g, " ").trim() || "gm";

      await tg(bot.bot_token, "sendChatAction", { chat_id: chatId, action: "typing" });
      const answer = await askOrbitxAi(prompt, bot);
      await sendLong(bot.bot_token, chatId, answer, replyExtra);
      return ok(res);
    }

    // Other slash commands (/scan, /migrations, …) → Supabase legacy bot
    if (text.startsWith("/")) {
      const fwd = await forwardToSupabase(botId, bot.webhook_secret, update);
      if (!fwd.ok) {
        await tg(bot.bot_token, "sendMessage", {
          chat_id: chatId,
          text: "Legacy command relay failed. Try /cmds for MCP or just chat for AI.",
          ...replyExtra,
        });
      }
      return ok(res);
    }

    await forwardToSupabase(botId, bot.webhook_secret, update);
    return ok(res);
  } catch (e) {
    console.error("[telegram-bot-hook]", e);
    return ok(res);
  }
}
