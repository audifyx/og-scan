/**
 * Standalone MCP (Model Context Protocol) endpoint for OG DEX.
 * Accessible at GET /api/mcp (tool manifest discovery)
 *               POST /api/mcp { tool, params } (tool execution)
 *
 * Any MCP-compatible AI assistant (Claude, GPT-4, custom agents) can
 * discover and call OG DEX tools from here without modifying the main router.
 */

import { createClient } from "@vercel/kv"; // optional rate-limiting; graceful fallback

const BASE = "https://ogscan.fun";

const TOOLS = [
  {
    name: "ogdex_get_token",
    description:
      "Get full token data for a Solana (or EVM) token: price, market cap, holders, OG score, trust verdict, forensics summary, dev wallet, dev-sold status, first buyer, and live trades.",
    inputSchema: {
      type: "object",
      properties: {
        mint: { type: "string", description: "Token mint address (Solana) or contract address (EVM)" },
        chain: {
          type: "string",
          enum: ["solana", "ethereum", "base", "bsc", "arbitrum", "polygon", "avalanche", "sui", "ton"],
          default: "solana",
        },
      },
      required: ["mint"],
    },
  },
  {
    name: "ogdex_screen_tokens",
    description:
      "Screen tokens by category. Returns a ranked list with price, volume, mcap, OG score, and trust indicators.",
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
      "Get forensic data for a token: developer wallet, dev-sold status, first buyer with exact transaction, DexScreener-paid status, bundle detection, concentration, LP lock, and safety flags.",
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
    description:
      "Get all-time-high price and market cap for a token. Sources: CoinGecko, GeckoTerminal, DexScreener.",
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
    description:
      "Get wallet portfolio: SOL balance, token holdings with USD values, realized and unrealized PnL, win rate.",
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
    description:
      "Get OHLCV candlestick data for a token. Returns open, high, low, close, volume per candle.",
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

const ROUTE_MAP = {
  ogdex_get_token: (p) => `${BASE}/api/ogdex/token?mint=${p.mint}&chain=${p.chain || "solana"}`,
  ogdex_screen_tokens: (p) =>
    `${BASE}/api/ogdex/screener?type=${p.type}&interval=${p.interval || "1h"}&limit=${p.limit || 20}&chain=${p.chain || "solana"}`,
  ogdex_get_forensics: (p) => `${BASE}/api/ogdex/forensics?mint=${p.mint}`,
  ogdex_get_ath: (p) => `${BASE}/api/ogdex/ath?mint=${p.mint}`,
  ogdex_get_wallet: (p) => `${BASE}/api/ogdex/wallet?address=${p.address}`,
  ogdex_get_chart: (p) =>
    `${BASE}/api/ogdex/chart?mint=${p.mint}&interval=${p.interval || "1h"}&limit=${p.limit || 200}&chain=${p.chain || "solana"}`,
  ogdex_get_kols: (p) => `${BASE}/api/ogdex/kols?limit=${p.limit || 20}`,
  ogdex_search: (p) => `${BASE}/api/ogdex/search?q=${encodeURIComponent(p.q)}`,
};

export default async function handler(req) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        schema_version: "v1",
        name: "OG DEX",
        description:
          "On-chain data and analytics for crypto traders. Token forensics, screener, wallet PnL, KOL tracking, and AI-powered coin reads across 16 chains.",
        base_url: BASE,
        endpoints: {
          manifest: `${BASE}/api/mcp`,
          execute: `${BASE}/api/mcp`,
        },
        contact: { url: BASE, telegram: "https://t.me/OrbitXupdates" },
        tools: TOOLS,
      }),
      { status: 200, headers }
    );
  }

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Invalid JSON" }), { status: 400, headers });
    }

    const { tool, params = {} } = body;
    if (!tool) {
      return new Response(JSON.stringify({ ok: false, error: "Missing 'tool' field" }), { status: 400, headers });
    }

    const known = TOOLS.find((t) => t.name === tool);
    if (!known) {
      return new Response(
        JSON.stringify({ ok: false, error: `Unknown tool: ${tool}. Available tools: ${TOOLS.map((t) => t.name).join(", ")}` }),
        { status: 400, headers }
      );
    }

    const urlBuilder = ROUTE_MAP[tool];
    if (!urlBuilder) {
      return new Response(JSON.stringify({ ok: false, error: "Tool routing not implemented" }), { status: 501, headers });
    }

    try {
      const url = urlBuilder(params);
      const r = await fetch(url, { headers: { "User-Agent": "OG-DEX-MCP/1.0" } });
      const data = await r.json();
      return new Response(JSON.stringify({ ok: true, tool, result: data }), { status: 200, headers });
    } catch (e) {
      return new Response(
        JSON.stringify({ ok: false, tool, error: String(e) }),
        { status: 502, headers }
      );
    }
  }

  return new Response(JSON.stringify({ ok: false, error: "Method not allowed" }), { status: 405, headers });
}
