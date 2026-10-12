/**
 * OrbitX ChatGPT Mini App — UI widget registry (Builder D).
 *
 * Maps tool names → widget resource URIs and serves the widget HTML.
 * HTML files are read with literal relative paths so Vercel's file tracer
 * (@vercel/nft) bundles them into the serverless function. If you add a
 * widget: add the URI to UI_WIDGETS, add a literal readFileSync line below,
 * and drop the HTML file next to this module.
 */

import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Apps SDK widget MIME type — this is what marks a resource as renderable UI. */
export const WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

export const UI_WIDGETS = [
  {
    uri: "ui://widget/orbitx-auth.html",
    name: "orbitx-auth",
    title: "OrbitX Connect",
    description: "Link your OrbitX account, check auth status, view session identity.",
    file: "orbitx-auth.html",
  },
  {
    uri: "ui://widget/orbitx-trade.html",
    name: "orbitx-trade",
    title: "OrbitX Trade",
    description: "Get a quote, review, confirm, then buy / sell / swap. Explicit confirm step before any money moves.",
    file: "orbitx-trade.html",
  },
  {
    uri: "ui://widget/orbitx-token.html",
    name: "orbitx-token",
    title: "OrbitX Token Intel",
    description: "Token safety scan, screeners, trending, forensics, DEX chart.",
    file: "orbitx-token.html",
  },
  {
    uri: "ui://widget/orbitx-wallet.html",
    name: "orbitx-wallet",
    title: "OrbitX Wallet",
    description: "Wallet balances, PnL, swap history.",
    file: "orbitx-wallet.html",
  },
  {
    uri: "ui://widget/orbitx-media.html",
    name: "orbitx-media",
    title: "OrbitX Studio",
    description: "Generate images, post to X, launch a token.",
    file: "orbitx-media.html",
  },
  {
    uri: "ui://widget/orbitx-groupchat.html",
    name: "orbitx-groupchat",
    title: "OrbitX Group Chat",
    description: "Live group-chat feed with composer. Polls the GC transcript, posts via orbitx_gc_chat.",
    file: "orbitx-groupchat.html",
  },
  {
    uri: "ui://widget/orbitx-dashboard.html",
    name: "orbitx-dashboard",
    title: "OrbitX Dashboard",
    description: "Home screen: portfolio snapshot, trending tokens, PnL summary, quick actions to every widget.",
    file: "orbitx-dashboard.html",
  },
  {
    uri: "ui://widget/orbitx-tools.html",
    name: "orbitx-tools",
    title: "OrbitX Tools",
    description: "Browsable directory of everything the MCP can do — 24 categories, quick-open buttons.",
    file: "orbitx-tools.html",
  },
];

const WIDGET_BY_URI = Object.fromEntries(UI_WIDGETS.map((w) => [w.uri, w]));

/**
 * NOTE: literal paths (not a loop) so @vercel/nft traces each HTML file
 * into the deployed function bundle.
 */
function loadAllWidgetHtml() {
  const out = {};
  const files = {
    "ui://widget/orbitx-auth.html": join(HERE, "orbitx-auth.html"),
    "ui://widget/orbitx-trade.html": join(HERE, "orbitx-trade.html"),
    "ui://widget/orbitx-token.html": join(HERE, "orbitx-token.html"),
    "ui://widget/orbitx-wallet.html": join(HERE, "orbitx-wallet.html"),
    "ui://widget/orbitx-media.html": join(HERE, "orbitx-media.html"),
    "ui://widget/orbitx-groupchat.html": join(HERE, "orbitx-groupchat.html"),
    "ui://widget/orbitx-dashboard.html": join(HERE, "orbitx-dashboard.html"),
    "ui://widget/orbitx-tools.html": join(HERE, "orbitx-tools.html"),
  };
  for (const [uri, path] of Object.entries(files)) {
    try {
      out[uri] = readFileSync(path, "utf8");
    } catch {
      out[uri] = null; // resources/read will answer with a proper JSON-RPC error
    }
  }
  return out;
}

let _htmlCache = null;
function widgetHtmlCache() {
  if (!_htmlCache) _htmlCache = loadAllWidgetHtml();
  return _htmlCache;
}

/** resources/list payload. */
export function listUiWidgets() {
  return UI_WIDGETS.map((w) => ({
    uri: w.uri,
    name: w.name,
    title: w.title,
    description: w.description,
    mimeType: WIDGET_MIME_TYPE,
  }));
}

/** resources/read payload for one URI, or null when unknown/unreadable. */
export function readUiWidget(uri) {
  const w = WIDGET_BY_URI[String(uri || "")];
  if (!w) return null;
  const text = widgetHtmlCache()[w.uri];
  if (typeof text !== "string" || !text) return null;
  return {
    contents: [
      {
        uri: w.uri,
        name: w.name,
        title: w.title,
        mimeType: WIDGET_MIME_TYPE,
        text,
      },
    ],
  };
}

/** Tool name → widget resource URI (the Apps SDK tool→UI binding). */
export const UI_TOOL_WIDGET = {
  // auth
  orbitx_auth_link: "ui://widget/orbitx-auth.html",
  orbitx_auth_status: "ui://widget/orbitx-auth.html",
  orbitx_whoami: "ui://widget/orbitx-auth.html",
  // trade
  orbitx_trade_quote: "ui://widget/orbitx-trade.html",
  orbitx_quote_slip10_auto: "ui://widget/orbitx-trade.html",
  orbitx_app_buy: "ui://widget/orbitx-trade.html",
  orbitx_app_sell: "ui://widget/orbitx-trade.html",
  orbitx_swap: "ui://widget/orbitx-trade.html",
  // token
  orbitx_crypto_scan: "ui://widget/orbitx-token.html",
  orbitx_screen_tokens: "ui://widget/orbitx-token.html",
  orbitx_screen_trending_1m_solana: "ui://widget/orbitx-token.html",
  orbitx_adv_forensics_solana: "ui://widget/orbitx-token.html",
  orbitx_get_forensics: "ui://widget/orbitx-token.html",
  orbitx_dex_chart: "ui://widget/orbitx-token.html",
  orbitx_leaderboard: "ui://widget/orbitx-token.html",
  orbitx_platform_stats: "ui://widget/orbitx-token.html",
  // wallet
  orbitx_get_wallet: "ui://widget/orbitx-wallet.html",
  orbitx_adv_wallet_pnl: "ui://widget/orbitx-wallet.html",
  orbitx_adv_wallet_swaps: "ui://widget/orbitx-wallet.html",
  orbitx_app_pnl: "ui://widget/orbitx-wallet.html",
  orbitx_get_swaps: "ui://widget/orbitx-wallet.html",
  // media
  orbitx_generate_image: "ui://widget/orbitx-media.html",
  orbitx_x_post: "ui://widget/orbitx-media.html",
  orbitx_app_launch: "ui://widget/orbitx-media.html",
  orbitx_launchpad: "ui://widget/orbitx-media.html",
  // group chat
  orbitx_gc_chat: "ui://widget/orbitx-groupchat.html",
  // transfers + tipping + DCA
  orbitx_send_sol: "ui://widget/orbitx-wallet.html",
  orbitx_tip: "ui://widget/orbitx-wallet.html",
  orbitx_dca_create: "ui://widget/orbitx-trade.html",
  orbitx_dca_list: "ui://widget/orbitx-trade.html",
  orbitx_dca_cancel: "ui://widget/orbitx-trade.html",
  // social intel: whales, alerts, unlocks, airdrops, multi-wallet
  orbitx_whale_watch: "ui://widget/orbitx-token.html",
  orbitx_whale_alerts: "ui://widget/orbitx-token.html",
  orbitx_alert_create: "ui://widget/orbitx-token.html",
  orbitx_alert_list: "ui://widget/orbitx-token.html",
  orbitx_unlocks: "ui://widget/orbitx-token.html",
  orbitx_airdrops: "ui://widget/orbitx-wallet.html",
  orbitx_portfolio_multi: "ui://widget/orbitx-wallet.html",
  // autonomous agents
  orbitx_agent_snipe: "ui://widget/orbitx-trade.html",
  orbitx_agent_analyst: "ui://widget/orbitx-token.html",
  orbitx_agent_guardian: "ui://widget/orbitx-wallet.html",
  orbitx_agent_research: "ui://widget/orbitx-token.html",
  orbitx_agent_alpha: "ui://widget/orbitx-trade.html",
  // dashboard (home) + tools directory
  orbitx_menu: "ui://widget/orbitx-dashboard.html",
  orbitx_tools_help: "ui://widget/orbitx-tools.html",
};

/**
 * _meta fragment for a tool listing. Merges with any existing tool._meta.
 * Returns null when the tool has neither a UI binding nor existing _meta.
 */
export function toolListingMeta(tool) {
  const name = String(tool?.name || "");
  const uri = UI_TOOL_WIDGET[name];
  const base = tool && typeof tool._meta === "object" && tool._meta ? tool._meta : {};
  if (!uri && Object.keys(base).length === 0) return null;
  const meta = { ...base };
  if (uri) {
    meta.ui = { ...(meta.ui && typeof meta.ui === "object" ? meta.ui : {}), resourceUri: uri };
    meta["openai/outputTemplate"] = uri;
  }
  return meta;
}
