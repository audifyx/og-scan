/**
 * Shared MCP tool manifest + execution for /api/mcp and /api/ogdex/mcp.
 * Soft API keys (ORBITX_DEX_API_KEYS) gate POST execution when configured.
 */
import { dbSelect } from "./_lib.js";

export const TOOLS = [
  {
    name: "ogdex_get_token",
    description:
      "Get full token data for a Solana (or EVM) token: price, market cap, holders, OG score, trust verdict, forensics summary, and live trades.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address (Solana) or contract address (EVM)" },
        chain: {
          type: "string",
          enum: ["solana", "ethereum", "base", "bsc", "arbitrum", "polygon", "avalanche", "sui", "ton", "robinhood"],
          default: "solana",
        },
      },
      required: ["mint"],
    },
  },
  {
    name: "ogdex_screen_tokens",
    description: "Screen tokens by category. Returns a ranked list with price, volume, mcap, OG score, and trust indicators.",
    inputSchema: {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: [
            "trending", "new", "runners", "fomo", "kol", "organic",
            "graduating", "migrated", "social", "verified",
          ],
          description: "Screen category",
        },
        interval: { type: "string", enum: ["5m", "1h", "6h", "24h"], default: "1h" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        chain: { type: "string", default: "solana" },
      },
      required: ["type"],
    },
  },
  {
    name: "ogdex_get_forensics",
    description:
      "Get forensic data for a token: developer wallet, dev-sold status, first buyer with exact transaction, DexScreener-paid status, concentration, LP lock, and safety flags.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint / contract address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "ogdex_get_xray",
    description:
      "Risk X-ray for a token: snipers, same-block bundlers, insider clusters, early buyers, concentration, and wallet relationship graph inputs.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint / contract address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "ogdex_get_ath",
    description: "Get all-time-high price and market cap for a token. Sources: CoinGecko, GeckoTerminal, DexScreener.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint / contract address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "ogdex_get_wallet",
    description: "Get wallet portfolio: SOL balance, token holdings with USD values, realized and unrealized PnL, win rate.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Solana wallet address" },
      },
      required: ["address"],
    },
  },
  {
    name: "ogdex_get_chart",
    description: "Get OHLCV candlestick data for a token. Returns open, high, low, close, volume per candle.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string" },
        interval: { type: "string", enum: ["5m", "15m", "1h", "4h", "1d"], default: "1h" },
        limit: { type: "integer", minimum: 1, maximum: 1000, default: 200 },
        chain: { type: "string", default: "solana" },
      },
      required: ["mint"],
    },
  },
  {
    name: "ogdex_get_kols",
    description:
      "Get the OG DEX KOL (Key Opinion Leader) directory. Returns smart-money wallets with their labels, win rates, and recent performance.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 50, default: 20 },
      },
    },
  },
  {
    name: "ogdex_search",
    description: "Search for tokens by name, symbol, or partial mint address.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Search query (name, symbol, or address)" },
      },
      required: ["q"],
    },
  },
];

export function mcpBaseUrl(req) {
  const env = process.env.ORBITX_PUBLIC_URL || process.env.PUBLIC_BASE_URL || "";
  if (env) return env.replace(/\/$/, "");
  try {
    const host = req?.headers?.host || req?.headers?.get?.("host");
    const proto = req?.headers?.["x-forwarded-proto"] || req?.headers?.get?.("x-forwarded-proto") || "https";
    if (host) return `${proto}://${host}`.replace(/\/$/, "");
  } catch { /* noop */ }
  return "https://www.orbitx.world";
}

function allowedKeys() {
  return (process.env.ORBITX_DEX_API_KEYS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** True when ORBITX_DEX_API_KEYS is set — POST tool calls require a matching key. */
export function mcpAuthRequired() {
  return allowedKeys().length > 0;
}

export function extractMcpKey(req) {
  const h = req?.headers || {};
  const get = (k) => {
    if (typeof h.get === "function") return h.get(k) || "";
    const lower = k.toLowerCase();
    return h[lower] || h[k] || "";
  };
  const soft = String(get("x-ogdex-key") || "").trim();
  if (soft) return soft;
  const auth = String(get("authorization") || "").trim();
  if (/^Bearer\s+/i.test(auth)) return auth.replace(/^Bearer\s+/i, "").trim();
  return "";
}

export function mcpAuthorized(req) {
  const keys = allowedKeys();
  if (!keys.length) return false;
  const k = extractMcpKey(req);
  return !!k && keys.includes(k);
}

export async function isMcpEnabled() {
  try {
    const rows = await dbSelect("ogdex_config", "key=eq.mcp_enabled&select=value&limit=1");
    const raw = rows?.[0]?.value;
    if (raw == null) return true;
    const v = typeof raw === "string" ? JSON.parse(raw) : raw;
    return v !== false && v !== "false" && v !== 0;
  } catch {
    return true;
  }
}

export function buildToolUrl(base, tool, params = {}) {
  const p = params || {};
  switch (tool) {
    case "ogdex_get_token":
      return `${base}/api/ogdex/token?mint=${encodeURIComponent(p.mint || "")}&chain=${encodeURIComponent(p.chain || "solana")}`;
    case "ogdex_screen_tokens":
      return `${base}/api/ogdex/screener?type=${encodeURIComponent(p.type || "")}&interval=${encodeURIComponent(p.interval || "1h")}&limit=${p.limit || 20}&chain=${encodeURIComponent(p.chain || "solana")}`;
    case "ogdex_get_forensics":
      return `${base}/api/ogdex/forensics?mint=${encodeURIComponent(p.mint || "")}`;
    case "ogdex_get_xray":
      return `${base}/api/ogdex/xray?mint=${encodeURIComponent(p.mint || "")}`;
    case "ogdex_get_ath":
      return `${base}/api/ogdex/ath?mint=${encodeURIComponent(p.mint || "")}`;
    case "ogdex_get_wallet":
      return `${base}/api/ogdex/wallet?address=${encodeURIComponent(p.address || "")}`;
    case "ogdex_get_chart":
      return `${base}/api/ogdex/chart?mint=${encodeURIComponent(p.mint || "")}&interval=${encodeURIComponent(p.interval || "1h")}&limit=${p.limit || 200}&chain=${encodeURIComponent(p.chain || "solana")}`;
    case "ogdex_get_kols":
      return `${base}/api/ogdex/kols?limit=${p.limit || 20}`;
    case "ogdex_search":
      return `${base}/api/ogdex/search?q=${encodeURIComponent(p.q || "")}`;
    default:
      return null;
  }
}

export function mcpManifest(req, endpoints) {
  const base = mcpBaseUrl(req);
  const authRequired = mcpAuthRequired();
  return {
    ok: true,
    schema_version: "v1",
    name: "OG DEX",
    description:
      "On-chain data and analytics for crypto traders. Token forensics, screener, wallet PnL, KOL tracking, risk X-ray, and AI-powered coin reads across 16 chains.",
    base_url: base,
    endpoints,
    auth: {
      required_for_execute: authRequired,
      header: authRequired ? "Authorization: Bearer <ORBITX_DEX_API_KEY> or x-ogdex-key: <key>" : null,
      note: authRequired
        ? "POST tool execution requires a soft API key. GET manifest is public."
        : "No API key configured — execute is open (rate-limited).",
    },
    contact: { url: base, telegram: "https://t.me/OrbitXupdates" },
    tools: TOOLS,
  };
}

export async function executeMcpTool(req, tool, params = {}) {
  const known = TOOLS.find((t) => t.name === tool);
  if (!known) {
    return {
      status: 400,
      body: { ok: false, error: `Unknown tool: ${tool}. Available: ${TOOLS.map((t) => t.name).join(", ")}` },
    };
  }
  const base = mcpBaseUrl(req);
  const url = buildToolUrl(base, tool, params);
  if (!url) return { status: 501, body: { ok: false, error: "Tool routing not implemented" } };

  const headers = { "User-Agent": "OG-DEX-MCP/1.0", Accept: "application/json" };
  const key = extractMcpKey(req);
  if (key) headers["x-ogdex-key"] = key;

  try {
    const r = await fetch(url, { headers });
    const data = await r.json().catch(() => ({ ok: false, error: `upstream ${r.status}` }));
    return { status: 200, body: { ok: true, tool, result: data } };
  } catch (e) {
    return { status: 502, body: { ok: false, tool, error: String(e) } };
  }
}
