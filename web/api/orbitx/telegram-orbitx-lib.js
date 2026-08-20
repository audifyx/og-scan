/**
 * Official OrbitX Telegram bot — first-party tool runner, not MCP OAuth.
 *
 * Groups: public / unauthenticated intel + Grok media.
 * Private DMs: link an OrbitX account, then trade / X / social / NFT writes.
 */
import { isHoldGatedTool } from "./token-hold.js";
import { formatMcpResultForTelegram, parseCallArgs, toolToSlashCommand } from "./telegram-mcp-allowlist.js";
import { applyTelegramAlias, parseTradeIntent } from "./telegram-trade-intent.js";
import { ORBITX_MINT } from "./telegram-token-snapshot.js";
import {
  CA_RE as PAYLOAD_CA_RE,
  extractMint as payloadExtractMint,
  mediaEtaSeconds as payloadMediaEtaSeconds,
  unwrapToolPayload as payloadUnwrap,
} from "./telegram-payload.js";
import {
  cmdsPage as cmdsPageImpl,
  deskKeyboard,
  formatFamilyMenu,
  formatHelpDesk,
  formatTelegramStartGate,
  formatMediaCountdown,
  formatOrbitXTelegramResult as formatResultImpl,
  formatTokenCard as formatTokenCardImpl,
  formatToolMenu,
  missingToolInput,
  telegramMessageParts,
  TOKEN_INTEL_TOOLS as CARD_TOKEN_INTEL_TOOLS,
} from "./telegram-tool-cards.js";

export const OFFICIAL_BOT_USERNAME = "theorbitxmcpbot";
export const OFFICIAL_BOT_NAME = "OrbitX";
export const OFFICIAL_BOT_SHORT =
  "Official OrbitX bot — charts, scans, Grok image/video, and (in DMs) trade, X, and your account.";
export const OFFICIAL_BOT_ABOUT =
  "OrbitX's official Telegram bot. In groups it answers without login: token intel, Dex charts, screeners, and Grok Imagine image/video. Message it privately to link your OrbitX wallet, then trade, post to X, and run the full live tool catalog (~5000 capabilities). Not an MCP connector — tools run natively on OrbitX.";

const GROUP_ANON = "groupanonymousbot";

export function isOfficialBotUsername(name) {
  return String(name || "").replace(/^@/, "").toLowerCase() === OFFICIAL_BOT_USERNAME.toLowerCase();
}

export function commandTargetsThisBot(text, msg) {
  const raw = String(text || "").trim();
  const entities = Array.isArray(msg?.entities) ? msg.entities : [];
  const cmd = entities.find((e) => e?.type === "bot_command" && Number(e.offset) === 0);
  const token = cmd
    ? raw.slice(Number(cmd.offset) || 0, (Number(cmd.offset) || 0) + Number(cmd.length || 0))
    : raw.split(/\s+/)[0] || "";
  const at = token.indexOf("@");
  if (at < 0) return true;
  return isOfficialBotUsername(token.slice(at + 1));
}

export function isAddressedToOfficialBot(text, msg) {
  const t = String(text || "");
  if (new RegExp(`@${OFFICIAL_BOT_USERNAME}\\b`, "i").test(t)) return true;
  if (isOfficialBotUsername(msg?.reply_to_message?.from?.username)) return true;
  const mention = [...(msg?.entities || []), ...(msg?.caption_entities || [])].find((e) => e?.type === "mention");
  if (mention) {
    const src = String(msg?.text || msg?.caption || "");
    const hit = src.slice(Number(mention.offset) || 0, (Number(mention.offset) || 0) + Number(mention.length || 0));
    if (isOfficialBotUsername(hit)) return true;
  }
  return false;
}

export function isPublicGroupTrigger(text, msg) {
  const t = String(text || "").trim();
  if (!t) return false;
  if (t.startsWith("/")) return commandTargetsThisBot(t, msg);
  if (isAddressedToOfficialBot(t, msg)) return true;
  if (payloadExtractMint(t)) return true;
  if (/\$orbitx\b/i.test(t) && t.length < 180) return true;
  if (/^orbitx$/i.test(t)) return true;
  return false;
}

export function shouldSkipTelegramSender(msg) {
  const from = msg?.from || {};
  if (isOfficialBotUsername(from.username)) return true;
  const uname = String(from.username || "").toLowerCase();
  if (from.is_bot && uname !== GROUP_ANON && !msg?.sender_chat) return true;
  return false;
}

export function telegramChatExtras(msg) {
  const chatType = String(msg?.chat?.type || "");
  const isGroup = chatType === "group" || chatType === "supergroup";
  const extra = {};
  if (isGroup && msg?.message_id) {
    extra.reply_to_message_id = msg.message_id;
    extra.allow_sending_without_reply = true;
  }
  const thread = Number(msg?.message_thread_id);
  if (Number.isFinite(thread) && thread > 0) extra.message_thread_id = thread;
  return { isGroup, extra };
}

export function formatGroupWelcomeHtml() {
  return [
    "🚀 <b>OrbitX is in this group</b>",
    "Public — no login: drop a CA, <code>$ORBITX</code>, /token, /chart, /scan, /xray, /screen, /img, /faq",
    "Trade / shop burns: DM @theorbitxmcpbot → /login",
    "",
    "<i>Promote me to admin (or disable Group Privacy in BotFather) so I see CA pastes without an @mention.</i>",
  ].join("\n");
}

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
  if (n === "trade" || n === "swap" || n === "orbitx_trade" || n === "orbitx_swap") return true;
  if (n === "orbitx_trade_auto" || n === "orbitx_whoami") return true;
  if (n.startsWith("orbitx_mcp_access_")) return true;
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
  { command: "start", description: "OrbitX desk — coins, charts, Grok, shop" },
  { command: "help", description: "Premium command menu" },
  { command: "cmds", description: "Desk + live tool catalog" },
  { command: "menu", description: "Same as /cmds" },
  { command: "ask", description: "Ask OrbitX AI anything" },
  { command: "faq", description: "FAQ — token, MCP, burns, City" },
  { command: "links", description: "Every OrbitX URL + GC" },
  { command: "group", description: "Join t.me/orbitxwrld" },
  { command: "img", description: "Grok Imagine image" },
  { command: "vid", description: "Grok Imagine video" },
  { command: "check", description: "Countdown the latest Grok job" },
  { command: "media", description: "Poll a Grok taskId" },
  { command: "token", description: "Premium token intel card" },
  { command: "chart", description: "Live DexScreener + OrbitX DEX" },
  { command: "scan", description: "Safety + forensics overlay" },
  { command: "xray", description: "Bundles, whales, mint/freeze" },
  { command: "research", description: "Utility brief — no hopium" },
  { command: "search", description: "Find a token by ticker / CA" },
  { command: "screen", description: "Trending Solana pulse" },
  { command: "wallet", description: "Wallet holdings snapshot" },
  { command: "health", description: "OrbitX platform pulse" },
  { command: "call", description: "Call any live tool by name" },
  { command: "shop", description: "MCP seats + buy-and-burn shop" },
];

export const PRIVATE_COMMANDS = [
  ...GROUP_COMMANDS,
  { command: "login", description: "Link your OrbitX wallet" },
  { command: "auth", description: "Link your OrbitX wallet" },
  { command: "logout", description: "Unlink this Telegram account" },
  { command: "me", description: "Show linked OrbitX identity" },
  { command: "buy", description: "Prepare a token buy (linked)" },
  { command: "trade", description: "Buy a token with SOL (linked)" },
  { command: "swap", description: "Same as /trade (linked)" },
  { command: "sell", description: "Prepare a token sell (linked)" },
  { command: "tweet", description: "Post to your connected X (linked)" },
  { command: "post", description: "Post to OrbitX social (linked)" },
  { command: "launch", description: "Launch / create token (linked)" },
  { command: "mint", description: "Mint an NFT (linked)" },
  { command: "nft", description: "NFT marketplace" },
  { command: "credits", description: "Buy credits with SOL (linked)" },
  { command: "orbitx", description: "Buy $ORBITX (linked)" },
  { command: "autobuy", description: "Auto Phantom prompt on/off (linked)" },
  { command: "code", description: "Redeem an early access code" },
  { command: "burn", description: "Buy then burn $ORBITX for timed bot access" },
  { command: "access", description: "Show remaining bot access time" },
  { command: "confirm", description: "Confirm pending buy (linked)" },
  { command: "verify", description: "Verify a Solscan burn tx, or admin-verify a mint" },
];

const PRIORITY_TOOL = {
  start: null,
  help: null,
  cmds: null,
  menu: null,
  links: null,
  group: null,
  gc: null,
  check: null,
  login: null,
  auth: null,
  logout: null,
  me: null,
  verify: null,
  code: null,
  burn: null,
  access: null,
  ask: null,
  faq: null,
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
  trade: "orbitx_prepare_buy",
  swap: "orbitx_prepare_buy",
  sell: "orbitx_prepare_sell",
  shop: "orbitx_shop",
  mint: "orbitx_mint_nft",
  nft: "orbitx_nft_listings",
  credits: "orbitx_credits_buy",
  orbitx: "orbitx_buy_orbitx",
  autobuy: null,
  confirm: "orbitx_confirm_buy",
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
  const prefixed = c.startsWith("orbitx_") || c.startsWith("x_") ? c : `orbitx_${c}`;
  const aliased = applyTelegramAlias(prefixed);
  return { kind: "tool", command: c, tool: aliased || prefixed };
}

export const DEFAULT_TELEGRAM_BUY_SOL = 0.05;
const MINT_COMMANDS = ["token", "chart", "xray", "research", "scan", "buy", "sell", "trade", "swap"];
const BUY_COMMANDS = ["buy", "trade", "swap"];
const BUY_TOOLS = new Set([
  "orbitx_prepare_buy",
  "orbitx_buy",
  "orbitx_buy_auto",
  "orbitx_trade",
  "orbitx_swap",
  "orbitx_buy_orbitx",
]);

export function applyDefaultBuyAmount(tool, args) {
  const next = { ...(args || {}) };
  if (!BUY_TOOLS.has(String(tool || "").trim())) return next;
  if (next.amountUsd != null && Number(next.amountUsd) > 0) return next;
  const n = Number(next.amountSol);
  if (!Number.isFinite(n) || n <= 0) next.amountSol = DEFAULT_TELEGRAM_BUY_SOL;
  return next;
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
  if (command === "check" && rest && !args.taskId) args.taskId = rest.split(/\s+/)[0];
  if (
    (MINT_COMMANDS.includes(command) || command === "orbitx") &&
    rest &&
    !args.mint
  ) {
    const token = rest.split(/\s+/)[0];
    if (PAYLOAD_CA_RE.test(token) && token.length >= 32) {
      args.mint = token;
      args.ca = token;
    }
  }
  if (BUY_COMMANDS.includes(command) && rest && args.amountSol == null && args.amountUsd == null) {
    const parts = rest.split(/\s+/);
    const maybeAmount = parts.find((part) => {
      if (PAYLOAD_CA_RE.test(part) && part.length >= 32) return false;
      if (/\$/.test(part) || /usd|usdc/i.test(part)) return false;
      const n = Number(part);
      return Number.isFinite(n) && n > 0;
    });
    if (maybeAmount) args.amountSol = Number(maybeAmount);
  }
  if (["buy", "sell", "trade", "swap", "orbitx", "credits", "shop", "launch", "mint"].includes(command)) {
    const intent = parseTradeIntent(text);
    if (intent?.args) Object.assign(args, intent.args);
    if (intent?.tool && ["buy", "sell", "trade", "swap", "orbitx"].includes(command)) {
      args.__resolvedTool = intent.tool;
    }
  }
  if (command === "search" && rest && !args.q) {
    args.q = rest;
    args.query = rest;
  }
  if (command === "wallet" && rest && !args.address) {
    args.address = rest.split(/\s+/)[0];
    args.publicKey = args.address;
  }
  if (command === "verify" && rest && !args.mint) {
    args.signature = rest;
    const token = rest.split(/\s+/)[0];
    args.mint = token;
    args.ca = token;
  }
  if (command === "faq" && rest && !args.q) args.q = rest;
  if (command === "screen" && !args.chain) args.chain = "solana";
  return args;
}

export function parseCallInvocation(text) {
  const rest = String(text || "").replace(/^\/call(@\w+)?\s*/i, "").trim();
  if (!rest) return { tool: "", args: {} };
  const sp = rest.indexOf(" ");
  const raw = sp < 0 ? rest : rest.slice(0, sp);
  const prefixed = raw.startsWith("orbitx_") || raw.startsWith("x_") || raw === "search" || raw === "fetch" ? raw : `orbitx_${raw}`;
  const tool = applyTelegramAlias(prefixed);
  const args = parseCallArgs(sp < 0 ? "" : rest.slice(sp + 1));
  return { tool, args };
}

export function inferPublicTool(text) {
  const t = String(text || "").trim();
  const lower = t.toLowerCase();
  if (!t || t.startsWith("/")) return null;

  if (
    /^(links?|urls?|socials?|community|group chat|\bgc\b)\b/i.test(t) ||
    (t.length < 120 && /\b(telegram (group|gc|chat)|join (the )?group|orbitx links?)\b/i.test(lower))
  ) {
    return { meta: "links" };
  }

  if (/^(check|status|poll)\b/i.test(lower) && t.length < 80 && !extractMint(t)) {
    return { meta: "check" };
  }

  if (/^(cmds|commands|menu|tools)\b/i.test(lower) && t.length < 40) {
    return { meta: "cmds" };
  }

  if (/^(faq|faqs)\b/i.test(lower) && t.length < 120) {
    return { meta: "faq", args: { q: t.replace(/^(?:faq|faqs)\b[:\s-]*/i, "").trim() } };
  }

  const trade = parseTradeIntent(t);
  if (trade?.meta === "autobuy") return trade;
  if (trade?.tool) return { tool: trade.tool, args: trade.args || {} };

  const img = lower.match(/^(?:generate |make |create )?(?:an? )?(?:image|img|picture|art)\b[:\s-]*(.+)$/i);
  if (img?.[1]) return { tool: "orbitx_generate_image", args: { prompt: img[1].trim() } };

  const vid = lower.match(/^(?:generate |make |create )?(?:an? )?(?:video|vid|clip)\b[:\s-]*(.+)$/i);
  if (vid?.[1]) return { tool: "orbitx_generate_video", args: { prompt: vid[1].trim() } };

  const chart = t.match(/\b(?:chart|dex)\b[\s\S]*?\b(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})\b/i);
  if (chart) return { tool: "orbitx_dex_chart", args: { ca: chart[1], mint: chart[1] } };

  const mint = extractMint(t);
  if (mint) return { tool: "orbitx_get_token", args: { mint } };
  if (/^\$orbitx\b/i.test(t) || /^orbitx$/i.test(t)) {
    return { tool: "orbitx_get_token", args: { mint: ORBITX_MINT } };
  }

  return null;
}

export const CA_RE = PAYLOAD_CA_RE;
export const TOKEN_INTEL_TOOLS = CARD_TOKEN_INTEL_TOOLS;

export function extractMint(text) {
  return payloadExtractMint(text);
}

const ADMIN_WALLETS_BASE = [
  "4xT5QZnwtdZKAW5ZcRziEakTwNdnfKMgp1cEVaJmewxd",
  "45YR6fWxtc8uceNazGKMoX2KgK698rQsnPN4x8vD2VrE",
  "jYbHk588JspmzG5ibjPpKpCrjNP7epAjBT8Syvu7GUb",
  "CicbPxARTDrwQ4XcxWsn6SYeG4FMJHirS633cZUJeQDh",
];

export function isTelegramAdminWallet(wallet) {
  const addr = String(wallet || "").trim();
  if (!addr) return false;
  const extra = String(process.env.ORBITX_TELEGRAM_ADMIN_WALLETS || "")
    .split(/[,\s]+/)
    .map((w) => w.trim())
    .filter(Boolean);
  const pool = [...ADMIN_WALLETS_BASE, ...extra];
  return pool.some((w) => w === addr || w.toLowerCase() === addr.toLowerCase());
}

export function unwrapToolPayload(result) {
  return payloadUnwrap(result);
}

export function mergeTokenScanPayloads({ token, xray, forensics, boosts, verified } = {}) {
  const raw = unwrapToolPayload(token);
  const base = raw && typeof raw === "object" && !Array.isArray(raw) ? { ...raw } : {};
  const xr = unwrapToolPayload(xray);
  const fo = unwrapToolPayload(forensics);
  if (base.error && ((xr && xr.mint) || (fo && fo.mint) || base.token)) delete base.error;
  const boostPayload = unwrapToolPayload(boosts);
  const mint = String(base.mint || base.token?.mint || fo?.mint || xr?.mint || "").trim();
  if (mint && !base.mint) base.mint = mint;
  const rows = Array.isArray(boostPayload?.boosts)
    ? boostPayload.boosts
    : Array.isArray(boostPayload)
      ? boostPayload
      : [];
  const mine = mint
    ? rows.filter((row) => String(row.mint || "").toLowerCase() === mint.toLowerCase())
    : [];
  return {
    ...base,
    mint: mint || base.mint,
    xray: xr && typeof xr === "object" ? xr : base.xray,
    forensics: fo && typeof fo === "object" ? fo : base.forensics,
    boosts: mine.length ? mine : base.boosts || [],
    orbitxVerified: verified || base.orbitxVerified || null,
  };
}

export function mediaEtaSeconds(kind) {
  return payloadMediaEtaSeconds(kind);
}

export function formatTokenCard(raw) {
  return formatTokenCardImpl(raw);
}

export function formatOrbitXTelegramResult(result, tool) {
  return formatResultImpl(result, tool);
}

export function cmdsPage(tools, opts = {}) {
  return cmdsPageImpl(tools, { ...opts, isPrivileged: isPrivilegedTelegramTool });
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
  push(data?.meta?.openGraph);
  push(data?.meta?.banner);
  push(data?.token?.icon);
  push(data?.icon);
  if (Array.isArray(result?.urls)) result.urls.forEach(push);
  if (Array.isArray(result?.resultUrls)) result.resultUrls.forEach(push);
  if (Array.isArray(data?.resultUrls)) data.resultUrls.forEach(push);
  if (Array.isArray(result?.imageUrls)) result.imageUrls.forEach(push);
  if (Array.isArray(data?.imageUrls)) data.imageUrls.forEach(push);
  if (Array.isArray(result?.images)) {
    for (const im of result.images) push(typeof im === "string" ? im : im?.url);
  }
  if (Array.isArray(data?.images)) {
    for (const im of data.images) push(typeof im === "string" ? im : im?.url);
  }
  return urls;
}

export function loginCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export {
  deskKeyboard,
  formatFamilyMenu,
  formatHelpDesk,
  formatTelegramStartGate,
  formatMediaCountdown,
  formatToolMenu,
  missingToolInput,
  telegramMessageParts,
};

export {
  formatOrbitXFaqHtml,
  orbitXFaqSystemAddon,
  ORBITX_FAQ_CHUNKS,
  ORBITX_FAQ_CORE,
  ORBITX_FAQ_SECTIONS,
  selectOrbitXFaqChunks,
} from "./orbitx-faq-training.js";
export { formatMcpResultForTelegram, parseCallArgs, toolToSlashCommand };
