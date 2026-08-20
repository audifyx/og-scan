/**
 * Natural-language trade / shop / launch intents for the official Telegram bot.
 * Resolves names like "orbitx_trade" to live hub tools. Does not custody keys.
 */
import { ORBITX_MINT } from "./buy-orbitx.js";

export const SOL_MINT = "So11111111111111111111111111111111111111112";

const CA_RE = /(0x[a-fA-F0-9]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})/;

/** Common Telegram / LLM guesses → live CORE / generated tool names. */
export const TELEGRAM_TOOL_ALIASES = {
  orbitx_trade: "orbitx_prepare_buy",
  trade: "orbitx_prepare_buy",
  swap: "orbitx_prepare_buy",
  orbitx_swap: "orbitx_prepare_buy",
  orbitx_snipe: "orbitx_prepare_buy",
  snipe: "orbitx_prepare_buy",
  ape: "orbitx_prepare_buy",
  orbitx_ape: "orbitx_prepare_buy",
  orbitx_market: "orbitx_prepare_buy",
  market: "orbitx_prepare_buy",
  orbitx_terminal: "orbitx_open_terminal",
  orbitx_shop: "orbitx_shop",
  shop: "orbitx_shop",
  store: "orbitx_shop",
  credits: "orbitx_credits_buy",
  orbitx_credits: "orbitx_credits_buy",
  topup: "orbitx_credits_buy",
  "top up": "orbitx_credits_buy",
  access: "orbitx_mcp_access_buy",
  orbitx_access: "orbitx_mcp_access_buy",
  burn: "orbitx_mcp_access_buy",
  orbitx_mint: "orbitx_mint_nft",
  mint: "orbitx_mint_nft",
  nft: "orbitx_nft_items",
  orbitx_nft: "orbitx_nft_items",
  nfts: "orbitx_nft_items",
  marketplace: "orbitx_nft_listings",
  launch: "orbitx_execute_launch",
  orbitx_launch: "orbitx_execute_launch",
  create: "orbitx_execute_launch",
  coin: "orbitx_execute_launch",
  vanity: "orbitx_vanity_mint",
  confirm: "orbitx_confirm_buy",
  orbitx_confirm: "orbitx_confirm_buy",
  autobuy: "orbitx_trade_auto",
  auto_buy: "orbitx_trade_auto",
  orbitx_auto_buy: "orbitx_trade_auto",
  orbitx_autobuy: "orbitx_trade_auto",
  whoami: "orbitx_whoami",
  me: "orbitx_whoami",
  balance: "orbitx_get_balance",
  bag: "orbitx_get_wallet",
  portfolio: "orbitx_get_wallet",
  orbitx: "orbitx_buy_orbitx",
  buyorbitx: "orbitx_buy_orbitx",
};

export function extractMintFromText(text) {
  const m = String(text || "").match(CA_RE);
  return m ? m[1] : "";
}

export function isOrbitxTicker(text) {
  return /(?:\$|\b)orbitx\b/i.test(String(text || "")) && !/orbitx\.(world|fun)/i.test(String(text || ""));
}

export function parseUsdAmount(text) {
  const t = String(text || "");
  const m =
    t.match(/\$\s*(\d+(?:\.\d+)?)/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*\$/i) ||
    t.match(/(\d+(?:\.\d+)?)\s*(?:usd|usdc|usdt)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseSolAmount(text) {
  const t = String(text || "");
  const m = t.match(/(\d+(?:\.\d+)?)\s*(?:sol|◎)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseLaunchArgs(text) {
  const rest = String(text || "").replace(/^(?:\/)?(?:launch|create)(?:@\w+)?\s*/i, "").trim();
  if (!rest) return {};
  const named = rest.match(/^(.+?)\s+([A-Za-z0-9]{2,12})$/);
  if (named) return { name: named[1].trim(), symbol: named[2].trim().toUpperCase() };
  return { name: rest.slice(0, 32), symbol: rest.replace(/[^A-Za-z0-9]/g, "").slice(0, 10).toUpperCase() || "OBX" };
}

function isCapabilityQuestion(compact) {
  if (/\b(?:yes\s+or\s+no|y\s*\/\s*n)\b/.test(compact)) return true;
  if (/\b(?:can|could|do|does|are|is|would)\s+(?:you|u|it|the\s+bot|orbitx)\b/.test(compact)) return true;
  if (/\bare you able\b|\bis it possible\b/.test(compact)) return true;
  if (/\bbuy things\b|\bbuy (?:tokens|coins|stuff)\b/.test(compact)) return true;
  return false;
}

/** Research / opinion — not an order. "is it a good buy" must not fire a swap. */
export function isOpinionOrResearchAsk(text) {
  const compact = String(text || "")
    .toLowerCase()
    .replace(/@\w+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!compact) return false;
  return (
    /\btell me about\b/.test(compact) ||
    /\bwhat(?:'s| is) (?:this|it)(?:\s+(?:token|project|coin))?\b/.test(compact) ||
    /\bis (?:it|this) a (?:good|bad|smart|dumb) buy\b/.test(compact) ||
    /\b(?:good|bad|smart|dumb) buy\b/.test(compact) ||
    /\bworth (?:buying|aping|it)\b/.test(compact) ||
    /\bshould i (?:buy|ape|snipe)\b/.test(compact) ||
    /\bwould you (?:buy|ape)\b/.test(compact) ||
    /\bdyor\b/.test(compact)
  );
}

export function hasExplicitTradeAmount(text) {
  return Boolean(parseUsdAmount(text) || parseSolAmount(text));
}

/**
 * @returns {{ tool: string, args: Record<string, unknown>, meta?: string } | null}
 */
export function parseTradeIntent(text) {
  const t = String(text || "").trim();
  if (!t) return null;
  const lower = t.toLowerCase().replace(/^\/+/, "");
  const compact = lower.replace(/@\w+/g, " ").replace(/\s+/g, " ").trim();

  if (/^(auto[-_]?buy|autobuy)\b/.test(compact)) {
    const on = /\b(on|enable|enabled|yes|true|1)\b/.test(compact) && !/\b(off|disable|disabled|no|false|0)\b/.test(compact);
    const off = /\b(off|disable|disabled|no|false|0)\b/.test(compact);
    if (off) return { meta: "autobuy", args: { enabled: false } };
    if (on || /\bauto[-_]?buy\s+on\b/.test(compact)) return { meta: "autobuy", args: { enabled: true } };
    if (/sign each|manual|confirm each/.test(compact)) return { meta: "autobuy", args: { enabled: false } };
    return { meta: "autobuy", args: { toggle: true } };
  }

  if (/^(yes|confirm|go ahead|do it|sign it|auto confirm)\b/.test(compact) && compact.length < 80 && !extractMintFromText(t)) {
    return { tool: "orbitx_confirm_buy", args: { auto: true } };
  }

  if (/^(shop|store|credits|top ?up)\b/.test(compact) && compact.length < 80) {
    if (/\bcredit/.test(compact) || /\btop ?up/.test(compact)) {
      const sol = parseSolAmount(t);
      return { tool: "orbitx_credits_buy", args: sol ? { amountSol: sol } : {} };
    }
    if (/\b(access|mcp|burn|hour|day|week|month)\b/.test(compact)) {
      const pack = /\b(month|1000k|1,?000,?000)\b/.test(compact)
        ? "month"
        : /\b(week|10k|10,?000)\b/.test(compact)
          ? "week"
          : /\b(hour|1h|100)\b/.test(compact) && !/\bday\b/.test(compact)
            ? "hour"
            : /\b(day|1k|1,?000)\b/.test(compact)
              ? "day"
              : null;
      return { tool: "orbitx_mcp_access_buy", args: pack ? { package: pack } : {} };
    }
    return { tool: "orbitx_shop", args: {} };
  }

  if (/^(nft|nfts|marketplace)\b/.test(compact) && compact.length < 60) {
    return { tool: "orbitx_nft_listings", args: {} };
  }

  if (/^(launch|create token|create coin)\b/.test(compact)) {
    return { tool: "orbitx_execute_launch", args: parseLaunchArgs(t) };
  }

  if (/^(mint nft|nft mint|mint an nft)\b/.test(compact)) {
    return { tool: "orbitx_mint_nft", args: {} };
  }

  const auto =
    /\bauto(?:matic)?(?:\s+buy|\s+confirm|\s+sign)?\b/.test(compact) ||
    /\bwithout confirm/.test(compact) ||
    /\bno confirm/.test(compact);
  const mint = extractMintFromText(t) || (isOrbitxTicker(t) ? ORBITX_MINT : "");
  const amountUsd = parseUsdAmount(t);
  const amountSol = parseSolAmount(t);
  const selling = /\b(sell|dump|exit)\b/.test(compact);
  const buying =
    /\b(buy|snipe|ape|accumulate)\b/.test(compact) ||
    (/\b(trade|swap)\b/.test(compact) && !selling);

  if (buying && isCapabilityQuestion(compact) && !amountSol && !amountUsd && !extractMintFromText(t)) {
    return null;
  }

  if (buying && isOpinionOrResearchAsk(t) && !amountSol && !amountUsd) {
    return null;
  }

  let sol = amountSol;
  if (!sol && !amountUsd && buying) {
    const bare = compact.match(/(?:^|\s)(\d+(?:\.\d+)?)(?:\s|$)/);
    if (bare) {
      const n = Number(bare[1]);
      if (Number.isFinite(n) && n > 0 && n <= 50) sol = n;
    }
  }

  if (selling && (mint || sol)) {
    const args = { mint, pool: "auto", autoConfirm: auto };
    if (sol) args.amount = sol;
    else args.amount = "100%";
    return { tool: "orbitx_prepare_sell", args };
  }

  if (buying) {
    const args = { pool: "auto", autoConfirm: auto };
    if (mint) args.mint = mint;
    if (sol) args.amountSol = sol;
    if (amountUsd) args.amountUsd = amountUsd;
    if (mint === ORBITX_MINT || (isOrbitxTicker(t) && !extractMintFromText(t))) {
      return { tool: "orbitx_buy_orbitx", args };
    }
    if (mint || sol || amountUsd) {
      return { tool: "orbitx_prepare_buy", args };
    }
    return null;
  }

  return null;
}

export function applyTelegramAlias(rawName) {
  const n = String(rawName || "").trim();
  if (!n) return "";
  if (TELEGRAM_TOOL_ALIASES[n]) return TELEGRAM_TOOL_ALIASES[n];
  const lower = n.toLowerCase();
  if (TELEGRAM_TOOL_ALIASES[lower]) return TELEGRAM_TOOL_ALIASES[lower];
  const stripped = lower.replace(/^orbitx_/, "");
  if (TELEGRAM_TOOL_ALIASES[stripped]) return TELEGRAM_TOOL_ALIASES[stripped];
  return n;
}
