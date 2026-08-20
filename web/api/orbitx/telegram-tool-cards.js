/**
 * Premium Telegram menus + result cards for the official OrbitX bot.
 * Token intel follows the OrbitX Token Intel Bot card spec (HTML for Telegram).
 */
import { toolToSlashCommand, formatMcpResultForTelegram } from "./telegram-mcp-allowlist.js";
import {
  asTokenRecord,
  extractMint,
  fmtClock,
  fmtInt,
  fmtPct,
  fmtPrice,
  fmtSupply,
  fmtUsd,
  kolRows,
  mediaEtaSeconds,
  shortAddr,
  telegramMessageParts,
  tgEsc,
  unwrapToolPayload,
  CA_RE,
} from "./telegram-payload.js";
import { ORBITX_GC, ORBITX_HOST, ORBITX_MINT } from "./orbitx-telegram-knowledge.js";
import { hasMarketSnapshot } from "./telegram-token-snapshot.js";

export { telegramMessageParts };

/** Sign URLs stay on OrbitX / Jupiter — never wrap in Phantom Connect browse UL. */
export function phantomBrowseUrl(url, _ref = "orbitx") {
  return String(url || "").trim();
}

const JUPITER_TOKEN = "https://jup.ag/tokens/";
const JUPITER_SWAP = "https://jup.ag/swap/SOL-";
const BIRDEYE = "https://birdeye.so/token/";
const SOLSCAN = "https://solscan.io/token/";
const DEXSCREENER = "https://dexscreener.com/";
const TOKEN_2022_PROG = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export const TOKEN_INTEL_TOOLS = new Set([
  "orbitx_get_token",
  "orbitx_crypto_scan",
  "orbitx_xray",
  "orbitx_research",
  "orbitx_get_forensics",
  "orbitx_get_ath",
  "orbitx_get_safety",
  "orbitx_get_metadata",
]);

const FAMILY_META = {
  coins: {
    emoji: "🚀",
    title: "Token Intel",
    blurb: "Paste a CA — premium card, not a JSON dump.",
  },
  charts: {
    emoji: "📈",
    title: "Live Charts",
    blurb: "DexScreener embed + OrbitX DEX in one tap.",
  },
  scanners: {
    emoji: "📡",
    title: "Pulse / Screen",
    blurb: "Trending, new pairs, organic flow — Solana first.",
  },
  scan: {
    emoji: "🛡️",
    title: "X-ray & Forensics",
    blurb: "Mint/freeze, LP, bundles, whales, KOLs.",
  },
  wallet: {
    emoji: "👛",
    title: "Wallet Desk",
    blurb: "Holdings, PnL, swaps. Linked DMs use your wallet.",
  },
  trade: {
    emoji: "⚡",
    title: "Trade Desk",
    blurb: "DM + /login. You sign in Jupiter Wallet — OrbitX never holds keys.",
  },
  shop: {
    emoji: "🛍️",
    title: "Shop & Burns",
    blurb: "MCP seats, credits, desk SKUs. Buy-and-burn in one tx.",
  },
  media: {
    emoji: "🎬",
    title: "Grok Imagine",
    blurb: "Image / video takes a few minutes. Spam /check.",
  },
  launch: {
    emoji: "🧪",
    title: "Launchpad",
    blurb: "Free pump.fun launch. Optional orbit / obx vanity.",
  },
  social: {
    emoji: "📡",
    title: "HQ / Social",
    blurb: "Communities, feed, posts. Writes need a linked DM.",
  },
  nft: {
    emoji: "🖼️",
    title: "NFT Market",
    blurb: "Listings, mint, offers. Linked wallet signs.",
  },
  x: {
    emoji: "𝕏",
    title: "X / Twitter",
    blurb: "Connect X on orbitx.world/x then /tweet in DM.",
  },
  ai: {
    emoji: "✦",
    title: "Ask OrbitX",
    blurb: "Product FAQ, MCP, burns, City — or just talk.",
  },
  system: {
    emoji: "🩺",
    title: "Platform",
    blurb: "Health, stats, live catalog, links, GC.",
  },
};

const CORE_BLURBS = {
  orbitx_get_token: "Premium intel card — price, MC, audit, links",
  orbitx_crypto_scan: "Safety + forensics branded scan",
  orbitx_xray: "Bundles, snipers, concentration, verdict",
  orbitx_research: "Deep brief — utility if it exists, no hopium",
  orbitx_get_forensics: "Dev wallet, DEX paid, first buyer",
  orbitx_get_ath: "Real ATH from pool history",
  orbitx_get_safety: "Mint / freeze / LP lock snapshot",
  orbitx_get_metadata: "On-chain metadata + update authority",
  orbitx_dex_chart: "Live DexScreener chart + OrbitX DEX",
  orbitx_get_chart: "OHLCV candles for a mint",
  orbitx_search: "Find a token by ticker, name, or CA",
  orbitx_screen_tokens: "Trending Solana screen",
  orbitx_get_wallet: "Holdings + USD snapshot",
  orbitx_get_swaps: "Recent swaps for a wallet",
  orbitx_get_balance: "SOL + optional SPL balance",
  orbitx_get_kols: "Labeled KOL wallets",
  orbitx_get_traders: "Top traders tape",
  orbitx_get_signals: "Desk signals feed",
  orbitx_prepare_buy: "Quote a buy — you sign in Jupiter",
  orbitx_prepare_sell: "Quote a sell — you sign in Jupiter",
  orbitx_buy: "Prepare buy (alias)",
  orbitx_trade: "Buy with SOL (linked DM)",
  orbitx_swap: "Same as /trade",
  orbitx_sell: "Prepare sell",
  orbitx_buy_orbitx: "Buy $ORBITX with SOL",
  orbitx_confirm_buy: "Confirm the last quote",
  orbitx_shop: "MCP seats + credits + desk catalog",
  orbitx_credits_buy: "Top up credits with SOL",
  orbitx_credits_balance: "Credits remaining",
  orbitx_mcp_access_buy: "Burn $ORBITX for MCP days",
  orbitx_mcp_access_status: "MCP seat expiry",
  orbitx_generate_image: "Grok Imagine still",
  orbitx_generate_video: "Grok Imagine clip",
  orbitx_media_status: "Poll an image/video job",
  orbitx_execute_launch: "Launch a token (linked)",
  orbitx_create_token: "Create token metadata",
  orbitx_vanity_mint: "orbit / obx vanity mint",
  orbitx_mint_nft: "Mint an NFT (linked)",
  orbitx_nft_listings: "Live NFT listings",
  orbitx_social_feed: "HQ social feed",
  orbitx_social_post: "Post to HQ (linked)",
  orbitx_health: "OrbitX API health",
  orbitx_platform_stats: "Platform snapshot",
  orbitx_tools_help: "Catalog by family",
  orbitx_leaderboard: "Trader / token leaderboard",
  orbitx_dex_listings: "Launch / listing tape",
  orbitx_boosts: "Active DEX boosts",
  orbitx_menu: "This desk",
  search: "Search tools + tokens",
  fetch: "Fetch a search document",
};

const SLASH_ALIAS = {
  orbitx_get_token: "token",
  orbitx_dex_chart: "chart",
  orbitx_crypto_scan: "scan",
  orbitx_xray: "xray",
  orbitx_research: "research",
  orbitx_search: "search",
  orbitx_screen_tokens: "screen",
  orbitx_get_wallet: "wallet",
  orbitx_generate_image: "img",
  orbitx_generate_video: "vid",
  orbitx_media_status: "media",
  orbitx_prepare_buy: "trade",
  orbitx_prepare_sell: "sell",
  orbitx_shop: "shop",
  orbitx_buy_orbitx: "orbitx",
  orbitx_credits_buy: "credits",
  orbitx_execute_launch: "launch",
  orbitx_mint_nft: "mint",
  orbitx_nft_listings: "nft",
  orbitx_social_post: "post",
  orbitx_health: "health",
  x_post: "tweet",
};

function slashFor(tool) {
  return SLASH_ALIAS[tool] || toolToSlashCommand(tool, "agent") || String(tool || "").replace(/^orbitx_/, "");
}

function chainLabel(chain) {
  const c = String(chain || "solana").toLowerCase();
  if (c === "solana" || c === "sol") return "Solana";
  if (!c) return "Solana";
  return c.charAt(0).toUpperCase() + c.slice(1);
}

function tokenStandard(token) {
  const tags = Array.isArray(token.tags) ? token.tags.map((t) => String(t).toLowerCase()) : [];
  const prog = String(token.tokenProgram || token.programId || token.meta?.tokenProgram || "");
  if (tags.includes("token-2022") || prog === TOKEN_2022_PROG || /tokenz/i.test(prog)) return "Token-2022";
  if (tags.includes("spl") || /tokenkeg/i.test(prog)) return "SPL";
  const chain = String(token.chain || token.meta?.chain || "solana").toLowerCase();
  if (chain === "solana" || chain === "sol") return "SPL";
  return "—";
}

function organicLabel(token) {
  const raw = token.organicScoreLabel || token.organicLabel;
  if (raw && String(raw).trim()) {
    const s = String(raw).trim();
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  }
  const n = Number(token.organicScore);
  if (!Number.isFinite(n)) return "";
  if (n >= 60) return "High";
  if (n >= 30) return "Medium";
  return "Low";
}

function ageLabel(token) {
  if (token.ageDays != null && token.ageDays !== "") return `${token.ageDays}d`;
  if (token.meta?.ageDays != null) return `${token.meta.ageDays}d`;
  const created = token.createdAt || token.meta?.createdAt || token.firstPool?.createdAt;
  if (created) {
    const t = Date.parse(created);
    if (Number.isFinite(t)) return `${Math.max(0, Math.round((Date.now() - t) / 864e5))}d`;
  }
  return "";
}

function createdDate(token) {
  const created = token.createdAt || token.meta?.createdAt || token.firstPool?.createdAt;
  if (!created) return "";
  const d = new Date(created);
  if (Number.isNaN(d.getTime())) return String(created).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function preTable(rows) {
  const width = Math.max(12, ...rows.map((r) => r[0].length));
  const lines = rows.map(([k, v]) => {
    const pad = " ".repeat(Math.max(1, width - k.length + 2));
    return `${k}${pad}${v}`;
  });
  return `<pre>${tgEsc(lines.join("\n"))}</pre>`;
}

function dash(v) {
  if (v == null || v === "") return "—";
  const s = String(v).trim();
  return s || "—";
}

function authorityLine(label, revoked, activeKnown) {
  if (revoked === true) return `✅ ${label} → Revoked`;
  if (activeKnown === true || revoked === false) return `⚠️ ${label} → Active`;
  return `— ${label} → —`;
}

function href(url, label) {
  if (!url) return "";
  return `<a href="${tgEsc(url)}">${tgEsc(label)}</a>`;
}

export function classifyTool(name) {
  const n = String(name || "").trim();
  if (!n) return "system";
  if (n.startsWith("x_") || n === "orbitx_tweet") return "x";
  if ((/get_token/.test(n) || n === "orbitx_token") && !/create_token|launch/.test(n)) return "coins";
  if (TOKEN_INTEL_TOOLS.has(n) || /_(xray|research|forensics|safety|ath|metadata)(_|$)/.test(n)) return "scan";
  if (/^orbitx_(dex_chart|get_chart|chart_)/.test(n) || n.includes("embed_chart")) return "charts";
  if (/^orbitx_(screen|pulse|search)/.test(n) || n === "search") return "scanners";
  if (/^orbitx_(get_wallet|get_swaps|get_balance|wallet_)/.test(n)) return "wallet";
  if (
    /^(orbitx_)?(buy|sell|trade|swap|prepare_buy|prepare_sell|confirm_buy|buy_orbitx|buy_auto|sell_pump)/.test(n) ||
    n === "orbitx_trade_auto"
  ) {
    return "trade";
  }
  if (/shop|credits|mcp_access/.test(n)) return "shop";
  if (/generate_image|generate_video|grok_|media_status/.test(n)) return "media";
  if (/launch|create_token|vanity|create_coin/.test(n)) return "launch";
  if (/social_/.test(n)) return "social";
  if (/nft_/.test(n)) return "nft";
  if (/faq|ask|menu|tools_help/.test(n)) return "ai";
  if (/health|platform_stats|config|leaderboard|boost|listings|kols|traders|signals|launches/.test(n)) return "system";
  if (/get_token|mint/.test(n) && !/nft/.test(n)) return "coins";
  return "system";
}

export function missingToolInput(tool, args = {}) {
  const n = String(tool || "").trim();
  const mint = String(args.mint || args.ca || "").trim();
  const prompt = String(args.prompt || args.text || "").trim();
  const q = String(args.q || args.query || "").trim();
  const address = String(args.address || args.publicKey || args.wallet || "").trim();
  if (TOKEN_INTEL_TOOLS.has(n) || /^orbitx_(get_token|xray|research|crypto_scan)/.test(n) || /_(xray|research|forensics|safety|ath|metadata)_/.test(n)) {
    if (!mint) return "mint";
  }
  if (n === "orbitx_dex_chart" || n === "orbitx_get_chart" || n.startsWith("orbitx_chart_")) {
    if (!mint) return "mint";
  }
  if (["orbitx_prepare_sell", "orbitx_sell", "orbitx_sell_pump"].includes(n)) {
    if (!mint) return "mint";
  }
  if (n === "orbitx_generate_image" || n === "orbitx_generate_video" || n === "orbitx_grok_image" || n === "orbitx_grok_video") {
    if (!prompt) return "prompt";
  }
  if (n === "orbitx_get_wallet" || n === "orbitx_get_swaps" || n === "orbitx_get_balance" || n.startsWith("orbitx_wallet_")) {
    if (!address) return "address";
  }
  if (n === "orbitx_search" || n.startsWith("orbitx_search_") || n === "search") {
    if (!q && !mint) return "query";
  }
  if ((n === "orbitx_social_post" || n === "x_post") && !prompt && !q) return "text";
  return null;
}

function inlineKeyboard(rows) {
  const keyboard = rows
    .map((row) => row.filter(Boolean))
    .filter((row) => row.length);
  if (!keyboard.length) return undefined;
  return { inline_keyboard: keyboard };
}

export function deskKeyboard() {
  return inlineKeyboard([
    [
      { text: "🚀 Coins", callback_data: "ox:coins" },
      { text: "📈 Charts", callback_data: "ox:charts" },
    ],
    [
      { text: "🛡️ Scan", callback_data: "ox:scan" },
      { text: "📡 Pulse", callback_data: "ox:scanners" },
    ],
    [
      { text: "🎬 Grok", callback_data: "ox:media" },
      { text: "🛍️ Shop", callback_data: "ox:shop" },
    ],
    [
      { text: "⚡ Trade", callback_data: "ox:trade" },
      { text: "👛 Wallet", callback_data: "ox:wallet" },
    ],
    [
      { text: "🧪 Launch", callback_data: "ox:launch" },
      { text: "✦ FAQ", callback_data: "ox:ai" },
    ],
    [
      { text: "🔗 Links", callback_data: "ox:links" },
      { text: "🩺 Health", callback_data: "ox:system" },
    ],
  ]);
}

export function startGateKeyboard({ unlocked = false } = {}) {
  const rows = [
    [{ text: "I have a code", callback_data: "ox:gate:code" }],
    [
      { text: "Burn 1 hour · 100", callback_data: "ox:gate:hour" },
      { text: "Burn 1 day · 1k", callback_data: "ox:gate:day" },
    ],
    [
      { text: "Burn 1 week · 10k", callback_data: "ox:gate:week" },
      { text: "Burn 1 month · 1000k", callback_data: "ox:gate:month" },
    ],
    [{ text: "Link wallet /login", callback_data: "ox:gate:login" }],
    [{ text: "Start over /reset", callback_data: "ox:gate:reset" }],
  ];
  if (unlocked) {
    rows.push([{ text: "Desk", callback_data: "ox:desk" }]);
  }
  return inlineKeyboard(rows);
}

export function formatTelegramStartGate({ remainingLabel = "", linked = false, unlocked = false } = {}) {
  const accessLine = remainingLabel
    ? `Access: <b>${tgEsc(remainingLabel)}</b>`
    : "";
  const text = [
    "Welcome to the <b>OrbitX MCP bot</b> on Telegram.",
    "",
    "This bot is locked. Type the <b>access code you received from us</b>, then <code>/login</code>. We never print that code here.",
    "",
    "Lifetime MCP is limited to the first 25 codes we issued.",
    "",
    "Or burn $ORBITX for timed access:",
    "",
    "• <b>1 hour</b> — 100 $ORBITX",
    "• <b>1 day</b> — 1,000 $ORBITX",
    "• <b>1 week</b> — 10,000 $ORBITX",
    "• <b>1 month</b> — 1,000,000 $ORBITX",
    "",
    "Tap <b>I have a code</b> and paste it, or tap a burn. After a burn, copy the Solscan link and send <code>/verify</code> plus that link.",
    "<code>/reset</code> logs out and starts you as a fresh user.",
    linked ? "" : "Burns need <code>/login</code> first so the tx is YOUR wallet.",
    accessLine,
    "",
    `${href(ORBITX_GC, "Community GC")} · ${href(ORBITX_HOST, "orbitx.world")}`,
  ]
    .filter((line, i, arr) => line !== "" || arr[i - 1] !== "")
    .join("\n");
  return { text, reply_markup: startGateKeyboard({ unlocked }) };
}

export function formatTelegramGroupLockHtml() {
  return [
    "This bot is <b>locked</b>.",
    "DM @theorbitxmcpbot, type the access code you received from us, then <code>/login</code>.",
  ].join("\n");
}

function familyKeyboard(family) {
  return inlineKeyboard([
    [
      { text: "⌂ Desk", callback_data: "ox:desk" },
      { text: "🚀 Coins", callback_data: "ox:coins" },
      { text: "📈 Charts", callback_data: "ox:charts" },
    ],
    family === "trade"
      ? [
          { text: "🛍️ Shop", callback_data: "ox:shop" },
          { text: "👛 Wallet", callback_data: "ox:wallet" },
        ]
      : [
          { text: "🎬 Grok", callback_data: "ox:media" },
          { text: "🛍️ Shop", callback_data: "ox:shop" },
        ],
  ]);
}

export function tokenCardKeyboard(mint, chain = "solana") {
  const m = String(mint || "").trim();
  if (!m) return deskKeyboard();
  const c = encodeURIComponent(chain || "solana");
  const enc = encodeURIComponent(m);
  return inlineKeyboard([
    [
      { text: "Buy 0.05 SOL", callback_data: `ox:buy:${m}` },
      { text: "Sell 100%", callback_data: `ox:sell:${m}` },
    ],
    [
      { text: "DexScreener", url: `${DEXSCREENER}${c}/${enc}` },
      { text: "Jupiter", url: `${JUPITER_SWAP}${enc}` },
    ],
    [
      { text: "Birdeye", url: `${BIRDEYE}${enc}?chain=solana` },
      { text: "Solscan", url: `${SOLSCAN}${enc}` },
    ],
    [
      { text: "OrbitX DEX", url: `${ORBITX_HOST}/ORBITX_DEX/token/${enc}` },
      { text: "Chart", callback_data: `ox:chart:${m.slice(0, 44)}` },
    ],
  ]);
}

function orbitxProjectSummary() {
  return {
    lines: [
      "On-chain OS for Solana — forensic DEX intel, launchpad, City, Play, HQ, and MCP agents under one wallet identity.",
      "Not a scanner skin. Live products at https://www.orbitx.world. Non-custodial — you always sign.",
    ],
    utility: [
      "Hold ≥ $5 USD of $ORBITX → OrbitX AI + basic MCP",
      "Hold 10,000 $ORBITX → Pro / KOL DEX layer",
      "Burn 100 $ORBITX = 1 hour · 1,000 = 1 day · 10,000 = 1 week · 1,000,000 = 1 month (stackable)",
      "Shop: one Jupiter tx buys $ORBITX and burns it in the same transaction",
    ],
  };
}

function projectSummaryFromPayload(token, data) {
  const mint = String(token.mint || "");
  if (mint === ORBITX_MINT) return orbitxProjectSummary();
  const bits = [
    token.description,
    token.meta?.description,
    data?.description,
    data?.xray?.summary,
    data?.research?.summary,
    data?.intel?.summary,
  ]
    .map((s) => (s == null ? "" : String(s).trim()))
    .filter((s) => s && s.length > 12 && !/^error/i.test(s));
  if (!bits.length) return null;
  const lines = bits[0]
    .split(/(?<=[.!?])\s+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, 3);
  const utility = [];
  const burn = token.audit?.devMints != null ? null : null;
  void burn;
  if (Array.isArray(token.tokenomics)) {
    for (const row of token.tokenomics.slice(0, 4)) {
      const line = typeof row === "string" ? row : row?.text || row?.label;
      if (line) utility.push(String(line));
    }
  }
  return { lines, utility };
}

export function formatTokenCard(raw) {
  const data = unwrapToolPayload(raw);
  const token = asTokenRecord(data);
  if (!token) return null;
  if (!hasMarketSnapshot(token)) return null;
  const mint = String(token.mint || "");
  const symbol = String(token.symbol || "").trim();
  const name = String(token.name || symbol || "").trim();
  const displayName = name && !/^token$/i.test(name) ? name : symbol && !/^token$/i.test(symbol) ? symbol : shortAddr(mint) || "Unknown";
  const displaySymbol = symbol && !/^token$/i.test(symbol) ? symbol : displayName;
  const chain = String(token.chain || token.meta?.chain || "solana");
  const age = ageLabel(token);
  const standard = tokenStandard(token);
  const audit = token.audit && typeof token.audit === "object" ? token.audit : {};
  const meta = token.meta && typeof token.meta === "object" ? token.meta : {};
  const xray = data?.xray && typeof data.xray === "object" ? data.xray : {};
  const forensics = data?.forensics && typeof data.forensics === "object" ? data.forensics : {};
  const intel = data?.intel && typeof data.intel === "object" ? data.intel : {};
  const holders = Array.isArray(intel.holders) ? intel.holders : Array.isArray(xray.holders) ? xray.holders : [];
  const mcap = token.mcap ?? token.fdv;
  const vol = token.volume ?? token.stats?.["24h"]?.volume;
  const holderCount = token.holderCount ?? xray.concentration?.totalHolders ?? forensics.concentration?.totalHolders;
  const holderDelta = token.holderChange24h ?? token.stats?.["24h"]?.holderChange;
  const topPct =
    audit.topHoldersPercentage ??
    xray.concentration?.top10Pct ??
    forensics.concentration?.top10Pct;
  const organic = organicLabel(token);
  const mintRevoked = audit.mintAuthorityDisabled === true || xray.safety?.mintRenounced === true;
  const mintActive =
    xray.safety?.mintRenounced === false ||
    (audit.mintAuthorityDisabled === false && xray.safety?.mintRenounced !== true);
  const freezeRevoked = audit.freezeAuthorityDisabled === true || xray.safety?.freezeRenounced === true;
  const freezeActive =
    xray.safety?.freezeRenounced === false ||
    (audit.freezeAuthorityDisabled === false && xray.safety?.freezeRenounced !== true);
  const lpPct = xray.safety?.lpLockedPct ?? forensics.safety?.lpLockedPct ?? token.lpLockedPct;
  const dev = forensics.dev || xray.dev || (token.dev && typeof token.dev === "object" ? token.dev : null);
  const devPct = audit.devBalancePercentage ?? dev?.holding?.pct ?? dev?.pct ?? null;
  const pair = token.firstPool?.id || token.pairAddress || token.pair || meta.pair || "";
  const supply = token.circSupply ?? token.totalSupply ?? meta.supply;
  const decimals = token.decimals ?? meta.decimals;
  const socials = meta.socials || token.socials || {};
  const site = socials.website || socials.site || token.website || "";
  const verified = data?.orbitxVerified;
  const jupVerified = token.isVerified || meta.isVerifiedJup;

  const header =
    `🚀 <b>${tgEsc(displayName)}</b> · $${tgEsc(displaySymbol)}` +
    (verified ? " · ✓ OrbitX Verified" : "") +
    (jupVerified ? " · Jup" : "");
  const sub = `🌐 <b>${tgEsc(chainLabel(chain))}</b> · ${tgEsc(standard)}${age ? ` · <b>${tgEsc(age)}</b>` : ""}`;

  const holderCell =
    holderCount != null
      ? `${fmtInt(holderCount)}${holderDelta != null && holderDelta !== "" ? `  ${fmtPct(holderDelta)}` : ""}`
      : "—";

  const snapshot = preTable([
    ["Price", fmtPrice(token.priceUsd ?? token.price)],
    ["Market Cap", fmtUsd(mcap)],
    ["Liquidity", fmtUsd(token.liquidity)],
    ["24h Volume", fmtUsd(vol)],
    ["Holders", holderCell],
  ]);

  const ch = (label, value, strong) => {
    const shown = fmtPct(value);
    const body = strong && shown !== "—" ? `<b>${tgEsc(shown)}</b>` : tgEsc(shown);
    return `<code>${tgEsc(label)}</code> ${body}`;
  };
  const priceAction = [
    ch("5m", token.change5m ?? token.stats?.["5m"]?.priceChange, false),
    ch("1h", token.change1h ?? token.stats?.["1h"]?.priceChange, true),
    ch("6h", token.change6h ?? token.stats?.["6h"]?.priceChange, true),
    ch("24h", token.change24h ?? token.stats?.["24h"]?.priceChange, true),
  ].join(" · ");

  let lpLine = "— LP Locked → —";
  if (lpPct != null && lpPct !== "") {
    const n = Number(lpPct);
    if (Number.isFinite(n)) {
      if (n >= 90) lpLine = "✅ LP Locked → Yes";
      else if (n > 0) lpLine = `⚠️ LP Locked → ${n.toFixed(0)}%`;
      else lpLine = "⚠️ LP Locked → No";
    }
  }

  const sec = [
    authorityLine("Mint Authority", mintRevoked, mintActive && !mintRevoked),
    authorityLine("Freeze Authority", freezeRevoked, freezeActive && !freezeRevoked),
    topPct != null && topPct !== ""
      ? `${Number(topPct) >= 40 ? "⚠️" : "✅"} Top Holders → ${Number(topPct).toFixed(1)}%`
      : "— Top Holders → —",
    organic ? `${/low/i.test(organic) ? "⚠️" : "✅"} Organic Score → ${organic}` : "— Organic Score → —",
    lpLine,
    devPct != null && devPct !== ""
      ? `${Number(devPct) > 5 ? "⚠️" : "✅"} Dev Holdings → ${Number(devPct).toFixed(2)}%`
      : "— Dev Holdings → Unknown",
  ];

  const whales = xray.concentration?.whales ?? forensics.concentration?.whales;
  const bundlePct = xray.bundles?.pct ?? xray.counts?.bundlePct;
  const bundleCount = xray.bundles?.count ?? xray.counts?.bundles ?? (Array.isArray(xray.bundles) ? xray.bundles.length : null);
  const boosts = Array.isArray(data?.boosts) ? data.boosts : [];
  const dexPaid =
    forensics.dexPaid?.paid === true ||
    (Array.isArray(forensics.dexPaid?.services) && forensics.dexPaid.services.some((s) => s.status === "approved"));
  const extras = [];
  if (xray.verdict) extras.push(`Verdict → ${xray.verdict}`);
  const hasHolderSample = holders.length > 0 || xray.concentration?.totalHolders != null || xray.concentration?.top10Pct != null;
  if (hasHolderSample && whales != null) extras.push(`Whales → ${whales} wallets ≥1%`);
  if (bundleCount != null || bundlePct != null) {
    extras.push(
      `Bundles → ${bundleCount != null ? bundleCount : "—"}${typeof bundlePct === "number" ? ` · ${bundlePct}% early` : ""}`,
    );
  }
  const kols = kolRows(holders);
  if (kols.length) {
    extras.push(`KOLs → ${kols.slice(0, 3).map((k) => k.name || k.twitter || k.handle || shortAddr(k.owner)).join(" · ")}`);
  }
  if (boosts.length) extras.push(`Boosts → ${boosts.map((b) => b.tier || b.label || "active").join(" · ")}`);
  if (dexPaid) extras.push("DEX paid → Yes");

  const dex = mint ? `${DEXSCREENER}${encodeURIComponent(chain)}/${encodeURIComponent(mint)}` : "";
  const jup = mint ? `${JUPITER_TOKEN}${encodeURIComponent(mint)}` : "";
  const bird = mint ? `${BIRDEYE}${encodeURIComponent(mint)}?chain=solana` : "";
  const scan = mint ? `${SOLSCAN}${encodeURIComponent(mint)}` : "";
  const linkBits = [
    href(dex, "DexScreener"),
    href(jup, "Jupiter"),
    href(bird, "Birdeye"),
    href(scan, "Solscan"),
    mint ? href(`${ORBITX_HOST}/ORBITX_DEX/token/${encodeURIComponent(mint)}`, "OrbitX DEX") : "",
    site ? href(site, "Official Site") : "",
  ].filter(Boolean);

  const summary = projectSummaryFromPayload(token, data);

  const metaLines = [
    `Age: ${age || "—"} | Standard: ${standard}`,
    `Supply: ${fmtSupply(supply)} | Decimals: ${decimals != null && decimals !== "" ? decimals : "—"}`,
  ];
  const created = createdDate(token);
  if (created) metaLines.push(`Created: ${created}`);
  if (pair) metaLines.push(`Pair: ${pair}`);
  const athMcap = data?.athMcap ?? meta.athMcap ?? token.athMcap;
  const athPrice = data?.athPrice ?? meta.athPrice ?? token.athPrice;
  if (athPrice != null || athMcap != null) {
    metaLines.push(`ATH: ${fmtPrice(athPrice)} · ${fmtUsd(athMcap)}`);
  }

  const lines = [
    header,
    sub,
    "",
    "<b>💰 Market Snapshot</b>",
    snapshot,
    "",
    "<b>Price Action</b>",
    priceAction,
    "",
    "<b>🛡️ Security &amp; Audit</b>",
    ...sec.map((s) => `• ${s}`),
  ];

  if (extras.length) {
    for (const extra of extras.filter(Boolean)) lines.push(`• ${tgEsc(extra)}`);
  }

  lines.push("", "<b>🔗 Contract &amp; Links</b>");
  if (mint) lines.push(`<code>${tgEsc(mint)}</code>`);
  lines.push("<b>Quick Links</b>");
  if (linkBits.length) lines.push(linkBits.join(" · "));

  if (summary?.lines?.length) {
    lines.push("", "<b>ℹ️ Project Summary</b>", ...summary.lines.map((l) => tgEsc(l)));
    if (summary.utility?.length) {
      lines.push("", "<b>Key Utility / Tokenomics</b>", ...summary.utility.map((l) => `• ${tgEsc(l)}`));
    }
  }

  lines.push("", "<pre>📊 Meta\n" + tgEsc(metaLines.join("\n")) + "</pre>");

  const text = lines.filter((line, i, arr) => line !== "" || arr[i - 1] !== "").join("\n");
  return { text, reply_markup: tokenCardKeyboard(mint, chain) };
}

function formatDexChartCard(data) {
  if (!data || typeof data !== "object") return null;
  if (!(data.embedUrl || data.action === "dex_chart_embed" || (data.pageUrl && data.symbol && data.pairAddress))) {
    return null;
  }
  const symbol = data.symbol || "TOKEN";
  const name = data.name || symbol;
  const mint = data.mint || data.ca || "";
  const dex = data.embedUrl || data.pageUrl;
  const orbitx = data.orbitxDex || (mint ? `${ORBITX_HOST}/ORBITX_DEX/token/${mint}` : `${ORBITX_HOST}/ORBITX_DEX`);
  const text = [
    `📈 <b>$${tgEsc(symbol)}</b> · ${tgEsc(name)}`,
    `🌐 <b>${tgEsc(chainLabel(data.chain || "solana"))}</b> · live DexScreener`,
    "",
    "<b>💰 Tape</b>",
    preTable([
      ["Price", fmtPrice(data.priceUsd ?? data.price)],
      ["Market Cap", fmtUsd(data.marketCap ?? data.mcap)],
      ["Liquidity", fmtUsd(data.liquidityUsd ?? data.liquidity)],
      ["24h Volume", fmtUsd(data.volume24h ?? data.volume)],
      ["24h", fmtPct(data.change24h)],
    ]),
    mint ? `<code>${tgEsc(mint)}</code>` : "",
    [href(dex, "DexScreener live chart"), href(orbitx, "Trade on OrbitX DEX")].filter(Boolean).join(" · "),
  ]
    .filter(Boolean)
    .join("\n");
  return { text, reply_markup: mint ? tokenCardKeyboard(mint, data.chain || "solana") : deskKeyboard() };
}

function formatTokenList(raw, title = "Pulse") {
  const data = unwrapToolPayload(raw);
  const items = Array.isArray(data)
    ? data
    : Array.isArray(data?.tokens)
      ? data.tokens
      : Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.holdings)
            ? null
            : null;
  if (!items?.length) return null;
  if (!asTokenRecord(items[0]) && !(items[0]?.symbol || items[0]?.mint)) return null;
  const rows = items.slice(0, 12).map((item, i) => {
    const token = asTokenRecord(item) || item || {};
    const sym = token.symbol || token.name || shortAddr(token.mint) || `row ${i + 1}`;
    const price = token.priceUsd ?? token.price;
    const ch = token.change24h ?? token.priceChange24h ?? token.stats?.["24h"]?.priceChange;
    const mc = token.mcap ?? token.fdv ?? token.marketCap;
    return `${i + 1}. <b>$${tgEsc(sym)}</b>  ${tgEsc(fmtUsd(price))}  ${tgEsc(fmtPct(ch))}  MC ${tgEsc(fmtUsd(mc))}`;
  });
  return {
    text: [`📡 <b>${tgEsc(title)}</b> · ${items.length} tokens`, "", ...rows, "", "Tap a CA with /token for the full intel card."].join("\n"),
    reply_markup: inlineKeyboard([
      [
        { text: "🚀 Coins", callback_data: "ox:coins" },
        { text: "📈 Charts", callback_data: "ox:charts" },
      ],
    ]),
  };
}

function formatWalletCard(data) {
  if (!data || typeof data !== "object") return null;
  const holdings = Array.isArray(data.holdings) ? data.holdings : Array.isArray(data.tokens) ? data.tokens : null;
  const address = data.address || data.publicKey || data.wallet || data.owner;
  if (!holdings && data.sol == null && !address) return null;
  if (!holdings && !address) return null;
  if (asTokenRecord(data) && !holdings) return null;
  const sol = data.sol ?? data.solBalance ?? data.native;
  const total = data.totalUsd ?? data.navUsd ?? data.portfolioUsd;
  const lines = [
    "👛 <b>Wallet Desk</b>",
    address ? `<code>${tgEsc(address)}</code>` : "",
    "",
    preTable(
      [
        ["SOL", sol != null ? String(sol) : "—"],
        ["Nav", fmtUsd(total)],
        ["Positions", holdings ? String(holdings.length) : "—"],
      ].filter(Boolean),
    ),
  ];
  for (const h of (holdings || []).slice(0, 10)) {
    const sym = h.symbol || h.name || shortAddr(h.mint);
    lines.push(
      `• <b>${tgEsc(sym)}</b>  ${tgEsc(fmtUsd(h.usdValue))}  ${tgEsc(fmtPct(h.change24h))}  ${h.uiAmount != null ? tgEsc(Number(h.uiAmount).toPrecision(6)) : ""}`,
    );
  }
  return {
    text: lines.filter(Boolean).join("\n"),
    reply_markup: inlineKeyboard([
      [
        { text: "⚡ Trade", callback_data: "ox:trade" },
        { text: "🚀 Coins", callback_data: "ox:coins" },
      ],
    ]),
  };
}

function formatShopCard(data) {
  if (!data || typeof data !== "object") return null;
  if (!(data.shop || data.packages || data.catalog || data.openUrl?.includes("/shop"))) return null;
  const packs = Array.isArray(data.packages) ? data.packages : [];
  const lines = [
    "🛍️ <b>OrbitX Shop</b>",
    "Burn $ORBITX for seats. Credits buy with SOL. One signature — Jupiter buy + burn.",
    "",
  ];
  if (packs.length) {
    lines.push("<b>MCP rails</b>");
    for (const p of packs) {
      lines.push(`• <b>${tgEsc(p.title || p.id)}</b> — ${tgEsc(p.cost || p.price || "")}`);
    }
  }
  if (data.message) lines.push("", tgEsc(data.message));
  if (data.note) lines.push(`<i>${tgEsc(data.note)}</i>`);
  lines.push(
    "",
    "/shop hour · /shop day · /shop week · /shop month · /credits 0.1 sol",
    href(data.openUrl || `${ORBITX_HOST}/shop`, "Open full desk shop"),
  );
  return {
    text: lines.filter(Boolean).join("\n"),
    reply_markup: inlineKeyboard([
      [
        { text: "Open shop", url: data.openUrl || `${ORBITX_HOST}/shop` },
        { text: "Community GC", url: ORBITX_GC },
      ],
      [{ text: "⌂ Desk", callback_data: "ox:desk" }],
    ]),
  };
}

function stripAutoSignQuery(raw) {
  const url = String(raw || "").trim();
  if (!url) return "";
  try {
    const next = new URL(url);
    next.searchParams.delete("auto");
    next.searchParams.delete("autoconfirm");
    return next.toString();
  } catch {
    return url.replace(/([?&])auto(?:confirm)?=[^&]*/gi, "$1").replace(/[?&]$/, "");
  }
}

function formatActionLinks(data) {
  const urls = [];
  const sign = stripAutoSignQuery(data?.signUrl || data?.openUrl || "");
  if (sign) urls.push(["Sign", sign]);
  if (data?.reportUrl) urls.push(["Report", data.reportUrl]);
  if (data?.launchpadUrl) urls.push(["Launchpad", data.launchpadUrl]);
  if (data?.mcpUrl) urls.push(["MCP", data.mcpUrl]);
  if (data?.setupUrl) urls.push(["Setup", data.setupUrl]);
  if (!urls.length && !data?.instructions && !data?.message) return null;
  const lines = ["⚡ <b>Trade Desk</b>"];
  if (data.message) lines.push(tgEsc(data.message));
  if (Array.isArray(data.instructions)) {
    for (const step of data.instructions.slice(0, 6)) lines.push(`• ${tgEsc(step)}`);
  }
  for (const [label, hrefUrl] of urls) lines.push(href(hrefUrl, label));
  const buttons = urls.slice(0, 4).map(([label, url]) => ({ text: label, url }));
  return {
    text: lines.join("\n"),
    reply_markup: inlineKeyboard([buttons, [{ text: "⌂ Desk", callback_data: "ox:desk" }]]),
  };
}

const TRADE_ERR = new Set([
  "wallet_required",
  "login_required",
  "ask_amount",
  "prepare_failed",
  "amount_required",
  "amount_too_low",
  "amount_too_high",
  "invalid_amount",
  "invalid_usd",
  "sol_price_unavailable",
  "no_pending_buy",
  "mint_required",
  "token_hold_required",
  "no balance to sell",
]);

function isTradeLike(data, tool) {
  if (!data || typeof data !== "object") return false;
  const family = classifyTool(tool);
  const err = String(data.error || "").toLowerCase();
  const status = String(data.status || data.action || "").toLowerCase();
  if (data.signUrl || data.autoSignUrl) return true;
  if (data.transaction && (data.sku || data.burnRaw || data.orbitxBurned != null)) return true;
  if (status === "ask_amount" || status === "ask_package") return true;
  if (/awaiting_(auto_)?phantom/.test(status)) return true;
  if (TRADE_ERR.has(err)) return true;
  if ((family === "trade" || family === "shop") && data.requiresSignature) return true;
  if (family === "trade" && (data.amountSol != null || data.amountUsd != null || data.amount != null)) return true;
  return false;
}

function formatTradeDeskCard(data, tool) {
  if (!isTradeLike(data, tool)) return null;
  const err = String(data.error || "").toLowerCase();
  const status = String(data.status || data.action || "").toLowerCase();
  const mint = String(data.mint || data.ca || ORBITX_MINT).trim() || ORBITX_MINT;
  const wallet = String(data.wallet || data.publicKey || data.address || "").trim();
  const amountSol = data.amountSol ?? (data.denominatedInSol ? data.amount : null);
  const amountUsd = data.amountUsd;
  const solscanToken = data.solscanToken || `${SOLSCAN}${encodeURIComponent(mint)}`;
  const solscanAccount = data.solscanAccount || (wallet ? `https://solscan.io/account/${encodeURIComponent(wallet)}` : "");
  const dex = `${ORBITX_HOST}/ORBITX_DEX/token/${encodeURIComponent(mint)}`;
  const sign = stripAutoSignQuery(data.signUrl || data.openUrl || "");
  const telegramDash = `${ORBITX_HOST}/telegram`;

  if (err === "login_required") {
    return {
      text: [
        "🔒 <b>ORBITX · Sign in to trade</b>",
        "DM /login then /buy or /sell. Groups stay public — swaps are wallet-gated.",
        data.message ? `<i>${tgEsc(String(data.message).slice(0, 220))}</i>` : "",
      ]
        .filter(Boolean)
        .join("\n"),
      reply_markup: inlineKeyboard([
        [{ text: "Open bot DM", url: "https://t.me/theorbitxmcpbot" }, { text: "Link wallet", url: telegramDash }],
        [{ text: "⌂ Desk", callback_data: "ox:desk" }],
      ]),
    };
  }

  if (err === "wallet_required") {
    return {
      text: [
        "🔑 <b>ORBITX · Link Jupiter</b>",
        "Connect Jupiter Wallet on orbitx.world/telegram, then send /buy or /sell again. SOL spends from that wallet via Jupiter.",
        mint ? `<code>${tgEsc(mint)}</code>` : "",
        [href(telegramDash, "Link wallet"), href(solscanToken, "Solscan"), href(dex, "OrbitX DEX")].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("\n"),
      reply_markup: inlineKeyboard([
        [{ text: "Link Jupiter", url: telegramDash }, { text: "Solscan", url: solscanToken }],
        [{ text: "OrbitX DEX", url: dex }, { text: "⌂ Desk", callback_data: "ox:desk" }],
      ]),
    };
  }

  if (err === "token_hold_required") {
    const buyUsd = `${ORBITX_HOST}/agent/sign?action=buy&mint=${encodeURIComponent(ORBITX_MINT)}&amount=0.05`;
    return {
      text: [
        "🪙 <b>ORBITX · Hold to unlock extra tools</b>",
        tgEsc(data.message || "Hold ≥ $5 of $ORBITX for gated MCP tools. Buying $ORBITX itself does not require a hold."),
        "Tap Sign to buy $ORBITX with SOL from your linked wallet.",
        [href(buyUsd, "Sign $ORBITX buy"), href(solscanToken, "Solscan"), href(dex, "OrbitX DEX")].join(" · "),
      ].join("\n"),
      reply_markup: inlineKeyboard([
        [{ text: "Sign buy", url: buyUsd }, { text: "Solscan", url: solscanToken }],
        [{ text: "OrbitX DEX", url: dex }],
      ]),
    };
  }

  if (err === "ask_amount" || status === "ask_amount") {
    const sellHint = /sell/i.test(String(tool || "")) || String(data.action || "").toLowerCase() === "sell";
    return {
      text: [
        "💰 <b>ORBITX · How much?</b>",
        sellHint
          ? "Reply <code>/sell 100%</code> or <code>/sell 50%</code> plus the CA. Sells the bag from your linked Jupiter wallet."
          : "Reply <code>/buy 0.05</code> or <code>buy $1 $ORBITX</code>. Spends SOL from your linked Jupiter wallet.",
        [href(solscanToken, "Solscan"), href(dex, "OrbitX DEX")].join(" · "),
      ].join("\n"),
      reply_markup: inlineKeyboard([
        [{ text: "Solscan", url: solscanToken }, { text: "OrbitX DEX", url: dex }],
        [{ text: "⌂ Desk", callback_data: "ox:desk" }],
      ]),
    };
  }

  if (err === "ask_package" || status === "ask_package") {
    return {
      text: [
        "🛍️ <b>ORBITX · MCP burn</b>",
        "Reply <code>/shop hour</code> (100), <code>/shop day</code> (1,000), <code>/shop week</code> (10,000), or <code>/shop month</code> (1,000,000). One Jupiter sign buys then burns.",
        [href(solscanToken, "Solscan"), href(`${ORBITX_HOST}/shop`, "Desk shop")].join(" · "),
      ].join("\n"),
      reply_markup: inlineKeyboard([
        [{ text: "Desk shop", url: `${ORBITX_HOST}/shop` }, { text: "Solscan", url: solscanToken }],
      ]),
    };
  }

  if (err === "no balance to sell" || /no balance to sell/.test(err)) {
    return {
      text: [
        "🔴 <b>ORBITX · Nothing to sell in this wallet</b>",
        "The linked wallet holds 0 of that token. Open Sign and switch to the wallet that holds it — then approve.",
        mint ? `<code>${tgEsc(mint)}</code>` : "",
        [sign ? href(sign, "Sign") : "", href(solscanToken, "Solscan"), href(dex, "OrbitX DEX")].filter(Boolean).join(" · "),
      ]
        .filter(Boolean)
        .join("\n"),
      reply_markup: inlineKeyboard([
        [sign ? { text: "Sign", url: sign } : null, { text: "Solscan", url: solscanToken }].filter(Boolean),
        [{ text: "OrbitX DEX", url: dex }, { text: "⌂ Desk", callback_data: "ox:desk" }],
      ]),
    };
  }

  if (
    data.ok === false &&
    !sign &&
    (err === "prepare_failed" || err === "sol_price_unavailable" || err === "amount_required" || err === "no_pending_buy" || data.status === "prepare_failed")
  ) {
    return {
      text: [
        "⚠️ <b>ORBITX · Couldn't build the swap</b>",
        `<i>${tgEsc(String(data.detail || data.message || data.error || "Try /buy 0.05 or /sell 100% again."))}</i>`,
        [href(solscanToken, "Solscan"), href(dex, "OrbitX DEX")].join(" · "),
      ].join("\n"),
      reply_markup: inlineKeyboard([
        [{ text: "Solscan", url: solscanToken }, { text: "OrbitX DEX", url: dex }],
      ]),
    };
  }

  const sku = data.sku || data.package || data.packageId;
  const isBurn = Boolean(data.burnRaw || data.orbitxBurned != null || data.tokens || sku);
  const isSell =
    String(data.action || "").toLowerCase() === "sell" ||
    /sell/i.test(String(tool || "")) ||
    (typeof sign === "string" && /[?&]action=sell\b/.test(sign));
  const sellAmount = data.amount != null && data.amount !== "" ? String(data.amount) : "100%";
  const amtBits = [];
  if (amountSol != null && amountSol !== "") {
    amtBits.push(`${tgEsc(String(amountSol))} SOL`);
  }
  if (amountUsd != null && amountUsd !== "") {
    amtBits.push(`~$${tgEsc(String(Number(amountUsd).toFixed ? Number(amountUsd).toFixed(2) : amountUsd))}`);
  }
  const amtLine = isSell
    ? `Selling <b>${tgEsc(sellAmount)}</b> of this token from your linked wallet for SOL.`
    : amtBits.length
      ? `Spending <b>${amtBits.join(" ")}</b> from your linked Jupiter wallet.`
      : isBurn
        ? `One Jupiter sign ${sku ? `for <b>${tgEsc(String(sku))}</b>` : "to burn $ORBITX"} — Jupiter buy + burn in the same tx when it's a desk SKU.`
        : "Unsigned Jupiter buy is ready. Tap Sign — approve in your browser wallet.";

  const title = isSell
    ? "🔴 <b>ORBITX · Sign to sell</b>"
    : isBurn && !sign?.includes("action=buy")
      ? "🛍️ <b>ORBITX · Buy &amp; burn</b>"
      : "🟢 <b>ORBITX · Sign to buy</b>";

  const buttons = [
    sign ? { text: "Sign", url: sign } : null,
    { text: "Solscan", url: solscanToken },
    { text: "OrbitX DEX", url: dex },
  ].filter(Boolean);

  const linkLine = [
    sign ? href(sign, "Sign") : "",
    href(solscanToken, "Token on Solscan"),
    solscanAccount ? href(solscanAccount, "Wallet on Solscan") : "",
    href(dex, "OrbitX DEX"),
  ].filter(Boolean);

  return {
    text: [
      title,
      amtLine,
      data.message ? `<i>${tgEsc(String(data.message).slice(0, 280))}</i>` : "",
      data.warning && data.warning !== data.message ? `<i>${tgEsc(String(data.warning).slice(0, 180))}</i>` : "",
      wallet ? `Wallet <code>${tgEsc(wallet)}</code>` : "",
      data.outAmount ? `Est. out ${tgEsc(String(data.outAmount))} $ORBITX` : "",
      mint ? `<code>${tgEsc(mint)}</code>` : "",
      "After you confirm, the sign page shows the Solscan tx link.",
      `🔗 ${linkLine.join(" · ")}`,
    ]
      .filter(Boolean)
      .join("\n"),
    reply_markup: inlineKeyboard([
      buttons.slice(0, 2),
      buttons.slice(2),
      [{ text: "⌂ Desk", callback_data: "ox:desk" }],
    ]),
  };
}

export function formatMediaCountdown({
  kind = "image",
  taskId,
  startedAt,
  etaSeconds,
  state,
  failMsg,
} = {}) {
  const eta = Number(etaSeconds) || mediaEtaSeconds(kind);
  const started = Number(startedAt) || Date.now();
  const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
  const left = Math.max(0, eta - elapsed);
  const label = String(kind || "image").includes("video") ? "video" : "image";
  if (state === "success") {
    return {
      text: `🎬 <b>Grok Imagine</b> · ${tgEsc(label)} is ready.\nSend /check if the files didn’t attach.`,
      reply_markup: familyKeyboard("media"),
    };
  }
  if (state === "fail") {
    return {
      text: `🎬 <b>Grok Imagine failed</b>\n${tgEsc(failMsg || "try a simpler prompt")}\nRetry /img or /vid.`,
      reply_markup: familyKeyboard("media"),
    };
  }
  const waitLine =
    left > 0
      ? `Elapsed ${tgEsc(fmtClock(elapsed))} · <b>~${tgEsc(fmtClock(left))} left</b>`
      : `Elapsed ${tgEsc(fmtClock(elapsed))} · still rendering past the usual ${tgEsc(fmtClock(eta))} — keep /check`;
  return {
    text: [
      `🎬 <b>Grok Imagine</b> · ${tgEsc(label)} is cooking`,
      waitLine,
      "This takes a few minutes. Keep sending /check until it lands.",
      taskId ? `<code>${tgEsc(taskId)}</code>` : "",
    ]
      .filter(Boolean)
      .join("\n"),
    reply_markup: familyKeyboard("media"),
  };
}

function formatHealthCard(data) {
  if (!data || typeof data !== "object") return null;
  if (!(data.ok != null || data.status || data.sha || data.tools != null || data.uptime)) return null;
  if (asTokenRecord(data)) return null;
  const rows = [
    ["Status", data.ok === false ? "down" : data.status || "ok"],
    ["Tools", data.tools != null ? String(data.tools) : data.toolCount != null ? String(data.toolCount) : "—"],
    ["SHA", data.sha ? String(data.sha).slice(0, 8) : "—"],
    ["Trade", data.trade || "—"],
  ];
  return {
    text: ["🩺 <b>OrbitX health</b>", "", preTable(rows)].join("\n"),
    reply_markup: deskKeyboard(),
  };
}

function formatToolsHelp(data) {
  if (!data || typeof data !== "object") return null;
  if (!(data.totalTools || data.categoryCounts)) return null;
  const cats = data.categoryCounts && typeof data.categoryCounts === "object" ? data.categoryCounts : {};
  const top = Object.entries(cats)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([k, v]) => `• <b>${tgEsc(k)}</b>  ${tgEsc(String(v))}`);
  return {
    text: [
      "✦ <b>Live catalog</b>",
      `${data.totalTools || "—"} tools · ${data.coreTools || "—"} core`,
      "",
      ...top,
      "",
      "/cmds coins · /cmds charts · /call name args",
    ].join("\n"),
    reply_markup: deskKeyboard(),
  };
}

function formatCompactObject(raw, family = "system") {
  const data = unwrapToolPayload(raw);
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const skip = new Set(["stats", "audit", "firstPool", "meta", "token", "raw", "payload", "ok"]);
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    if (skip.has(key) || value == null || typeof value === "object") continue;
    const label = key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim();
    lines.push(`${tgEsc(label)}: ${tgEsc(String(value).slice(0, 160))}`);
    if (lines.length >= 16) break;
  }
  if (lines.length < 2) return null;
  const meta = FAMILY_META[family] || FAMILY_META.system;
  return {
    text: [`${meta.emoji} <b>${tgEsc(meta.title)}</b>`, ...lines].join("\n"),
    reply_markup: familyKeyboard(family),
  };
}

const FAMILY_MENUS = {
  desk: () => formatHelpDesk(),
  coins: () =>
    menuCard("coins", [
      "Drop a mint in chat — or run these:",
      "",
      "<b>/token</b> <code>CA</code> — flagship intel card",
      "<b>/scan</b> <code>CA</code> — safety + forensics overlay",
      "<b>/xray</b> <code>CA</code> — bundles, snipers, concentration",
      "<b>/research</b> <code>CA</code> — utility brief, no hopium",
      "<b>/search</b> <code>ticker</code> — find the mint first",
      "",
      `Try $ORBITX: <code>${ORBITX_MINT}</code>`,
    ]),
  charts: () =>
    menuCard("charts", [
      "<b>/chart</b> <code>CA</code> — DexScreener live + OrbitX DEX",
      "/call chart_1h_solana mint=CA — OHLCV candles",
      "",
      "Quick links land under every coin card: Dex · Jupiter · Birdeye · Solscan.",
    ]),
  scanners: () =>
    menuCard("scanners", [
      "<b>/screen</b> — trending Solana",
      "/call screen_new_pairs_1h_solana",
      "/call pulse_organic_solana",
      "/search BONK",
      "",
      "Each row is a teaser. /token CA for the full card.",
    ]),
  scan: () =>
    menuCard("scan", [
      "<b>/scan</b> <code>CA</code> — branded safety card",
      "<b>/xray</b> · <b>/research</b> · /call get_forensics mint=CA",
      "",
      "Mint/freeze, top holders, organic, LP lock, dev % — omitted if unknown. Never faked.",
    ]),
  wallet: () =>
    menuCard("wallet", [
      "<b>/wallet</b> <code>address</code>",
      "Linked DMs: /wallet with no args uses YOUR wallet.",
      "/call get_swaps · /call get_balance",
    ]),
  trade: () =>
    menuCard("trade", [
      "Private DM + <b>/login</b> first. Groups stay public.",
      "",
      "<b>/trade</b> <code>CA</code>  ·  optional amount (default 0.05 SOL)",
      "<b>/buy</b> <code>CA 0.1</code>  ·  <b>/sell</b> <code>CA</code> (default 100%)",
      "<b>sell 50% CA</b>  ·  <b>dump $ORBITX</b>",
      "<b>/orbitx</b> — buy $ORBITX",
      "<b>/confirm</b> — last quote",
    ]),
  shop: () =>
    menuCard("shop", [
      "<b>/shop</b> — catalog",
      "/shop hour — burn 100 $ORBITX · 1 hour",
      "/shop day — burn 1,000 $ORBITX · 1 day",
      "/shop week — burn 10,000 $ORBITX · 1 week",
      "/shop month — burn 1,000,000 $ORBITX · 1 month",
      "/credits 0.1 sol — top up",
      "",
      href(`${ORBITX_HOST}/shop`, "Full desk shop on the web"),
    ]),
  media: () =>
    menuCard("media", [
      "<b>/img</b> neon saturn city",
      "<b>/vid</b> orbitx trailer",
      "<b>/check</b> — countdown until Grok lands (a few minutes)",
      "",
      "Keep /check. Don’t assume OrbitX is down while it cooks.",
    ]),
  launch: () =>
    menuCard("launch", [
      "Linked DM.",
      "<b>/launch</b> — pump.fun launch",
      "/call vanity_mint suffix=orbit",
      href(`${ORBITX_HOST}/orbitxlaunch`, "Open launchpad"),
    ]),
  social: () =>
    menuCard("social", [
      "/call social_feed",
      "/post hello from OrbitX  (linked DM)",
      href(`${ORBITX_HOST}/hq`, "Social HQ"),
    ]),
  nft: () =>
    menuCard("nft", [
      "<b>/nft</b> — listings",
      "<b>/mint</b> — mint (linked)",
      href(`${ORBITX_HOST}/nft`, "NFT market"),
    ]),
  x: () =>
    menuCard("x", [
      "Connect X at " + href(`${ORBITX_HOST}/x`, "orbitx.world/x"),
      "Then DM <b>/tweet</b> your post.",
    ]),
  ai: () =>
    menuCard("ai", [
      "<b>/faq</b>  ·  /faq burn  ·  /faq mcp  ·  /faq hold",
      "<b>/ask</b> what is OrbitX",
      "Just chat in this bot — product questions don’t need a slash.",
    ]),
  system: () =>
    menuCard("system", [
      "<b>/health</b> — API pulse",
      "<b>/cmds</b> 2 — live tool catalog",
      "<b>/links</b> · <b>/group</b> — every URL + GC",
      href(ORBITX_GC, "t.me/orbitxwrld"),
    ]),
};

function menuCard(family, bodyLines) {
  const meta = FAMILY_META[family] || FAMILY_META.system;
  return {
    text: [`${meta.emoji} <b>${tgEsc(meta.title)}</b>`, `<i>${tgEsc(meta.blurb)}</i>`, "", ...bodyLines].join("\n"),
    reply_markup: familyKeyboard(family),
  };
}

export function formatFamilyMenu(family) {
  const key = String(family || "desk").toLowerCase();
  const fn = FAMILY_MENUS[key] || FAMILY_MENUS.desk;
  return fn();
}

export function formatToolMenu(toolOrCmd) {
  const raw = String(toolOrCmd || "").replace(/^\//, "").trim();
  const tool = raw.startsWith("orbitx_") || raw.startsWith("x_") || raw === "search" || raw === "fetch" ? raw : `orbitx_${raw}`;
  const family = classifyTool(tool);
  const meta = FAMILY_META[family] || FAMILY_META.system;
  const blurb = CORE_BLURBS[tool] || CORE_BLURBS[raw] || meta.blurb;
  const cmd = slashFor(tool);
  const need = missingToolInput(tool, {});
  const hint =
    need === "mint"
      ? `Usage: /${cmd} <code>CA</code>`
      : need === "prompt"
        ? `Usage: /${cmd} <code>your prompt</code>`
        : need === "address"
          ? `Usage: /${cmd} <code>wallet</code>`
          : need === "query"
            ? `Usage: /${cmd} <code>ticker or CA</code>`
            : need === "text"
              ? `Usage: /${cmd} <code>text</code>`
              : `/${cmd}`;
  const base = formatFamilyMenu(family);
  return {
    text: [
      `${meta.emoji} <b>/${tgEsc(cmd)}</b>`,
      `<code>${tgEsc(tool)}</code>`,
      tgEsc(blurb),
      "",
      hint,
      "",
      base.text,
    ].join("\n"),
    reply_markup: base.reply_markup,
  };
}

export function formatHelpDesk(isPrivate = false, linked = false) {
  const gate = isPrivate
    ? linked
      ? "Account linked. /trade /buy /orbitx /shop /launch are live in this DM. /reset starts you as a fresh user."
      : "/login binds THIS Telegram to YOUR wallet. /reset logs out and wipes access so you can start over."
    : "Groups stay public. Drop a CA or $ORBITX here. /trade /buy /tweet only in DM after /login.";
  const text = [
    "🚀 <b>OrbitX Desk</b> · @theorbitxmcpbot",
    "Premium intel · live charts · Grok · shop burns · Jupiter trades",
    "",
    "<b>💰 Coins</b> — drop a CA or /token mint",
    "<b>📈 Charts</b> — /chart CA",
    "<b>🛡️ Scan</b> — /scan · /xray · /research",
    "<b>📡 Pulse</b> — /screen · /search",
    "<b>🎬 Grok</b> — /img · /vid · /check",
    "<b>🛍️ Shop</b> — /shop hour · /shop day · /shop week · /shop month",
    "<b>✦ Ask</b> — /faq · /ask · just type",
    "",
    tgEsc(gate),
    "",
    `GC ${href(ORBITX_GC, "t.me/orbitxwrld")} · ${href(ORBITX_HOST, "orbitx.world")}`,
    "/cmds for the full live catalog · tap a button below",
  ].join("\n");
  return { text, reply_markup: deskKeyboard() };
}

export function cmdsPage(tools, { page = 1, pageSize = 28, query = "", isPrivileged } = {}) {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized && (Number(page) || 1) === 1) {
    const home = formatHelpDesk();
    const filtered = Array.isArray(tools) ? tools : [];
    const slice = filtered.slice(0, 12);
    const rows = slice.map((tool) => formatCatalogRow(tool, isPrivileged));
    return {
      text: [
        home.text,
        "",
        `<b>Live catalog</b> · ${filtered.length} tools · /cmds 2 for more · /cmds coins`,
        ...rows,
      ].join("\n"),
      page: 1,
      totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
      count: filtered.length,
      reply_markup: home.reply_markup,
    };
  }

  if (FAMILY_META[normalized] || normalized === "desk") {
    const fam = formatFamilyMenu(normalized);
    const filtered = (tools || []).filter((tool) => classifyTool(tool.name) === normalized);
    const rows = filtered.slice(0, 24).map((tool) => formatCatalogRow(tool, isPrivileged));
    return {
      text: [fam.text, "", `<b>${filtered.length}</b> live tools in this family`, ...rows].join("\n"),
      page: 1,
      totalPages: 1,
      count: filtered.length,
      reply_markup: fam.reply_markup,
    };
  }

  const filtered = (tools || []).filter((tool) => {
    if (!normalized || /^\d+$/.test(normalized)) return true;
    return (
      tool.name.toLowerCase().includes(normalized) ||
      String(tool.description || "").toLowerCase().includes(normalized) ||
      classifyTool(tool.name).includes(normalized)
    );
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(totalPages, Math.max(1, Number(page) || 1));
  const start = (safePage - 1) * pageSize;
  const slice = filtered.slice(start, start + pageSize);
  const grouped = new Map();
  for (const tool of slice) {
    const fam = classifyTool(tool.name);
    if (!grouped.has(fam)) grouped.set(fam, []);
    grouped.get(fam).push(tool);
  }
  const blocks = [];
  for (const [fam, list] of grouped) {
    const meta = FAMILY_META[fam] || FAMILY_META.system;
    blocks.push(`<b>${meta.emoji} ${tgEsc(meta.title)}</b>`);
    for (const tool of list) blocks.push(formatCatalogRow(tool, isPrivileged));
    blocks.push("");
  }
  return {
    text: [
      `✦ <b>OrbitX live tools</b> · ${filtered.length} · page ${safePage}/${totalPages}`,
      "Public in groups. Trade / X / writes need a private /login.",
      "",
      ...blocks,
      "Next: /cmds 2   ·   Family: /cmds coins   ·   Run: /call name args",
    ].join("\n"),
    page: safePage,
    totalPages,
    count: filtered.length,
    reply_markup: deskKeyboard(),
  };
}

function formatCatalogRow(tool, isPrivileged) {
  const cmd = slashFor(tool.name);
  const badge = isPrivileged?.(tool.name) ? "🔒" : familyEmoji(tool.name);
  const blurb = CORE_BLURBS[tool.name] || String(tool.description || "").slice(0, 72);
  return `${badge} ${cmd ? `/${cmd}` : ""} <code>${tool.name}</code>${blurb ? `\n   ${tgEsc(blurb)}` : ""}`;
}

function familyEmoji(name) {
  return (FAMILY_META[classifyTool(name)] || FAMILY_META.system).emoji;
}

function asText(card) {
  if (!card) return card;
  if (typeof card === "string") return card;
  return card.text;
}

export function formatOrbitXTelegramResult(result, tool) {
  if (result == null) return "(empty)";
  const data = unwrapToolPayload(result);
  const family = classifyTool(tool);
  if (typeof data === "string") {
    const maybe = unwrapToolPayload(data);
    if (maybe && typeof maybe === "object") return formatOrbitXTelegramResult(maybe, tool);
    if (extractMint(data)) {
      return `Token scan came back as text. Try /token <code>${tgEsc(extractMint(data))}</code>`;
    }
    return tgEsc(data).slice(0, 3500);
  }
  const chart = formatDexChartCard(data);
  if (chart) return chart;
  const token = formatTokenCard(data);
  if (token) return token;
  const trade = formatTradeDeskCard(data, tool);
  if (trade) return trade;
  const mintOnly = String(data?.mint || data?.ca || data?.token?.mint || "").trim();
  if (
    mintOnly &&
    CA_RE.test(mintOnly) &&
    !hasMarketSnapshot(data?.token || data) &&
    !data?.packages &&
    !data?.holdings &&
    !data?.signUrl &&
    !data?.autoSignUrl &&
    !data?.requiresSignature &&
    !data?.error
  ) {
    const dex = `https://dexscreener.com/solana/${encodeURIComponent(mintOnly)}`;
    return {
      text: [
        "📡 <b>Live quote unavailable</b>",
        "Couldn't reach DexScreener or Jupiter from this scan. Send /token again — OrbitX won't invent a name, price, or whale count.",
        data?.error && data.error !== "token_not_found" ? `<i>${tgEsc(String(data.error).slice(0, 160))}</i>` : "",
        `<code>${tgEsc(mintOnly)}</code>`,
        `${href(dex, "DexScreener")} · ${href(`https://jup.ag/tokens/${encodeURIComponent(mintOnly)}`, "Jupiter")} · ${href(`${ORBITX_HOST}/ORBITX_DEX/token/${encodeURIComponent(mintOnly)}`, "OrbitX DEX")} · /token`,
      ]
        .filter(Boolean)
        .join("\n"),
      reply_markup: tokenCardKeyboard(mintOnly),
    };
  }
  if (data?.error) {
    return `Error: ${tgEsc(data.error)}${data.message ? ` — ${tgEsc(data.message)}` : ""}`;
  }
  const shop = formatShopCard(data);
  if (shop) return shop;
  const wallet = formatWalletCard(data);
  if (wallet) return wallet;
  const help = formatToolsHelp(data);
  if (help) return help;
  const listTitle = family === "scanners" ? "Pulse" : "OrbitX screen";
  const list = formatTokenList(data, listTitle);
  if (list) return list;
  const mediaState = String(data?.state || data?.status || "").toLowerCase();
  if (data?.taskId && (mediaState === "success" || mediaState === "succeeded" || mediaState === "completed" || mediaState === "done")) {
    return formatMediaCountdown({ kind: data.kind, taskId: data.taskId, state: "success" });
  }
  if (data?.taskId && (mediaState === "fail" || mediaState === "failed" || mediaState === "error")) {
    return formatMediaCountdown({
      kind: data.kind,
      taskId: data.taskId,
      state: "fail",
      failMsg: data.failMsg || data.error || data.message,
    });
  }
  if (
    data?.taskId &&
    (data.pending ||
      data.code === "STILL_GENERATING" ||
      ["waiting", "queuing", "generating", "pending", "processing"].includes(mediaState) ||
      ((data.kind === "image" || data.kind === "video") && !["success", "succeeded", "fail", "failed"].includes(mediaState)))
  ) {
    return formatMediaCountdown({
      kind: data.kind,
      taskId: data.taskId,
      startedAt: data.startedAt,
      etaSeconds: data.etaSeconds,
      state: data.state || "waiting",
      failMsg: data.failMsg,
    });
  }
  const health = formatHealthCard(data);
  if (health && (tool === "orbitx_health" || data.sha || data.tools != null)) return health;
  const actions = formatActionLinks(data);
  if (actions && (data.openUrl || data.signUrl || data.reportUrl || data.launchpadUrl)) return actions;
  const compact = formatCompactObject(data, family);
  if (compact) return compact;
  const fallback = formatMcpResultForTelegram(data);
  if (fallback && !String(fallback).trim().startsWith("{") && !String(fallback).trim().startsWith("[")) {
    return {
      text: String(fallback).replace(/```[\s\S]*?```/g, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").slice(0, 3500),
      reply_markup: familyKeyboard(family),
    };
  }
  return {
    text: `${(FAMILY_META[family] || FAMILY_META.system).emoji} Got a result. Try /token mint, /chart ca, /cmds, or /links.`,
    reply_markup: deskKeyboard(),
  };
}

export function markupForPayload(formatted) {
  return telegramMessageParts(formatted).reply_markup;
}

export { asText };
