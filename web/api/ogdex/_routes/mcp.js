import { send } from "../_lib.js";

// MCP (Model Context Protocol) tool manifest + execution endpoint.
// Point any AI assistant at GET /api/ogdex/mcp to discover OG DEX tools.
// POST /api/ogdex/mcp with { tool, params } to call a tool programmatically.

const TOOLS = [
  {
    name: "ogdex_get_token",
    description: "Get full token data for a Solana (or EVM) token: price, market cap, holders, OG score, trust verdict, forensics summary, and live trades.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address (Solana) or contract address (EVM)" },
        chain: { type: "string", enum: ["solana", "ethereum", "base", "bsc", "arbitrum", "polygon", "avalanche", "sui", "ton"], default: "solana" },
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
          enum: ["trending", "new", "runners", "fomo", "kol", "organic", "graduating", "migrated", "social"],
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
    description: "Get forensic data for a token: developer wallet, dev-sold status, first buyer with exact transaction, DexScreener-paid status, concentration, LP lock, and safety flags.",
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
    description: "Get all-time-high price and market cap for a token. Sources: CoinGecko, GeckoTerminal, DexScreener (no Birdeye dependency).",
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

export default async function mcpRoute(req) {
  if (req.method === "GET") {
    // Return the MCP tool manifest
    return send(req, {
      ok: true,
      schema_version: "v1",
      name: "OG DEX",
      description: "On-chain data and analytics for crypto traders. Token forensics, screener, wallet PnL, KOL tracking, and AI-powered token reads across 16 chains.",
      contact: { url: "https://ogscan.fun", telegram: "https://t.me/ogupdates" },
      tools: TOOLS,
    });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return send(req, { ok: false, error: "Invalid JSON" }, 400); }

    const { tool, params = {} } = body;
    if (!tool) return send(req, { ok: false, error: "Missing 'tool' field" }, 400);

    const known = TOOLS.find((t) => t.name === tool);
    if (!known) return send(req, { ok: false, error: `Unknown tool: ${tool}` }, 400);

    // Route to the underlying API
    const base = "https://ogscan.fun";
    let url;
    if (tool === "ogdex_get_token") url = `${base}/api/ogdex/token?mint=${params.mint}&chain=${params.chain || "solana"}`;
    else if (tool === "ogdex_screen_tokens") url = `${base}/api/ogdex/screener?type=${params.type}&interval=${params.interval || "1h"}&limit=${params.limit || 20}&chain=${params.chain || "solana"}`;
    else if (tool === "ogdex_get_forensics") url = `${base}/api/ogdex/forensics?mint=${params.mint}`;
    else if (tool === "ogdex_get_ath") url = `${base}/api/ogdex/ath?mint=${params.mint}`;
    else if (tool === "ogdex_get_wallet") url = `${base}/api/ogdex/wallet?address=${params.address}`;
    else if (tool === "ogdex_get_chart") url = `${base}/api/ogdex/chart?mint=${params.mint}&interval=${params.interval || "1h"}&limit=${params.limit || 200}&chain=${params.chain || "solana"}`;
    else if (tool === "ogdex_search") url = `${base}/api/ogdex/search?q=${encodeURIComponent(params.q)}`;
    else return send(req, { ok: false, error: "Tool execution not implemented" }, 501);

    try {
      const r = await fetch(url);
      const data = await r.json();
      return send(req, { ok: true, tool, result: data });
    } catch (e) {
      return send(req, { ok: false, tool, error: String(e) }, 502);
    }
  }

  return send(req, { ok: false, error: "Method not allowed" }, 405);
}
