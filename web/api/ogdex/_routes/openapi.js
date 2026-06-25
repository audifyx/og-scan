import { send } from "../_lib.js";

// One link to use the whole OG DEX tool: a complete OpenAPI 3.1 spec. Paste this
// URL into ChatGPT/Claude Actions, Postman, Insomnia, or any codegen and you get
// every endpoint at once — no copy-pasting individual routes.
const SERVER = "https://ogscan.fun/api/ogdex";

const mintParam = { name: "mint", in: "query", required: true, schema: { type: "string" }, description: "Token mint address (Solana base58, or 0x EVM address)." };
const G = (summary, params = [], extra = {}) => ({
  get: { summary, parameters: params, responses: { "200": { description: "OK", content: { "application/json": {} } } }, ...extra },
});

function spec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "OG DEX Public API",
      version: "1.0.0",
      description: "Free public REST API powering OG DEX — Solana & multi-chain token intelligence: screener, live signals, full token intel, holders/whales/KOLs, dev & first-buyer forensics, all-time high, wallet PnL, charts, and an AI you can chat with about any coin. No key required; be reasonable with volume. Most endpoints cached at the edge.",
      contact: { name: "OG Scan", url: "https://ogscan.fun" },
    },
    servers: [{ url: SERVER }],
    paths: {
      "/screener": G("Token screener / discovery lists.", [
        { name: "type", in: "query", schema: { type: "string", enum: ["trending","runners","new","fomo","jupiter","unbonded","migrated","moonshot","newpairs","og","kols","celebrity","organic","listed","multichain","social"] }, description: "List to return.", required: false },
        { name: "interval", in: "query", schema: { type: "string", enum: ["5m","1h","6h","24h"] }, required: false },
        { name: "chain", in: "query", schema: { type: "string", default: "solana" }, required: false },
        { name: "limit", in: "query", schema: { type: "integer", default: 100, maximum: 200 }, required: false },
      ]),
      "/signals": G("Live Pulse signals: volume/velocity/buyer surges, momentum, fresh runners, pump.fun graduating + just-migrated."),
      "/token": G("Full token intel: price, mcap, FDV, liquidity, volume, OG Score, verdict, safety flags, holders, trades, KOL/whale labels.", [mintParam]),
      "/forensics": G("Dev & origin forensics: creator wallet, dev sold?, first buyer (wallet + tx), DexScreener-paid status, concentration, safety.", [mintParam, { name: "first", in: "query", schema: { type: "string", enum: ["0","1"] }, required: false, description: "Set 0 to skip the first-buyer trace." }]),
      "/ath": G("True all-time high (CoinGecko + GeckoTerminal): ATH price, ATH market cap, date, and % from ATH.", [mintParam]),
      "/chart": G("OHLC candles for charting.", [mintParam, { name: "interval", in: "query", schema: { type: "string", default: "1h" }, required: false }, { name: "limit", in: "query", schema: { type: "integer", default: 200 }, required: false }]),
      "/wallet": G("Wallet portfolio: SOL + SPL holdings, USD values, realized + unrealized PnL, win rate.", [{ name: "address", in: "query", required: true, schema: { type: "string" } }]),
      "/search": G("Search tokens by name, ticker, or mint.", [{ name: "q", in: "query", required: true, schema: { type: "string" } }]),
      "/kols": G("Tracked KOL / smart-money directory, profiles, and activity feed.", [
        { name: "feed", in: "query", schema: { type: "string", enum: ["1"] }, required: false, description: "Set 1 for the recent KOL buy/sell feed." },
        { name: "directory", in: "query", schema: { type: "string", enum: ["1"] }, required: false },
        { name: "address", in: "query", schema: { type: "string" }, required: false, description: "KOL profile by wallet." },
        { name: "token", in: "query", schema: { type: "string" }, required: false, description: "Filter the feed to one token mint." },
      ]),
      "/listings": G("Community Store listings (featured / boosted).", [{ name: "featured", in: "query", schema: { type: "string", enum: ["1"] }, required: false }]),
      "/boosts": G("Active boosted tokens and boost tiers.", [{ name: "tiers", in: "query", schema: { type: "string", enum: ["1"] }, required: false }]),
      "/launches": G("Tokens launched through the OG DEX launcher.", [{ name: "limit", in: "query", schema: { type: "integer", default: 50 }, required: false }]),
      "/metadata": G("On-chain metadata, update authority, and mutability.", [mintParam]),
      "/watchlist": G("A wallet's synced watchlist.", [{ name: "wallet", in: "query", required: true, schema: { type: "string" } }]),
      "/alerts": G("A wallet's smart alerts.", [{ name: "wallet", in: "query", required: true, schema: { type: "string" } }]),
      "/chat": {
        post: {
          summary: "Chat with the AI for a specific coin. It answers from live on-chain data and live web search, citing sources.",
          requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["mint","messages"], properties: {
            mint: { type: "string" },
            messages: { type: "array", items: { type: "object", properties: { role: { type: "string", enum: ["user","assistant"] }, content: { type: "string" } } } },
          } } } } },
          responses: { "200": { description: "OK", content: { "application/json": {} } } },
        },
      },
    },
  };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  return send(res, 200, spec());
}
