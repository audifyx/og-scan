/**
 * Telegram MCP allowlists — dashboard-auth bridge, no auth-link / no trading.
 * Agent: everything else. X: image + video (Grok Imagine) only.
 */

/** Auth / session tools — never exposed on Telegram (auth comes from dashboard). */
export const AGENT_AUTH_DENY = new Set([
  "orbitx_auth_link",
  "orbitx_auth_status",
]);

/** Buy / sell / credits / fee ops — never on Telegram. */
export const AGENT_TRADE_DENY = new Set([
  "orbitx_buy",
  "orbitx_trade",
  "orbitx_swap",
  "orbitx_sell",
  "orbitx_buy_auto",
  "orbitx_sell_pump",
  "orbitx_prepare_buy",
  "orbitx_prepare_sell",
  "orbitx_buy_orbitx",
  "orbitx_confirm_buy",
  "orbitx_claim_fees",
  "orbitx_burn",
  "orbitx_rent_refund",
  "orbitx_credits_buy",
  "orbitx_credits_confirm",
  "orbitx_nft_prepare_buy",
  "orbitx_nft_submit_buy",
]);

/** X MCP: media only (+ discovery helpers). No auth, no trading, no post/DM. */
export const X_TELEGRAM_ALLOW = new Set([
  "search",
  "fetch",
  "x_menu",
  "x_help",
  "x_tools_help",
  // Grok Imagine lives on Agent MCP — bridged when X Telegram MCP is enabled
  "orbitx_generate_image",
  "orbitx_generate_video",
  "orbitx_media_status",
  "orbitx_grok_image",
  "orbitx_grok_video",
]);

export const X_AUTH_DENY = new Set(["x_auth_link", "x_auth_status"]);
export const X_TRADE_DENY = new Set([
  "x_buy",
  "x_buy_orbitx",
  "x_confirm_buy",
  "x_credits_buy",
  "x_credits_confirm",
]);

export function isAgentTelegramToolAllowed(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (AGENT_AUTH_DENY.has(n) || AGENT_TRADE_DENY.has(n)) return false;
  if (n.startsWith("orbitx_auth_")) return false;
  if (/^orbitx_(buy|sell|prepare_buy|prepare_sell|confirm_buy|credits_buy|credits_confirm)/.test(n)) {
    return false;
  }
  return true;
}

export function isXTelegramToolAllowed(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (X_AUTH_DENY.has(n) || X_TRADE_DENY.has(n)) return false;
  return X_TELEGRAM_ALLOW.has(n);
}

export const TELEGRAM_CMD_LIMIT = 100;

/** Meta cmds that are not MCP tools — always occupy the first slash slots. */
export const TELEGRAM_META_CMDS = [
  { command: "start", description: "OrbitX MCP desk" },
  { command: "help", description: "Public MCP command menu" },
  { command: "cmds", description: "Live MCP catalog — slash names match tools" },
  { command: "call", description: "Call any MCP tool: /call name args" },
];

export function isTelegramAuthMcpTool(name) {
  const n = String(name || "").trim();
  if (!n) return true;
  if (AGENT_AUTH_DENY.has(n) || X_AUTH_DENY.has(n)) return true;
  if (n.startsWith("orbitx_auth_") || n.startsWith("x_auth_")) return true;
  return false;
}

/** Map MCP tool → Telegram slash command (≤32 chars, [a-z0-9_]). */
export function toolToSlashCommand(toolName, kind = "agent") {
  let n = String(toolName || "").trim().toLowerCase();
  if (!n) return null;
  if (kind === "agent" && n.startsWith("orbitx_")) n = n.slice(7);
  if (kind === "x" && n.startsWith("x_")) n = n.slice(2);
  if (n.startsWith("orbitx_")) n = n.slice(7);
  n = n.replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
  if (!n || n.length > 32) n = n.slice(0, 32).replace(/_+$/, "");
  if (!n || !/^[a-z]/.test(n)) return null;
  return n;
}

/** Priority slash cmds always registered when MCP is on (fit Telegram’s 100 cap). */
export const AGENT_PRIORITY_CMDS = [
  { command: "mcp", description: "OrbitX MCP menu", tool: "orbitx_menu" },
  { command: "cmds", description: "List MCP commands", tool: null },
  { command: "img", description: "Generate image (Grok Imagine)", tool: "orbitx_generate_image" },
  { command: "vid", description: "Generate video (Grok Imagine)", tool: "orbitx_generate_video" },
  { command: "media", description: "Poll image/video task", tool: "orbitx_media_status" },
  { command: "search", description: "Search tokens / MCP", tool: "orbitx_search" },
  { command: "token", description: "Token intel by mint", tool: "orbitx_get_token" },
  { command: "screen", description: "Screen trending tokens", tool: "orbitx_screen_tokens" },
  { command: "chart", description: "Dex chart for a CA", tool: "orbitx_dex_chart" },
  { command: "xray", description: "Token X-ray", tool: "orbitx_xray" },
  { command: "report", description: "Full intel dossier", tool: "orbitx_full_report" },
  { command: "research", description: "Deep research", tool: "orbitx_research" },
  { command: "wallet", description: "Wallet snapshot", tool: "orbitx_get_wallet" },
  { command: "help_mcp", description: "MCP tools help", tool: "orbitx_tools_help" },
  { command: "call", description: "Call any MCP tool: /call name args", tool: null },
];

export const X_PRIORITY_CMDS = [
  { command: "mcp", description: "X MCP media menu", tool: "x_menu" },
  { command: "cmds", description: "List MCP media commands", tool: null },
  { command: "img", description: "Generate image (Grok Imagine)", tool: "orbitx_generate_image" },
  { command: "vid", description: "Generate video (Grok Imagine)", tool: "orbitx_generate_video" },
  { command: "media", description: "Poll image/video task", tool: "orbitx_media_status" },
  { command: "help_mcp", description: "X MCP help", tool: "x_help" },
  { command: "call", description: "Call media tool: /call name args", tool: null },
];

export function mcpToolSlashCommand(name, kind = "agent") {
  const n = String(name || "").trim();
  if (n === "search" || n === "fetch") return n;
  return toolToSlashCommand(n, kind);
}

/**
 * Public intel / media tools pin to the front of Telegram's 100-command cap
 * so CORE life/gc/vc helpers cannot push /get_token off the slash menu.
 */
export const PUBLIC_MCP_PRIORITY_TOOLS = [
  "search",
  "fetch",
  "orbitx_menu",
  "orbitx_get_token",
  "orbitx_full_report",
  "orbitx_dex_chart",
  "orbitx_crypto_scan",
  "orbitx_xray",
  "orbitx_research",
  "orbitx_screen_tokens",
  "orbitx_search",
  "orbitx_get_chart",
  "orbitx_get_forensics",
  "orbitx_get_safety",
  "orbitx_get_ath",
  "orbitx_get_metadata",
  "orbitx_get_wallet",
  "orbitx_get_swaps",
  "orbitx_get_balance",
  "orbitx_generate_image",
  "orbitx_generate_video",
  "orbitx_media_status",
  "orbitx_grok_image",
  "orbitx_grok_video",
  "orbitx_health",
  "orbitx_tools_help",
  "orbitx_telegram_status",
  "orbitx_telegram_cmds",
  "orbitx_shop",
  "orbitx_leaderboard",
  "orbitx_platform_stats",
  "orbitx_paper_desk",
  "orbitx_live_desk",
  "orbitx_live_feed",
  "orbitx_live_world",
  "orbitx_live_agent",
  "orbitx_live_positions",
];

/**
 * Fill Telegram's 100 slash slots with public MCP tools.
 * Command names match the MCP tool (orbitx_get_token → /get_token).
 * Auth tools are never included.
 */
export function buildPublicMcpTelegramCommands(tools = [], {
  limit = TELEGRAM_CMD_LIMIT,
  kind = "agent",
  allow,
} = {}) {
  const ok =
    allow ||
    ((name) =>
      kind === "x"
        ? isXTelegramToolAllowed(name)
        : isAgentTelegramToolAllowed(name) && !isTelegramAuthMcpTool(name));
  const out = [];
  const seen = new Set();
  const byName = new Map();
  for (const t of tools) {
    const name = typeof t === "string" ? t : t?.name;
    if (name && !byName.has(name)) byName.set(name, t);
  }
  const add = (t) => {
    if (out.length >= limit) return;
    const name = typeof t === "string" ? t : t?.name;
    if (!name || !ok(name)) return;
    const cmdKind = kind === "x" && String(name).startsWith("x_") ? "x" : "agent";
    const cmd = mcpToolSlashCommand(name, cmdKind);
    if (!cmd || seen.has(cmd)) return;
    seen.add(cmd);
    const desc = typeof t === "string" ? `MCP ${name}` : String(t.description || `MCP ${name}`);
    out.push({ command: cmd, description: desc.slice(0, 256) });
  };
  for (const c of TELEGRAM_META_CMDS) {
    if (out.length >= limit) break;
    if (seen.has(c.command)) continue;
    seen.add(c.command);
    out.push({ command: c.command, description: String(c.description).slice(0, 256) });
  }
  if (kind !== "x") {
    for (const name of PUBLIC_MCP_PRIORITY_TOOLS) {
      if (out.length >= limit) break;
      if (byName.has(name)) add(byName.get(name));
    }
  }
  for (const t of tools) add(t);
  return out.slice(0, limit);
}

/** Build Telegram setMyCommands entries for MCP (≤ limit, after meta cmds). */
export function buildMcpTelegramCommands(kind, toolNames = [], limit = TELEGRAM_CMD_LIMIT) {
  if (kind === "x") {
    const priority = X_PRIORITY_CMDS;
    const out = [];
    const seen = new Set();
    for (const p of priority) {
      if (seen.has(p.command)) continue;
      seen.add(p.command);
      out.push({ command: p.command, description: p.description.slice(0, 256) });
    }
    for (const name of toolNames) {
      if (out.length >= limit) break;
      if (!isXTelegramToolAllowed(name) || isTelegramAuthMcpTool(name)) continue;
      const cmd = mcpToolSlashCommand(name, name.startsWith("x_") ? "x" : "agent");
      if (!cmd || seen.has(cmd)) continue;
      if (priority.some((p) => p.command === cmd && p.tool && p.tool !== name)) continue;
      seen.add(cmd);
      out.push({ command: cmd, description: `MCP ${name}`.slice(0, 256) });
    }
    return out;
  }
  return buildPublicMcpTelegramCommands(toolNames, {
    limit,
    kind: "agent",
    allow: (name) => isAgentTelegramToolAllowed(name) && !isTelegramAuthMcpTool(name),
  });
}

export function resolveSlashToTool(cmd, kind = "agent") {
  const c = String(cmd || "")
    .replace(/^\//, "")
    .toLowerCase()
    .replace(/@.*$/, "");
  const priority = kind === "x" ? X_PRIORITY_CMDS : AGENT_PRIORITY_CMDS;
  const hit = priority.find((p) => p.command === c);
  if (hit) return hit.tool; // null for cmds/call
  if (kind === "x") {
    if (X_TELEGRAM_ALLOW.has(`x_${c}`)) return `x_${c}`;
    if (X_TELEGRAM_ALLOW.has(c)) return c;
    if (X_TELEGRAM_ALLOW.has(`orbitx_${c}`)) return `orbitx_${c}`;
    return null;
  }
  // agent: prefer orbitx_ prefix
  if (c === "menu") return "orbitx_menu";
  return `orbitx_${c}`;
}

/** Flatten MCP tool result → Telegram-friendly text. */
export function formatMcpResultForTelegram(result) {
  if (result == null) return "(empty)";
  if (typeof result === "string") return result.slice(0, 3500);
  if (result.error) return `Error: ${result.error}${result.message ? ` — ${result.message}` : ""}`;

  // MCP content blocks
  if (Array.isArray(result.content)) {
    const parts = result.content
      .map((b) => {
        if (!b) return "";
        if (b.type === "text") return String(b.text || "");
        if (b.type === "image" && b.data) return "[image]";
        if (b.type === "resource" && b.resource?.uri) return String(b.resource.uri);
        return JSON.stringify(b);
      })
      .filter(Boolean);
    if (parts.length) return parts.join("\n").slice(0, 3500);
  }

  // Common OrbitX payloads
  if (result.text) return String(result.text).slice(0, 3500);
  if (result.message) return String(result.message).slice(0, 3500);
  if (result.markdown) return String(result.markdown).slice(0, 3500);
  if (result.url || result.openUrl || result.signUrl) {
    const lines = [];
    if (result.message) lines.push(result.message);
    if (result.url) lines.push(result.url);
    if (result.openUrl) lines.push(`Open: ${result.openUrl}`);
    if (result.signUrl) lines.push(`Sign: ${result.signUrl}`);
    if (result.imageUrl) lines.push(result.imageUrl);
    if (result.videoUrl) lines.push(result.videoUrl);
    if (result.taskId) lines.push(`taskId: ${result.taskId}`);
    if (lines.length) return lines.join("\n").slice(0, 3500);
  }
  if (result.taskId) {
    const urls = [result.imageUrl, result.videoUrl, ...(result.urls || [])].filter(Boolean);
    return [`taskId: ${result.taskId}`, result.status ? `status: ${result.status}` : "", ...urls]
      .filter(Boolean)
      .join("\n")
      .slice(0, 3500);
  }

  try {
    return JSON.stringify(result, null, 0).slice(0, 3500);
  } catch {
    return String(result).slice(0, 3500);
  }
}

export function parseCallArgs(rest) {
  const s = String(rest || "").trim();
  if (!s) return {};
  // JSON object
  if (s.startsWith("{")) {
    try {
      return JSON.parse(s);
    } catch {
      /* fall through */
    }
  }
  // key=value pairs
  const out = {};
  const parts = s.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (const p of parts) {
    const eq = p.indexOf("=");
    if (eq > 0) {
      const k = p.slice(0, eq);
      let v = p.slice(eq + 1);
      if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
      out[k] = v;
    } else if (!out.q && !out.prompt && !out.mint && !out.ca) {
      // positional: first free token → common fields
      if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(p) || /^0x[a-fA-F0-9]{40}$/.test(p)) {
        out.mint = p;
        out.ca = p;
      } else {
        out.prompt = out.prompt ? `${out.prompt} ${p}` : p;
        out.q = out.prompt;
        out.query = out.prompt;
      }
    } else {
      out.prompt = out.prompt ? `${out.prompt} ${p}` : p;
      out.q = out.prompt;
      out.query = out.prompt;
    }
  }
  return out;
}
