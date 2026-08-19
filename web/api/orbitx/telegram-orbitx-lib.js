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
  { command: "auth", description: "Link your OrbitX wallet" },
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
  auth: null,
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

function tgEsc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function fmtUsd(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const abs = Math.abs(v);
  if (abs === 0) return "$0";
  if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  if (abs >= 1) return `$${v.toFixed(4).replace(/\.?0+$/, "")}`;
  if (abs >= 1e-4) return `$${v.toPrecision(4)}`;
  return `$${v.toExponential(2)}`;
}

function fmtPct(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  const v = Number(n);
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function fmtInt(n) {
  if (n == null || n === "" || Number.isNaN(Number(n))) return "—";
  return Math.round(Number(n)).toLocaleString("en-US");
}

export function unwrapToolPayload(result) {
  if (result == null) return result;
  if (typeof result === "string") {
    const trimmed = result.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return result;
      }
    }
    return result;
  }
  if (typeof result !== "object") return result;
  if (Array.isArray(result.content) && result.content[0]?.text) {
    const inner = unwrapToolPayload(result.content[0].text);
    if (inner && typeof inner === "object") return inner;
  }
  if (
    result.result &&
    typeof result.result === "object" &&
    (result.result.token || result.result.mint || result.result.meta)
  ) {
    return result.result;
  }
  return result;
}

function asTokenRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const token = value.token && typeof value.token === "object" ? value.token : value;
  const mint = String(token.mint || value.mint || token.ca || value.ca || "").trim();
  const symbol = token.symbol || value.symbol || token.ticker;
  const name = token.name || value.name;
  const price = token.priceUsd ?? token.price ?? value.priceUsd;
  const mcap = token.mcap ?? token.fdv ?? token.marketCap ?? value.mcap;
  if (!mint && !symbol) return null;
  if (price == null && mcap == null && !token.holderCount && !token.liquidity) return null;
  return { ...value, ...token, mint, symbol, name, meta: value.meta || token.meta };
}

export function formatTokenCard(raw) {
  const token = asTokenRecord(unwrapToolPayload(raw));
  if (!token) return null;
  const mint = String(token.mint || "");
  const symbol = String(token.symbol || "TOKEN");
  const name = String(token.name || symbol);
  const chain = String(token.chain || "solana");
  const age = token.ageDays != null ? `${token.ageDays}d` : "";
  const audit = token.audit || {};
  const organic = token.organicScoreLabel || (token.organicScore != null ? String(token.organicScore) : "");
  const dex = mint ? `https://dexscreener.com/${encodeURIComponent(chain)}/${encodeURIComponent(mint)}` : "";
  const lines = [
    `<b>${tgEsc(name)}</b> · $${tgEsc(symbol)}`,
    [chain, age, Array.isArray(token.tags) && token.tags.includes("token-2022") ? "Token-2022" : ""]
      .filter(Boolean)
      .map(tgEsc)
      .join(" · "),
    "",
    `Price   ${tgEsc(fmtUsd(token.priceUsd ?? token.price))}`,
    `MC      ${tgEsc(fmtUsd(token.mcap ?? token.fdv))}`,
    `Liq     ${tgEsc(fmtUsd(token.liquidity))}`,
    `Vol 24h ${tgEsc(fmtUsd(token.volume ?? token.stats?.["24h"]?.volume))}`,
    `Holders ${tgEsc(fmtInt(token.holderCount))} (${tgEsc(fmtPct(token.holderChange24h))} 24h)`,
    "",
    `5m ${tgEsc(fmtPct(token.change5m))}   1h ${tgEsc(fmtPct(token.change1h))}   6h ${tgEsc(fmtPct(token.change6h))}   24h ${tgEsc(fmtPct(token.change24h))}`,
  ];
  const flags = [];
  if (audit.mintAuthorityDisabled) flags.push("mint revoked");
  if (audit.freezeAuthorityDisabled) flags.push("freeze revoked");
  if (audit.topHoldersPercentage != null) flags.push(`top holders ${Number(audit.topHoldersPercentage).toFixed(1)}%`);
  if (flags.length) lines.push("", `Audit: ${tgEsc(flags.join(" · "))}`);
  if (organic) lines.push(`Organic: ${tgEsc(organic)}`);
  if (mint) {
    lines.push("", `<code>${tgEsc(mint)}</code>`);
    lines.push(`<a href="${tgEsc(dex)}">DexScreener</a> · /chart <code>${tgEsc(mint)}</code>`);
  }
  return lines.join("\n");
}

function formatTokenList(raw) {
  const data = unwrapToolPayload(raw);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.tokens)
      ? data.tokens
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
          ? data.results
          : null;
  if (!items?.length) return null;
  if (!asTokenRecord(items[0])) return null;
  const rows = items.slice(0, 12).map((item, i) => {
    const token = asTokenRecord(item) || {};
    const sym = token.symbol || token.name || token.mint || `row ${i + 1}`;
    const price = token.priceUsd ?? token.price;
    const ch = token.change24h ?? token.priceChange24h ?? token.stats?.["24h"]?.priceChange;
    const mint = token.mint ? ` <code>${tgEsc(String(token.mint).slice(0, 6))}…</code>` : "";
    return `${i + 1}. <b>${tgEsc(sym)}</b> ${tgEsc(fmtUsd(price))} ${tgEsc(fmtPct(ch))}${mint}`;
  });
  return [`<b>OrbitX screen</b> · ${items.length} tokens`, "", ...rows].join("\n");
}

function formatCompactObject(raw) {
  const data = unwrapToolPayload(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const skip = new Set(["stats", "audit", "firstPool", "meta", "token", "raw", "payload"]);
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key) || value == null || typeof value === "object") continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
    lines.push(`${tgEsc(label)}: ${tgEsc(String(value).slice(0, 160))}`);
    if (lines.length >= 16) break;
  }
  if (lines.length < 2) return null;
  return [`<b>OrbitX</b>`, ...lines].join("\n");
}

/** Human Telegram text for hub tool payloads. Never dumps raw JSON blobs. */
export function formatOrbitXTelegramResult(result) {
  if (result == null) return "(empty)";
  const data = unwrapToolPayload(result);
  if (typeof data === "string") return tgEsc(data).slice(0, 3500);
  if (data?.error) {
    return `Error: ${tgEsc(data.error)}${data.message ? ` — ${tgEsc(data.message)}` : ""}`;
  }
  const token = formatTokenCard(data);
  if (token) return token;
  const list = formatTokenList(data);
  if (list) return list;
  const fallback = formatMcpResultForTelegram(data);
  if (fallback && !fallback.trim().startsWith("{") && !fallback.trim().startsWith("[")) {
    return fallback.slice(0, 3500);
  }
  const compact = formatCompactObject(data);
  if (compact) return compact;
  return "Got a result, but it isn’t a readable token card. Try /token mint or /cmds.";
}

export function collectMediaUrls(result) {
  const urls = [];
  const push = (u) => {
    if (typeof u !== "string" || !/^https?:\/\//i.test(u) || urls.length >= 6) return;
    if (/ipfs/i.test(u) || /bafkrei/i.test(u)) return;
    urls.push(u);
  };
  const data = unwrapToolPayload(result) || {};
  push(result?.imageUrl);
  push(result?.videoUrl);
  push(data?.imageUrl);
  push(data?.videoUrl);
  push(data?.meta?.image);
  push(data?.meta?.icon);
  push(data?.token?.icon);
  push(data?.icon);
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
