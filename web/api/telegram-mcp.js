/**
 * /api/telegram-mcp — bridge Telegram bots ↔ OrbitX Agent / X MCP.
 *
 * Bot webhook calls: { action, botId, webhookSecret, kind?, tool?, args?, text? }
 * Dashboard (JWT):   { action: "dashboard_status"|"dashboard_enable"|"dashboard_disable", kind? }
 *
 * Auth = dashboard owner. No auth-link tools, no trading.
 * Agent = full MCP minus deny lists. X = image + video only.
 */
export const config = { maxDuration: 120 };

import { randomUUID } from "crypto";
import {
  AGENT_PRIORITY_CMDS,
  X_PRIORITY_CMDS,
  X_TELEGRAM_ALLOW,
  buildMcpTelegramCommands,
  formatMcpResultForTelegram,
  isAgentTelegramToolAllowed,
  isXTelegramToolAllowed,
  parseCallArgs,
  resolveSlashToTool,
  toolToSlashCommand,
} from "./orbitx/telegram-mcp-allowlist.js";

const SUPA_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const FALLBACK = "https://www.orbitx.world";

function cryptoRandomSecret() {
  return randomUUID().replace(/-/g, "");
}

function send(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function header(req, name) {
  const h = req.headers || {};
  return h[name.toLowerCase()] || h[name] || "";
}

function publicBase(req) {
  const env = process.env.PUBLIC_APP_URL || process.env.VITE_PUBLIC_APP_URL;
  if (env) {
    const cleaned = String(env).replace(/\/$/, "");
    if (cleaned === "https://orbitx.world" || cleaned === "http://orbitx.world") return FALLBACK;
    return cleaned;
  }
  const proto = header(req, "x-forwarded-proto") || "https";
  let host = header(req, "x-forwarded-host") || header(req, "host") || "www.orbitx.world";
  host = String(host).split(",")[0].trim().replace(/:\d+$/, "");
  if (host === "orbitx.world") host = "www.orbitx.world";
  return `${proto}://${host}`;
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

async function getDashboardUser(req) {
  const auth = header(req, "authorization");
  if (!auth.startsWith("Bearer ") || !SUPA_URL || !ANON) return null;
  const r = await fetch(`${SUPA_URL}/auth/v1/user`, {
    headers: { Authorization: auth, apikey: ANON },
  });
  if (!r.ok) return null;
  const u = await r.json();
  return u?.id ? { id: u.id, email: u.email || null } : null;
}

async function loadBot({ botId, webhookSecret }) {
  const id = String(botId || "").trim();
  const secret = String(webhookSecret || "").trim();
  if (!id || !secret) return null;
  try {
    const rows = await sb(
      `telegram_bots?id=eq.${encodeURIComponent(id)}&select=id,user_id,bot_username,webhook_secret,mcp_agent_enabled,mcp_x_enabled&limit=1`,
    );
    const bot = Array.isArray(rows) ? rows[0] : null;
    if (!bot || bot.webhook_secret !== secret) return null;
    return bot;
  } catch (e) {
    if (String(e?.message || "").includes("mcp_")) {
      const rows = await sb(
        `telegram_bots?id=eq.${encodeURIComponent(id)}&select=id,user_id,bot_username,webhook_secret&limit=1`,
      );
      const bot = Array.isArray(rows) ? rows[0] : null;
      if (!bot || bot.webhook_secret !== secret) return null;
      return { ...bot, mcp_agent_enabled: false, mcp_x_enabled: false };
    }
    throw e;
  }
}

function safeBot(b) {
  if (!b) return null;
  return {
    id: b.id,
    bot_username: b.bot_username,
    mcp_agent_enabled: !!b.mcp_agent_enabled,
    mcp_x_enabled: !!b.mcp_x_enabled,
  };
}

const MCP_AGENT_MENU = [
  { command: "mcp", description: "OrbitX MCP menu" },
  { command: "cmds", description: "List MCP commands" },
  { command: "img", description: "Generate image (Grok Imagine)" },
  { command: "vid", description: "Generate video (Grok Imagine)" },
  { command: "media", description: "Poll image/video task" },
  { command: "search", description: "Search tokens / MCP" },
  { command: "token", description: "Token intel by mint" },
  { command: "chart", description: "Dex chart for a CA" },
  { command: "call", description: "Call MCP tool: /call name args" },
  { command: "help_mcp", description: "MCP tools help" },
];

const MCP_X_MENU = [
  { command: "mcp", description: "X MCP media menu" },
  { command: "cmds", description: "List MCP media commands" },
  { command: "img", description: "Generate image (Grok Imagine)" },
  { command: "vid", description: "Generate video (Grok Imagine)" },
  { command: "media", description: "Poll image/video task" },
  { command: "call", description: "Call media tool: /call name args" },
  { command: "help_mcp", description: "X MCP help" },
];

async function setTelegramWebhook(botToken, url, secret) {
  const r = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      secret_token: secret,
      allowed_updates: ["message", "my_chat_member", "channel_post"],
      drop_pending_updates: false,
    }),
  });
  return r.json().catch(() => ({}));
}

async function setTelegramCommands(botToken, commands) {
  await fetch(`https://api.telegram.org/bot${botToken}/setMyCommands`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ commands: commands.slice(0, 100) }),
  }).catch(() => {});
}

function xMediaMenu() {
  return {
    ok: true,
    title: "OrbitX X MCP · Telegram (image & video)",
    note: "Dashboard-auth · no trading · no auth tools. Claude / ChatGPT / Grok MCP stay on /x.",
    commands: X_PRIORITY_CMDS.map((c) => `/${c.command} — ${c.description}`),
    tools: [...X_TELEGRAM_ALLOW],
  };
}

async function handleDashboard(req, res, body) {
  const user = await getDashboardUser(req);
  if (!user?.id) return send(res, { error: "unauthorized" }, 401);

  const action = String(body.action || "").toLowerCase();
  const kind = String(body.kind || "agent").toLowerCase() === "x" ? "x" : "agent";

  let rows;
  try {
    rows = await sb(
      `telegram_bots?user_id=eq.${encodeURIComponent(user.id)}&select=id,user_id,bot_username,bot_token,webhook_secret,mcp_agent_enabled,mcp_x_enabled&limit=1`,
    );
  } catch (e) {
    if (String(e?.message || "").includes("mcp_")) {
      return send(
        res,
        {
          error: "migration_required",
          hint: "Apply supabase/migrations/20260812090000_telegram_mcp.sql (mcp_agent_enabled / mcp_x_enabled).",
        },
        503,
      );
    }
    throw e;
  }
  const bot = Array.isArray(rows) ? rows[0] : null;

  if (action === "dashboard_status") {
    return send(res, { ok: true, bot: safeBot(bot) });
  }

  if (action === "dashboard_connect") {
    const botToken = String(body.botToken || body.bot_token || "").trim();
    if (!/^\d+:[A-Za-z0-9_-]{30,}$/.test(botToken)) {
      return send(res, { error: "Invalid BotFather token. Open @BotFather → /newbot and paste the token." }, 400);
    }
    const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
    const me = await meRes.json().catch(() => ({}));
    if (!me?.ok || !me.result?.id) {
      return send(res, { error: "Telegram rejected that token. Double-check it with @BotFather." }, 400);
    }

    const webhookSecret = cryptoRandomSecret();
    const baseRow = {
      user_id: user.id,
      bot_id: me.result.id,
      bot_username: me.result.username,
      bot_token: botToken,
      webhook_secret: webhookSecret,
      updated_at: new Date().toISOString(),
    };
    const withMcp = {
      ...baseRow,
      ai_enabled: true,
      ...(kind === "x" ? { mcp_x_enabled: true, mcp_agent_enabled: false } : { mcp_agent_enabled: true, mcp_x_enabled: false }),
    };

    let saved = null;
    let migrationMissing = false;
    try {
      if (bot?.id) {
        const out = await sb(`telegram_bots?id=eq.${encodeURIComponent(bot.id)}`, {
          method: "PATCH",
          body: JSON.stringify(withMcp),
          headers: { Prefer: "return=representation" },
        });
        saved = Array.isArray(out) ? out[0] : out;
      } else {
        const out = await sb("telegram_bots", {
          method: "POST",
          body: JSON.stringify(withMcp),
          headers: { Prefer: "return=representation" },
        });
        saved = Array.isArray(out) ? out[0] : out;
      }
    } catch (e) {
      const msg = String(e?.message || e);
      if (msg.includes("mcp_")) {
        migrationMissing = true;
        // Persist bot without MCP columns, still route webhook to Vercel.
        try {
          if (bot?.id) {
            const out = await sb(`telegram_bots?id=eq.${encodeURIComponent(bot.id)}`, {
              method: "PATCH",
              body: JSON.stringify(baseRow),
              headers: { Prefer: "return=representation" },
            });
            saved = Array.isArray(out) ? out[0] : out;
          } else {
            const out = await sb("telegram_bots", {
              method: "POST",
              body: JSON.stringify(baseRow),
              headers: { Prefer: "return=representation" },
            });
            saved = Array.isArray(out) ? out[0] : out;
          }
          saved = { ...saved, mcp_agent_enabled: kind !== "x", mcp_x_enabled: kind === "x" };
        } catch (e2) {
          return send(res, { error: e2?.message || "Failed to save bot" }, 400);
        }
      } else {
        return send(res, { error: msg || "Failed to save bot" }, 400);
      }
    }

    const vercelHook = `${FALLBACK}/api/telegram-bot-hook?bot=${saved.id}`;
    const wh = await setTelegramWebhook(botToken, vercelHook, webhookSecret);
    if (!wh?.ok) {
      return send(res, { error: "webhook_failed", detail: wh?.description || "Telegram setWebhook failed" }, 400);
    }

    const mcpCmds = kind === "x" ? MCP_X_MENU : MCP_AGENT_MENU;
    await setTelegramCommands(botToken, [
      ...mcpCmds,
      { command: "chat", description: "Chat with OrbitX AI" },
      { command: "scan", description: "Full token risk report" },
      { command: "help", description: "Show commands" },
    ]);

    return send(res, {
      ok: true,
      bot: safeBot(saved),
      webhook: "vercel-mcp",
      migrationMissing,
      hint: migrationMissing
        ? "Bot connected. Apply supabase/migrations/20260812090000_telegram_mcp.sql so MCP flags persist."
        : undefined,
      mcp: { kind, enabled: true, cmds: mcpCmds },
    });
  }

  if (!bot) {
    return send(res, { error: "Connect a Telegram bot first (paste BotFather token).", bot: null }, 400);
  }

  if (action === "dashboard_enable" || action === "dashboard_disable") {
    const enable = action === "dashboard_enable";
    const patch = {
      updated_at: new Date().toISOString(),
      ...(kind === "x" ? { mcp_x_enabled: enable } : { mcp_agent_enabled: enable }),
    };
    let updated;
    try {
      const out = await sb(`telegram_bots?id=eq.${encodeURIComponent(bot.id)}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
        headers: { Prefer: "return=representation" },
      });
      updated = Array.isArray(out) ? out[0] : out;
    } catch (e) {
      return send(res, { error: e?.message || "failed_to_update", hint: "Apply telegram_mcp migration." }, 400);
    }

    const agentOn = kind === "agent" ? enable : !!updated.mcp_agent_enabled;
    const xOn = kind === "x" ? enable : !!updated.mcp_x_enabled;
    const vercelHook = `${FALLBACK}/api/telegram-bot-hook?bot=${updated.id}`;
    const supabaseHook = `${SUPA_URL}/functions/v1/telegram-webhook?bot=${updated.id}`;
    const hookUrl = agentOn || xOn ? vercelHook : supabaseHook;
    const wh = await setTelegramWebhook(bot.bot_token, hookUrl, bot.webhook_secret);
    if (!wh?.ok) {
      return send(
        res,
        {
          error: "webhook_failed",
          detail: wh?.description || "Telegram rejected setWebhook",
          bot: safeBot(updated),
        },
        400,
      );
    }

    const mcpCmds = agentOn ? MCP_AGENT_MENU : xOn ? MCP_X_MENU : [];
    const baseCmds = [
      { command: "scan", description: "Full token risk report" },
      { command: "chat", description: "Chat with the AI analyst" },
      { command: "help", description: "Show commands" },
      { command: "trending", description: "Top trending tokens (24h)" },
      { command: "migrations", description: "Pump.fun graduations" },
    ];
    const seen = new Set();
    const commands = [];
    for (const c of [...mcpCmds, ...baseCmds]) {
      if (seen.has(c.command)) continue;
      seen.add(c.command);
      commands.push(c);
    }
    await setTelegramCommands(bot.bot_token, commands);

    return send(res, {
      ok: true,
      bot: safeBot(updated),
      webhook: hookUrl.startsWith(FALLBACK) ? "vercel-mcp" : "supabase",
      mcp: {
        kind,
        enabled: enable,
        note:
          kind === "x"
            ? "X Telegram MCP: image & video only. Auth from dashboard. No trading / auth tools."
            : "Agent Telegram MCP: all tools except auth + trading. Auth from dashboard.",
        cmds: mcpCmds,
      },
    });
  }

  return send(res, { error: "unknown_dashboard_action", action }, 400);
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return send(res, { error: "method_not_allowed" }, 405);

  try {
    const body = await readBody(req);
    const action = String(body.action || "status").toLowerCase();

    if (action.startsWith("dashboard_")) {
      return handleDashboard(req, res, body);
    }

    const kind = String(body.kind || "agent").toLowerCase() === "x" ? "x" : "agent";
    const bot = await loadBot(body);
    if (!bot) return send(res, { error: "unauthorized_bot" }, 401);

    const agentOn = bot.mcp_agent_enabled === true;
    const xOn = bot.mcp_x_enabled === true;
    if (kind === "agent" && !agentOn) {
      return send(res, { error: "mcp_agent_disabled", hint: "Enable Telegram MCP on /agent Connect" }, 403);
    }
    if (kind === "x" && !xOn) {
      return send(res, { error: "mcp_x_disabled", hint: "Enable Telegram MCP on /x Connect" }, 403);
    }

    if (action === "status") {
      return send(res, {
        ok: true,
        kind,
        botUsername: bot.bot_username,
        mcp_agent_enabled: agentOn,
        mcp_x_enabled: xOn,
        auth: "dashboard",
      });
    }

    const hub = await import("./orbitx-hub.js");
    const coreTools = typeof hub.listTelegramAgentCoreTools === "function" ? hub.listTelegramAgentCoreTools() : [];

    if (action === "list" || action === "cmds") {
      if (kind === "x") {
        const tools = [...X_TELEGRAM_ALLOW].map((name) => ({
          name,
          command: toolToSlashCommand(name, name.startsWith("x_") ? "x" : "agent"),
          description: name.startsWith("orbitx_generate")
            ? "Grok Imagine media"
            : name.startsWith("x_")
              ? "X MCP helper"
              : "MCP",
        }));
        return send(res, {
          ok: true,
          kind: "x",
          auth: "dashboard",
          tools,
          commands: buildMcpTelegramCommands("x", tools.map((t) => t.name), 40),
        });
      }
      const tools = coreTools
        .filter((t) => isAgentTelegramToolAllowed(t.name))
        .map((t) => ({
          name: t.name,
          command: toolToSlashCommand(t.name, "agent"),
          description: t.description,
        }));
      return send(res, {
        ok: true,
        kind: "agent",
        auth: "dashboard",
        tools,
        commands: buildMcpTelegramCommands("agent", tools.map((t) => t.name), 70),
        priority: AGENT_PRIORITY_CMDS,
      });
    }

    if (action === "help") {
      if (kind === "x") return send(res, { ok: true, text: formatMcpResultForTelegram(xMediaMenu()) });
      const menu = await hub.runTelegramAgentTool(bot.user_id, "orbitx_menu", {}, req);
      return send(res, { ok: true, text: formatMcpResultForTelegram(menu) });
    }

    if (action === "call") {
      let tool = String(body.tool || "").trim();
      let args = body.args && typeof body.args === "object" ? { ...body.args } : {};

      if (body.command) {
        const cmd = String(body.command).replace(/^\//, "").toLowerCase();
        if (cmd === "cmds") {
          const inner =
            kind === "x"
              ? [...X_TELEGRAM_ALLOW]
              : coreTools.map((t) => t.name).filter(isAgentTelegramToolAllowed);
          const lines = [
            kind === "x"
              ? "<b>X MCP · img &amp; vid</b> (dashboard auth)"
              : "<b>OrbitX Agent MCP</b> (dashboard auth)",
            "No auth tools · no trading",
            "",
            ...inner.slice(0, 80).map((n) => {
              const c = toolToSlashCommand(n, kind === "x" && n.startsWith("x_") ? "x" : "agent");
              return c ? `/${c} → <code>${n}</code>` : `<code>${n}</code>`;
            }),
            "",
            "Usage: /call &lt;tool&gt; prompt=...   or   /img your prompt",
          ];
          return send(res, { ok: true, text: lines.join("\n"), parseMode: "HTML" });
        }
        if (cmd === "call") {
          const rest = String(body.text || "").replace(/^\/call(@\w+)?\s*/i, "").trim();
          const sp = rest.indexOf(" ");
          tool = sp < 0 ? rest : rest.slice(0, sp);
          args = { ...parseCallArgs(sp < 0 ? "" : rest.slice(sp + 1)), ...args };
        } else if (cmd === "mcp" || cmd === "help_mcp") {
          if (kind === "x") return send(res, { ok: true, text: formatMcpResultForTelegram(xMediaMenu()) });
          tool = "orbitx_menu";
        } else {
          const resolved = resolveSlashToTool(cmd, kind);
          if (resolved) tool = resolved;
          const rest = String(body.text || "").replace(/^\S+\s*/, "").trim();
          if (rest) args = { ...parseCallArgs(rest), ...args };
          if ((cmd === "img" || cmd === "vid") && rest && !args.prompt) args.prompt = rest;
          if (cmd === "media" && rest && !args.taskId) args.taskId = rest.split(/\s+/)[0];
          if ((cmd === "token" || cmd === "chart" || cmd === "xray") && rest && !args.mint && !args.ca) {
            args.mint = rest.split(/\s+/)[0];
            args.ca = args.mint;
          }
          if (cmd === "search" && rest && !args.q) {
            args.q = rest;
            args.query = rest;
          }
          if (cmd === "wallet" && rest && !args.address && !args.publicKey) {
            args.address = rest.split(/\s+/)[0];
            args.publicKey = args.address;
          }
        }
      }

      if (!tool) return send(res, { error: "tool_required" }, 400);
      const allowed = kind === "x" ? isXTelegramToolAllowed(tool) : isAgentTelegramToolAllowed(tool);
      if (!allowed) {
        return send(res, { error: "tool_not_allowed", tool }, 403);
      }
      delete args.authCode;
      delete args.orbitxAuthCode;

      let result;
      if (
        kind === "x" &&
        (tool === "x_menu" || tool === "x_help" || tool === "x_tools_help" || tool === "search" || tool === "fetch")
      ) {
        result = xMediaMenu();
      } else {
        result = await hub.runTelegramAgentTool(bot.user_id, tool, args, req);
      }

      const textOut = formatMcpResultForTelegram(result);
      const imageUrls = [];
      const pushUrl = (u) => {
        if (u && typeof u === "string" && /^https?:\/\//i.test(u)) imageUrls.push(u);
      };
      pushUrl(result?.imageUrl);
      pushUrl(result?.videoUrl);
      if (Array.isArray(result?.urls)) result.urls.forEach(pushUrl);
      if (Array.isArray(result?.images)) {
        for (const im of result.images) pushUrl(typeof im === "string" ? im : im?.url);
      }

      return send(res, {
        ok: true,
        tool,
        text: textOut,
        imageUrls: imageUrls.slice(0, 6),
        taskId: result?.taskId || null,
      });
    }

    return send(res, { error: "unknown_action", action }, 400);
  } catch (e) {
    console.error("[telegram-mcp]", e);
    return send(res, { error: e?.message || "internal_error" }, e?.status && e.status < 600 ? e.status : 500);
  }
}
