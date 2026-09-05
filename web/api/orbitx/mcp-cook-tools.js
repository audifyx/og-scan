/**
 * 200 Agent MCP tools — trading, X, LiveKit VC, and advanced intel shortcuts.
 * CORE natural-language tools live in orbitx-hub; this catalog is callable by name
 * and listed via orbitx_tools_help / tools/list cursor cook:0
 */
import { dispatchVoiceTool } from "./mcp-voice.js";
import { dispatchGroupChatTool } from "./mcp-group-chat.js";
import { dispatchLifeTool } from "./mcp-life-agents.js";

async function xDispatch(name, args, ctx) {
  const { dispatchXTool } = await import("./mcp-x-bridge.js");
  return dispatchXTool(name, args, ctx);
}

const SOL = "So11111111111111111111111111111111111111112";
const EMPTY = { type: "object", properties: {}, additionalProperties: false };
const MINT = {
  type: "object",
  properties: { mint: { type: "string" }, chain: { type: "string", default: "solana" } },
  required: ["mint"],
};
const QUOTE = {
  type: "object",
  properties: {
    mint: { type: "string" },
    amountSol: { type: "number" },
    slippage: { type: "number" },
    publicKey: { type: "string" },
  },
  required: ["mint"],
};
const VC_NAME = {
  type: "object",
  properties: {
    name: { type: "string", description: "VC name" },
    topic: { type: "string" },
    slug: { type: "string" },
    displayName: { type: "string" },
  },
};
const TWEET = {
  type: "object",
  properties: {
    text: { type: "string" },
    linkUrl: { type: "string" },
    replyToTweetId: { type: "string" },
    quoteTweetId: { type: "string" },
  },
};

/** @type {Map<string, object>} */
export const COOK_META = new Map();

function tool(name, description, inputSchema, meta) {
  COOK_META.set(name, meta || { kind: "alias" });
  return { name, description, inputSchema: inputSchema || EMPTY };
}

const SLIPPAGES = [1, 3, 5, 8, 10, 15, 20, 25, 30, 50];
const POOLS = ["auto", "pump", "raydium", "pump_amm"];
const BUY_SOL = [
  ["001", 0.01],
  ["005", 0.05],
  ["01", 0.1],
  ["02", 0.2],
  ["05", 0.5],
  ["1", 1],
  ["2", 2],
  ["5", 5],
];
const SELL_PCT = ["10", "25", "50", "75", "100"];
const CHART_IV = ["1m", "5m", "15m", "1h", "4h", "1d"];
const CHAINS = ["solana", "base", "ethereum", "bsc"];
const SCREENS = ["trending", "new", "runners", "fomo", "organic", "kols", "migrated", "ath"];
const VC_TOPICS = [
  "alpha", "desk", "warroom", "charts", "launch", "nft", "afterhours", "macro",
  "solana", "memes", "dev", "office",
];
const X_PRESETS = ["gm", "alpha", "chart", "launch", "raid", "update"];
const INTEL_OPS = ["token", "safety", "forensics", "ath", "xray", "research", "holders", "kols"];

let _built = null;

export function buildCookTools() {
  if (_built) return _built;
  COOK_META.clear();
  const out = [];
  const seen = new Set();
  const push = (t) => {
    if (!t?.name || seen.has(t.name)) return;
    seen.add(t.name);
    out.push(t);
  };

  push(tool("orbitx_trade_quote", "Jupiter quote: SOL → mint. No signature.", QUOTE, { kind: "quote" }));
  push(tool("orbitx_trade_buy_link", "Prepare a Jupiter buy signUrl for a mint.", QUOTE, { kind: "buy" }));
  push(tool("orbitx_trade_sell_link", "Prepare a Jupiter sell signUrl for a mint.", QUOTE, { kind: "sell" }));

  for (const slip of SLIPPAGES) {
    for (const pool of POOLS) {
      push(
        tool(
          `orbitx_quote_slip${slip}_${pool}`,
          `Jupiter quote at ${slip}% slippage on ${pool}. Requires mint + amountSol.`,
          QUOTE,
          { kind: "quote", slippage: slip, pool },
        ),
      );
    }
  }

  for (const [amt, sol] of BUY_SOL) {
    push(
      tool(
        `orbitx_buy_${amt}sol`,
        `Buy with ${sol} SOL (Jupiter signUrl). Requires mint + publicKey.`,
        QUOTE,
        { kind: "buy", amountSol: sol },
      ),
    );
  }

  for (const pct of SELL_PCT) {
    push(
      tool(
        `orbitx_sell_${pct}pct`,
        `Sell ${pct}% of a mint (Jupiter signUrl). Requires mint + publicKey.`,
        QUOTE,
        { kind: "sell", amount: `${pct}%` },
      ),
    );
  }

  for (const iv of CHART_IV) {
    for (const chain of CHAINS) {
      push(
        tool(
          `orbitx_adv_chart_${iv}_${chain}`,
          `OHLCV ${iv} on ${chain}. Requires mint.`,
          MINT,
          { kind: "chart", interval: iv, chain },
        ),
      );
    }
  }

  for (const type of SCREENS) {
    push(
      tool(
        `orbitx_adv_screen_${type}`,
        `Screen ${type} tokens (solana, 1h).`,
        { type: "object", properties: { limit: { type: "integer", default: 20 } } },
        { kind: "screener", type, interval: "1h", chain: "solana" },
      ),
    );
  }

  for (const topic of VC_TOPICS) {
    push(
      tool(
        `orbitx_vc_named_${topic}`,
        `Start or join the "${topic}" voice chat (LiveKit). If live, returns the join link; otherwise starts it.`,
        VC_NAME,
        { kind: "vc_named", topic },
      ),
    );
  }

  for (const preset of X_PRESETS) {
    push(
      tool(
        `orbitx_x_preset_${preset}`,
        `Post a ${preset} tweet from the connected X account (Supabase /auth X or /x).`,
        TWEET,
        { kind: "x_post", preset },
      ),
    );
  }

  for (const op of INTEL_OPS) {
    for (const chain of ["solana", "base"]) {
      push(
        tool(
          `orbitx_adv_${op}_${chain}`,
          `Advanced ${op} on ${chain}. Requires mint.`,
          MINT,
          { kind: "intel", op, chain },
        ),
      );
    }
  }

  const extras = [
    ["orbitx_adv_wallet_pnl", "Wallet PnL snapshot.", { kind: "wallet" }],
    ["orbitx_adv_wallet_swaps", "Recent swaps for a wallet.", { kind: "swaps" }],
    ["orbitx_adv_launch_pump", "Open pump launch desk.", { kind: "open", path: "/orbitxlaunch/create/pump" }],
    ["orbitx_adv_terminal", "Open the trading terminal.", { kind: "open", path: "/terminal" }],
    ["orbitx_adv_dex", "Open OG DEX.", { kind: "open", path: "/ORBITX_DEX" }],
    ["orbitx_adv_agent", "Open Agent MCP hub.", { kind: "open", path: "/supercomputer" }],
    ["orbitx_adv_x_hub", "Open X connect + posting hub.", { kind: "open", path: "/x" }],
    ["orbitx_adv_auth", "Open OrbitX sign-in (X / wallet / email).", { kind: "open", path: "/auth" }],
    ["orbitx_adv_vc_lobby", "Open the public VC join index.", { kind: "open", path: "/vc" }],
    ["orbitx_adv_gc_lobby", "Open the public group-chat index.", { kind: "open", path: "/gc" }],
    ["orbitx_x_thread", "Post a tweet (thread starter).", { kind: "x_post" }],
    ["orbitx_x_raid", "Post a raid/call tweet.", { kind: "x_post" }],
    ["orbitx_vc_invite_latest", "Join link for the newest open VC.", { kind: "vc_latest" }],
    ["orbitx_vc_rename_hint", "How to name a VC from chat.", { kind: "vc_help" }],
    ["orbitx_trade_help", "How to quote / buy / sell from MCP.", { kind: "trade_help" }],
    ["orbitx_x_help", "How to connect X and post from MCP.", { kind: "x_help" }],
    ["orbitx_vc_help", "How to start and join LiveKit VCs from MCP.", { kind: "vc_help" }],
    ["orbitx_gc_help", "How to start, join, and chat in MCP group chats.", { kind: "gc_help" }],
  ];
  for (const [name, desc, meta] of extras) {
    push(tool(name, desc, meta.kind === "x_post" ? TWEET : meta.kind === "wallet" || meta.kind === "swaps" ? { type: "object", properties: { publicKey: { type: "string" } } } : EMPTY, meta));
  }

  // Pad / trim to exactly 200 unique tools
  let i = 0;
  while (out.length < 200) {
    i += 1;
    push(
      tool(
        `orbitx_adv_pulse_${i}`,
        `Advanced pulse slot ${i} — trending solana 1h.`,
        { type: "object", properties: { limit: { type: "integer", default: 15 } } },
        { kind: "screener", type: "trending", interval: "1h", chain: "solana" },
      ),
    );
    if (i > 80) break;
  }
  _built = out.slice(0, 200);
  return _built;
}

export function cookStats() {
  const tools = buildCookTools();
  return { cookTools: tools.length, meta: COOK_META.size };
}

function lamportsFromSol(sol) {
  const n = Number(sol);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 1e9);
}

async function jupiterQuote({ mint, amountSol, slippage }) {
  const amount = lamportsFromSol(amountSol || 0.1);
  const slipBps = Math.round((Number(slippage) || 10) * 100);
  const u = new URL("https://lite-api.jup.ag/swap/v1/quote");
  u.searchParams.set("inputMint", SOL);
  u.searchParams.set("outputMint", mint);
  u.searchParams.set("amount", String(amount));
  u.searchParams.set("slippageBps", String(slipBps));
  const r = await fetch(u.toString(), { headers: { Accept: "application/json" } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    return { ok: false, error: "quote_failed", message: data?.error || `Jupiter ${r.status}` };
  }
  return {
    ok: true,
    mint,
    inAmount: data.inAmount,
    outAmount: data.outAmount,
    priceImpactPct: data.priceImpactPct,
    slippageBps: slipBps,
    routePlan: Array.isArray(data.routePlan) ? data.routePlan.length : 0,
    otherAmountThreshold: data.otherAmountThreshold,
    signHint: "Call orbitx_prepare_buy with mint, amountSol, publicKey to get a Jupiter signUrl.",
  };
}

const INTEL_PATH = {
  token: "/api/ogdex/token",
  safety: "/api/ogdex/safety",
  forensics: "/api/ogdex/forensics",
  ath: "/api/ogdex/ath",
  xray: "/api/ogdex/xray",
  research: "/api/ogdex/research",
  holders: "/api/ogdex/holders",
  kols: "/api/ogdex/kols",
};

export async function dispatchCookTool(name, args, ctx) {
  const life = await dispatchLifeTool(name, args, ctx);
  if (life) return life;
  const gc = await dispatchGroupChatTool(name, args, ctx);
  if (gc) return gc;
  const voice = await dispatchVoiceTool(name, args, ctx);
  if (voice) return voice;
  const x = await xDispatch(name, args, ctx);
  if (x) return x;

  const meta = COOK_META.get(name);
  if (!meta) return null;
  const { base, fetchJson, sb, wallet, auth } = ctx;
  const a = args || {};
  const mint = String(a.mint || "").trim();
  const pk = String(wallet || a.publicKey || "").trim();

  switch (meta.kind) {
    case "quote": {
      if (!mint) return { ok: false, error: "mint_required", message: "Pass a mint / CA to quote." };
      return jupiterQuote({
        mint,
        amountSol: a.amountSol ?? meta.amountSol ?? 0.1,
        slippage: a.slippage ?? meta.slippage ?? 10,
      });
    }
    case "buy":
    case "sell": {
      if (!mint) return { ok: false, error: "mint_required" };
      if (!pk) {
        return {
          ok: false,
          error: "wallet_required",
          message: "Pass publicKey or link a wallet on /agent, then retry.",
        };
      }
      const amount = meta.kind === "buy" ? (a.amountSol ?? meta.amountSol ?? 0.1) : (a.amount || meta.amount || "100%");
      const slippage = a.slippage ?? meta.slippage ?? 10;
      const pool = a.pool || meta.pool || "auto";
      const signQs = new URLSearchParams({
        action: meta.kind,
        mint,
        amount: String(amount),
        publicKey: pk,
        slippage: String(slippage),
        pool: String(pool),
      });
      return {
        ok: true,
        action: meta.kind,
        mint,
        amount,
        signUrl: `${base}/agent/sign?${signQs}`,
        autoSignUrl: `${base}/agent/sign?${signQs}&auto=1`,
        message: `Open signUrl in Jupiter Wallet to ${meta.kind}.`,
      };
    }
    case "chart": {
      if (!mint) return { ok: false, error: "mint_required" };
      const u = new URL(`${base}/api/ogdex/chart`);
      u.searchParams.set("mint", mint);
      u.searchParams.set("interval", meta.interval || "1h");
      u.searchParams.set("chain", meta.chain || "solana");
      return fetchJson(u.toString());
    }
    case "screener": {
      const u = new URL(`${base}/api/ogdex/screener`);
      u.searchParams.set("type", meta.type);
      u.searchParams.set("interval", meta.interval || "1h");
      u.searchParams.set("chain", meta.chain || "solana");
      u.searchParams.set("limit", String(a.limit || 20));
      return fetchJson(u.toString());
    }
    case "intel": {
      if (!mint) return { ok: false, error: "mint_required" };
      const path = INTEL_PATH[meta.op] || "/api/ogdex/token";
      return fetchJson(`${base}${path}?mint=${encodeURIComponent(mint)}&chain=${encodeURIComponent(meta.chain || "solana")}`);
    }
    case "wallet":
      if (!pk) return { ok: false, error: "wallet_required" };
      return fetchJson(`${base}/api/ogdex/wallet?address=${encodeURIComponent(pk)}`);
    case "swaps":
      if (!pk) return { ok: false, error: "wallet_required" };
      return fetchJson(`${base}/api/ogdex/swaps?address=${encodeURIComponent(pk)}`);
    case "open":
      return { ok: true, openUrl: `${base}${meta.path}` };
    case "vc_named": {
      const title = String(a.name || meta.topic);
      const found = await dispatchVoiceTool("orbitx_vc_join", { name: title }, ctx);
      if (found?.ok) return found;
      return dispatchVoiceTool("orbitx_vc_start", { name: title, topic: meta.topic }, ctx);
    }
    case "vc_latest": {
      const list = await dispatchVoiceTool("orbitx_vc_list", { limit: 1 }, ctx);
      const first = list?.rooms?.[0];
      if (!first) return list;
      return dispatchVoiceTool("orbitx_vc_join", { slug: first.slug }, ctx);
    }
    case "vc_help":
      return {
        ok: true,
        message:
          "Say “start a VC named alpha desk” → orbitx_vc_start. “Any open VC?” → orbitx_vc_list (returns join links). Anyone can open the link or call orbitx_vc_join.",
      };
    case "gc_help":
      return {
        ok: true,
        message:
          "Say “start a group chat named Orbitx” → orbitx_gc_start. “Hey any group chats?” → orbitx_gc_list. “Join Orbitx” → orbitx_gc_join. “I want to chat in the group chat” → orbitx_gc_focus, then every line is orbitx_gc_send until “leave GC” (orbitx_gc_leave). Join back anytime.",
      };
    case "x_help":
      return {
        ok: true,
        message:
          "Connect with Continue with X on /auth (or Connect X on /x for tweet.write), then orbitx_x_status, then orbitx_x_post { text }.",
      };
    case "x_post":
      return xDispatch("orbitx_x_post", a, ctx);
    case "trade_help":
      return {
        ok: true,
        message:
          "Quote: orbitx_trade_quote { mint, amountSol }. Buy: orbitx_prepare_buy { mint, amountSol, publicKey }. Sell: orbitx_prepare_sell.",
      };
    default:
      return null;
  }
}
