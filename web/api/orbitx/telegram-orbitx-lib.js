/**
 * Official OrbitX Telegram bot — first-party tool runner, not MCP OAuth.
 *
 * Groups: public / unauthenticated intel + Grok media.
 * Private DMs: link an OrbitX account, then trade / X / social / NFT writes.
 */
import { isHoldGatedTool } from "./token-hold.js";
import { formatMcpResultForTelegram, parseCallArgs, toolToSlashCommand } from "./telegram-mcp-allowlist.js";

export const OFFICIAL_BOT_USERNAME = "theorbitxmcpbot";
export const OFFICIAL_BOT_NAME = "OrbitX";
export const OFFICIAL_BOT_SHORT =
  "Official OrbitX bot — charts, scans, Grok image/video, and (in DMs) trade, X, and your account.";
export const OFFICIAL_BOT_ABOUT =
  "OrbitX's official Telegram bot. In groups it answers without login: token intel, Dex charts, screeners, and Grok Imagine image/video. Message it privately to link your OrbitX wallet, then trade, post to X, and run the full live tool catalog (~5000 capabilities). Not an MCP connector — tools run natively on OrbitX.";

export const AUTH_TOOLS = new Set([
  "orbitx_auth_link",
  "orbitx_auth_status",
]);

const WRITE_PREFIXES = [
  /^orbitx_(buy|sell|prepare_buy|prepare_sell|confirm_buy|credits_buy|credits_confirm)/,
  /^orbitx_social_(post|join|create|leave)/,
  /^orbitx_nft_(prepare_buy|submit_buy|like|comment|follow|register|make_offer|cancel_offer|list_for_sale|cancel_listing|create_auction|place_bid|favorite)/,
  /^orbitx_(create_token|execute_launch|prepare_launch|launch_|vanity_mint|mint_nft|submit_listing|request_boost|burn|claim_fees|rent_refund)/,
];

export function isPrivilegedTelegramTool(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (AUTH_TOOLS.has(n) || n.startsWith("orbitx_auth_")) return true;
  if (isHoldGatedTool(n)) return true;
  if (n.startsWith("x_") && !["x_menu", "x_help", "x_tools_help"].includes(n)) return true;
  return WRITE_PREFIXES.some((re) => re.test(n));
}

export function isPublicTelegramTool(name) {
  const n = String(name || "").trim();
  if (!n) return false;
  if (AUTH_TOOLS.has(n) || n.startsWith("orbitx_auth_")) return false;
  if (isPrivilegedTelegramTool(n)) return false;
  return n.startsWith("orbitx_") || n === "search" || n === "fetch";
}

export const GROUP_COMMANDS = [
  { command: "start", description: "OrbitX bot intro" },
  { command: "help", description: "What this bot can do" },
  { command: "cmds", description: "Browse live tools" },
  { command: "ask", description: "Ask OrbitX AI" },
  { command: "img", description: "Generate an image (Grok Imagine)" },
  { command: "vid", description: "Generate a video (Grok Imagine)" },
  { command: "media", description: "Poll an image/video task" },
  { command: "token", description: "Token intel by mint / CA" },
  { command: "chart", description: "Live DexScreener chart" },
  { command: "scan", description: "Safety + forensics scan" },
  { command: "xray", description: "Token X-ray" },
  { command: "research", description: "Deep research brief" },
  { command: "search", description: "Search tokens" },
  { command: "screen", description: "Trending Solana screen" },
  { command: "wallet", description: "Wallet snapshot (address)" },
  { command: "health", description: "OrbitX platform health" },
  { command: "call", description: "Call any public tool: /call name args" },
];

export const PRIVATE_COMMANDS = [
  ...GROUP_COMMANDS,
  { command: "login", description: "Link your OrbitX wallet" },
  { command: "logout", description: "Unlink this Telegram account" },
  { command: "me", description: "Show linked OrbitX identity" },
  { command: "buy", description: "Prepare a token buy (linked)" },
  { command: "sell", description: "Prepare a token sell (linked)" },
  { command: "tweet", description: "Post to your connected X (linked)" },
  { command: "post", description: "Post to OrbitX social (linked)" },
  { command: "launch", description: "Launch / create token (linked)" },
];

const PRIORITY_TOOL = {
  start: null,
  help: null,
  cmds: null,
  login: null,
  logout: null,
  me: null,
  ask: null,
  img: "orbitx_generate_image",
  vid: "orbitx_generate_video",
  media: "orbitx_media_status",
  token: "orbitx_get_token",
  chart: "orbitx_dex_chart",
  scan: "orbitx_crypto_scan",
  xray: "orbitx_xray",
  research: "orbitx_research",
  search: "orbitx_search",
  screen: "orbitx_screen_tokens",
  wallet: "orbitx_get_wallet",
  health: "orbitx_health",
  call: null,
  buy: "orbitx_prepare_buy",
  sell: "orbitx_prepare_sell",
  tweet: "x_post",
  post: "orbitx_social_post",
  launch: "orbitx_execute_launch",
};

export function resolveOfficialCommand(cmd) {
  const c = String(cmd || "")
    .replace(/^\//, "")
    .toLowerCase()
    .replace(/@.*$/, "")
    .trim();
  if (!c) return { kind: "unknown", command: c, tool: null };
  if (c in PRIORITY_TOOL) {
    const tool = PRIORITY_TOOL[c];
    return { kind: tool ? "tool" : "meta", command: c, tool };
  }
  if (c.startsWith("orbitx_")) return { kind: "tool", command: c, tool: c };
  return { kind: "tool", command: c, tool: `orbitx_${c}` };
}

export function argsFromCommand(command, text) {
  const rest = String(text || "").replace(/^\S+\s*/, "").trim();
  const args = rest ? parseCallArgs(rest) : {};
  if ((command === "img" || command === "vid" || command === "tweet" || command === "post" || command === "ask") && rest) {
    if (!args.prompt) args.prompt = rest;
    if (!args.text && (command === "tweet" || command === "post")) args.text = rest;
    if (!args.q && command === "ask") args.q = rest;
  }
  if (command === "media" && rest && !args.taskId) args.taskId = rest.split(/\s+/)[0];
  if (["token", "chart", "xray", "research", "scan", "buy", "sell"].includes(command) && rest && !args.mint) {
    const token = rest.split(/\s+/)[0];
    args.mint = token;
    args.ca = token;
  }
  if (command === "search" && rest && !args.q) {
    args.q = rest;
    args.query = rest;
  }
  if (command === "wallet" && rest && !args.address) {
    args.address = rest.split(/\s+/)[0];
    args.publicKey = args.address;
  }
  if (command === "screen" && !args.chain) args.chain = "solana";
  return args;
}

export function parseCallInvocation(text) {
  const rest = String(text || "").replace(/^\/call(@\w+)?\s*/i, "").trim();
  if (!rest) return { tool: "", args: {} };
  const sp = rest.indexOf(" ");
  const raw = sp < 0 ? rest : rest.slice(0, sp);
  const tool = raw.startsWith("orbitx_") || raw.startsWith("x_") ? raw : `orbitx_${raw}`;
  const args = parseCallArgs(sp < 0 ? "" : rest.slice(sp + 1));
  return { tool, args };
}

export function inferPublicTool(text) {
  const t = String(text || "").trim();
  const lower = t.toLowerCase();
  if (!t || t.startsWith("/")) return null;

  const img = lower.match(/^(?:generate |make |create )?(?:an? )?(?:image|img|picture|art)\b[:\s-]*(.+)$/i);
  if (img?.[1]) return { tool: "orbitx_generate_image", args: { prompt: img[1].trim() } };

  const vid = lower.match(/^(?:generate |make |create )?(?:an? )?(?:video|vid|clip)\b[:\s-]*(.+)$/i);
  if (vid?.[1]) return { tool: "orbitx_generate_video", args: { prompt: vid[1].trim() } };

  const chart = t.match(/\b(?:chart|dex)\b[\s\S]*?\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/i);
  if (chart) return { tool: "orbitx_dex_chart", args: { ca: chart[1], mint: chart[1] } };

  const mintOnly = t.match(/^(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/);
  if (mintOnly) return { tool: "orbitx_get_token", args: { mint: mintOnly[1] } };

  return null;
}

export function collectMediaUrls(result) {
  const urls = [];
  const push = (u) => {
    if (typeof u === "string" && /^https?:\/\//i.test(u) && urls.length < 6) urls.push(u);
  };
  push(result?.imageUrl);
  push(result?.videoUrl);
  if (Array.isArray(result?.urls)) result.urls.forEach(push);
  if (Array.isArray(result?.resultUrls)) result.resultUrls.forEach(push);
  if (Array.isArray(result?.imageUrls)) result.imageUrls.forEach(push);
  if (Array.isArray(result?.images)) {
    for (const im of result.images) push(typeof im === "string" ? im : im?.url);
  }
  return urls;
}

export function loginCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export function cmdsPage(tools, { page = 1, pageSize = 40, query = "" } = {}) {
  const normalized = String(query || "").trim().toLowerCase();
  const filtered = tools.filter((tool) => {
    if (!normalized) return true;
    return (
      tool.name.toLowerCase().includes(normalized) ||
      String(tool.description || "").toLowerCase().includes(normalized)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const start = (safePage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const lines = [
    `<b>OrbitX live tools</b> · ${filtered.length} shown · page ${safePage}/${totalPages}`,
    "Public in groups. Trade / X / writes need a private /login.",
    "",
    ...slice.map((tool) => {
      const cmd = toolToSlashCommand(tool.name, "agent");
      const badge = isPrivilegedTelegramTool(tool.name) ? "🔒" : "•";
      return `${badge} ${cmd ? `/${cmd}` : ""} <code>${tool.name}</code>`;
    }),
    "",
    "Next page: /cmds 2   ·   Search: /cmds chart   ·   Run: /call name args",
  ];
  return { text: lines.join("\n"), page: safePage, totalPages, count: filtered.length };
}

export { formatMcpResultForTelegram, parseCallArgs, toolToSlashCommand };
