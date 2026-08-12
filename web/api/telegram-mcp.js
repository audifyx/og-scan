/**
 * /api/telegram-mcp — bridge Telegram bots ↔ OrbitX Agent / X MCP.
 *
 * Auth = dashboard: bot is owned by OrbitX user (telegram_bots.user_id).
 * No auth-link tools, no trading. Agent = full MCP minus deny lists.
 * X = image + video (Grok Imagine) only.
 *
 * POST { action, botId, webhookSecret, kind?, tool?, args?, text? }
 *   action: status | list | call | cmds | help
 */
export const config = { maxDuration: 120 };

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

function send(res, data, status = 200) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
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

async function loadBot({ botId, webhookSecret }) {
  const id = String(botId || "").trim();
  const secret = String(webhookSecret || "").trim();
  if (!id || !secret) return null;
  const rows = await sb(
    `telegram_bots?id=eq.${encodeURIComponent(id)}&select=id,user_id,bot_username,webhook_secret,mcp_agent_enabled,mcp_x_enabled&limit=1`,
  );
  const bot = Array.isArray(rows) ? rows[0] : null;
  if (!bot || bot.webhook_secret !== secret) return null;
  return bot;
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
        const commands = buildMcpTelegramCommands(
          "x",
          tools.map((t) => t.name),
          40,
        );
        return send(res, {
          ok: true,
          kind: "x",
          auth: "dashboard",
          deny: ["auth tools", "trading", "post/DM"],
          allow: "image + video only",
          tools,
          commands,
          help: formatMcpResultForTelegram(xMediaMenu()),
        });
      }

      const tools = coreTools
        .filter((t) => isAgentTelegramToolAllowed(t.name))
        .map((t) => ({
          name: t.name,
          command: toolToSlashCommand(t.name, "agent"),
          description: t.description,
        }));
      const commands = buildMcpTelegramCommands(
        "agent",
        tools.map((t) => t.name),
        70,
      );
      return send(res, {
        ok: true,
        kind: "agent",
        auth: "dashboard",
        deny: ["orbitx_auth_*", "buy/sell/credits"],
        tools,
        commands,
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

      // Slash helpers: /call name ..., or resolve from command
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
          const argStr = sp < 0 ? "" : rest.slice(sp + 1);
          args = { ...parseCallArgs(argStr), ...args };
        } else if (cmd === "mcp" || cmd === "help_mcp") {
          if (kind === "x") return send(res, { ok: true, text: formatMcpResultForTelegram(xMediaMenu()) });
          tool = "orbitx_menu";
        } else {
          const resolved = resolveSlashToTool(cmd, kind);
          if (resolved) tool = resolved;
          const rest = String(body.text || "").replace(/^\S+\s*/, "").trim();
          if (rest) args = { ...parseCallArgs(rest), ...args };
          // Convenience: /img prompt /vid prompt
          if ((cmd === "img" || cmd === "vid") && rest && !args.prompt) {
            args.prompt = rest;
          }
          if (cmd === "media" && rest && !args.taskId) args.taskId = rest.split(/\s+/)[0];
          if ((cmd === "token" || cmd === "chart" || cmd === "xray") && rest && !args.mint && !args.ca) {
            args.mint = rest.split(/\s+/)[0];
            args.ca = args.mint;
          }
          if (cmd === "search" && rest && !args.q) {
            args.q = rest;
            args.query = rest;
          }
          if (cmd === "screen" && rest && !args.category) args.category = rest.split(/\s+/)[0];
          if (cmd === "wallet" && rest && !args.address && !args.publicKey) {
            args.address = rest.split(/\s+/)[0];
            args.publicKey = args.address;
          }
        }
      }

      if (!tool) return send(res, { error: "tool_required" }, 400);

      const allowed =
        kind === "x" ? isXTelegramToolAllowed(tool) : isAgentTelegramToolAllowed(tool);
      if (!allowed) {
        return send(
          res,
          {
            error: "tool_not_allowed",
            tool,
            hint:
              kind === "x"
                ? "X Telegram MCP is image/video only (no auth, no trading, no post)."
                : "Auth and trading tools are disabled on Telegram.",
          },
          403,
        );
      }

      // Strip any client-supplied authCode — dashboard auth only
      delete args.authCode;
      delete args.orbitxAuthCode;

      let result;
      if (kind === "x" && (tool === "x_menu" || tool === "x_help" || tool === "x_tools_help" || tool === "search" || tool === "fetch")) {
        if (tool === "x_menu" || tool === "x_help" || tool === "x_tools_help") {
          result = xMediaMenu();
        } else if (tool === "search") {
          result = {
            content: [
              {
                type: "text",
                text: "X Telegram MCP: /img /vid /media. Full X post/DM stays on Claude·ChatGPT·Grok via /x.",
              },
            ],
          };
        } else {
          result = xMediaMenu();
        }
      } else {
        // Media + agent tools run through Agent MCP (dashboard user)
        result = await hub.runTelegramAgentTool(bot.user_id, tool, args, req);
      }

      const text = formatMcpResultForTelegram(result);
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
        text,
        imageUrls: imageUrls.slice(0, 6),
        taskId: result?.taskId || null,
        raw: typeof result === "object" ? { ok: result.ok, status: result.status, taskId: result.taskId } : undefined,
      });
    }

    return send(res, { error: "unknown_action", action }, 400);
  } catch (e) {
    console.error("[telegram-mcp]", e);
    return send(res, { error: e?.message || "internal_error" }, e?.status && e.status < 600 ? e.status : 500);
  }
}
