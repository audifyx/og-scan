// OG DEX — llms.txt : a plain-text guide for AI agents / LLMs on how to use the
// public API (https://llmstxt.org convention). Served at /api/ogdex/llms.txt.
const BASE = "https://ogscan.fun/api/ogdex";

const TEXT = `# OG DEX

> Free public REST API for Solana (and multi-chain) memecoin intelligence: token discovery, full on-chain token intel, dev & early-buyer forensics, snipers/bundlers risk X-ray, holders/whales/KOLs, wallet portfolio + PnL, charts, all-time-high, price alerts, and a per-coin AI you can chat with. No API key required. Be reasonable with volume (per-IP rate limits apply). Most endpoints are JSON and edge-cached.

Base URL: ${BASE}
OpenAPI 3.1 spec (import this into ChatGPT/Claude Actions, Postman, or any codegen for every endpoint at once): ${BASE}/openapi.json
Brand: https://ogscan.fun  ·  Token page pattern: https://ogscan.fun/OGDEX/token/{mint}  ·  Wallet page: https://ogscan.fun/OGDEX/wallet/{address}

## Conventions
- All responses are JSON with an \`ok\` boolean unless noted. On error: \`{ ok: false, error }\`.
- \`mint\` = Solana token mint (base58). \`address\`/\`wallet\` = Solana wallet (base58).
- Money values are USD unless suffixed (e.g. \`solAmount\`). Times are epoch milliseconds.
- GET unless a body is shown. CORS is open. No auth header needed.

## Core endpoints
- GET ${BASE}/screener?type={trending|runners|new|fomo|jupiter|migrated|moonshot|og|kols|...}&interval={5m|1h|6h|24h}&limit=100 — discovery lists.
- GET ${BASE}/signals — live Pulse signals (volume/buyer surges, momentum, graduating + just-migrated).
- GET ${BASE}/token?mint={mint} — full token intel: price, mcap, FDV, liquidity, volume, OG Score, verdict, safety flags, holders, trades, KOL/whale labels.
- GET ${BASE}/search?q={name|ticker|mint} — search tokens.
- GET ${BASE}/chart?mint={mint}&interval=1h&limit=200 — OHLC candles.
- GET ${BASE}/ath?mint={mint} — true all-time high price + market cap, date, % from ATH.

## Risk & forensics
- GET ${BASE}/xray?mint={mint} — RISK X-RAY. Merges early-buyer forensics with holder + safety data into one verdict.
  Returns: { verdict, tone:green|yellow|red, score, summary, flags[], snipers{pct,count,wallets[]}, bundles{pct,count,clusters[]}, earlyBuyers[], concentration{top10Pct,whales,totalHolders}, dev{wallet,pct,sold,serial}, safety{mintRenounced,freezeRenounced,lpLockedPct,rugged,riskScore}, traced }.
  Snipers = wallets that bought in the launch slot or within 20s. Bundles = same-block clusters of >=3 wallets (bundler signal). Best coverage on pump.fun tokens.
- GET ${BASE}/forensics?mint={mint}&first={0|1} — dev/origin: creator wallet, dev-sold?, first buyer (wallet + tx), DexScreener-paid status, concentration, safety.
- GET ${BASE}/safety?mint={mint} — honeypot / tradeability via Jupiter round-trip: { canBuy, canSell, roundTripLossPct, verdict, tone }.
- GET ${BASE}/metadata?mint={mint} — on-chain metadata, update authority, mutability.

## Wallets
- GET ${BASE}/wallet?address={address} — portfolio: SOL + SPL holdings, USD values, realized + unrealized PnL, win rate.
- GET ${BASE}/swaps?address={address}&limit=25 — recent buy/sell swaps with token metadata + USD (for trade feeds / mirroring UIs).
- GET ${BASE}/balance?owner={address}&mint={mint} — SOL + a single token balance.

## Smart money
- GET ${BASE}/kols?feed=1 | ?directory=1 | ?address={wallet} | ?token={mint} — tracked KOL / smart-money directory, profiles, activity feed.
- GET ${BASE}/listings ${BASE}/boosts ${BASE}/launches — community store, boosts, launcher tokens.

## AI (per-coin chat)
- POST ${BASE}/chat  body: { "mint": "...", "messages": [{ "role": "user", "content": "is this a rug?" }] }
  Answers from live on-chain data + live web search and cites sources. Returns { ok, answer, sources[] }.

## Alerts (notify-only; OG DEX never auto-trades)
- GET ${BASE}/alerts?wallet={wallet} — a wallet's alerts.
- POST ${BASE}/alerts  body: { "wallet": "...", "alert": { "mint": "...", "type": "price_above|price_below|pct_up|pct_down", "value": 0.01, "channel": "telegram|webhook", "target": "<chatId|@channel|https url>" } }
  Use price_below for limit-buy / stop-loss cues and price_above for take-profit. Alerts only notify you; you sign every trade yourself.

## Trading (non-custodial)
- POST ${BASE}/trade  body: { "publicKey": "...", "action": "buy|sell", "mint": "...", "amount": 0.25, "denominatedInSol": "true", "slippage": 10, "pool": "auto" }
  Returns a base64 transaction the USER signs in their own wallet (Phantom). OG DEX never holds funds or keys and adds no platform fee.

## Notes for agents / MCP
- To build an MCP server or LLM tool: import ${BASE}/openapi.json — it is a complete OpenAPI 3.1 document that most MCP/codegen frameworks (e.g. openapi-mcp, Claude Actions, custom GPTs) convert into callable tools automatically.
- Prefer /token for a single coin overview, /xray for risk, /forensics for dev origin, /wallet + /swaps for a trader, /screener + /signals for discovery.
- Endpoints are cached; do not poll faster than a few seconds. Heavy traces (/xray, /forensics) are immutable and cached for ~24h.
`;

export default async function handler(req, res) {
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400");
  res.statusCode = 200;
  res.end(TEXT);
}
