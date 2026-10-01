/**
 * OrbitX MCP Marketplace registry.
 * Each entry: one MCP in the marketplace. `endpoint` is the Streamable-HTTP URL.
 * `external: true` marks listings that live outside our fleet (OrbitX, Apogee).
 */

export interface McpEntry {
  slug: string;
  name: string;
  emoji: string;
  accent: string;
  tagline: string;
  description: string;
  longDescription: string;
  category: "chains" | "market" | "verticals" | "official";
  endpoint: string;
  siteUrl: string;
  kicker: string;
  version: string;
  external?: boolean;
  toolCount?: number;
  tools?: Array<{ name: string; description: string }>;
}

export const MCP_REGISTRY: McpEntry[] = [
  // ── Official listings ──────────────────────────────────────────
  {
    slug: "orbitx",
    name: "OrbitX",
    emoji: "🪐",
    accent: "#17ff4d",
    tagline: "The official OrbitX MCP",
    description: "Trade Solana in seconds, scan tokens, track wallets — the fastest way to trade on Solana, as MCP tools.",
    longDescription:
      "The official OrbitX Model Context Protocol server. It exposes the OrbitX trading stack — lightning swaps, token scanning, wallet tracking, copy trading — as tools any AI agent can call. Free for community use.",
    category: "official",
    endpoint: "https://orbitx.world/api/mcp",
    siteUrl: "https://orbitx.world",
    kicker: "Official · OrbitX",
    version: "1.0.0",
    external: true,
  },
  {
    slug: "apogee",
    name: "Apogee",
    emoji: "📡",
    accent: "#7c5cff",
    tagline: "Robinhood Chain intel for agents",
    description: "Search, chart, desk, launch and track on Robinhood Chain (4663). 3000 operations, no auth.",
    longDescription:
      "Apogee is the trading-intelligence MCP for Robinhood Chain. Market data, token analytics, pons launches, wallet marks — one surface where humans and models share the same facts. No auth required.",
    category: "official",
    endpoint: "https://apogeemcp.digital/api/mcp",
    siteUrl: "https://apogeemcp.digital",
    kicker: "Chain 4663 · No auth",
    version: "2.0.0",
    external: true,
  },

  // ── Chain MCPs (planet fleet) ──────────────────────────────────
  {
    slug: "jupiter", name: "Jupiter", emoji: "🪐", accent: "#9945FF",
    tagline: "Solana intelligence for agents",
    description: "Live Solana market data, token safety scans, wallet intel, and pump.fun discovery.",
    longDescription: "Jupiter wraps the best public Solana data — Rugcheck safety reports, Dexscreener markets, Jupiter prices, on-chain wallet data via public RPC, and pump.fun launches — into tools any agent can call.",
    category: "chains", endpoint: "https://jupiter-mcp.vercel.app/api/mcp",
    siteUrl: "https://jupiter-mcp.vercel.app", kicker: "Chain: Solana · No auth", version: "1.0.0",
  },
  {
    slug: "mercury", name: "Mercury", emoji: "🔵", accent: "#0052FF",
    tagline: "Base intelligence for agents",
    description: "Base chain token scanning, wallet balances, gas tracking, and trending markets.",
    longDescription: "Mercury is the Base network MCP — token safety scans, Dexscreener markets, wallet balances and gas prices on Base, all from public endpoints.",
    category: "chains", endpoint: "https://mercury-mcp.vercel.app/api/mcp",
    siteUrl: "https://mercury-mcp.vercel.app", kicker: "Chain: Base · No auth", version: "1.0.0",
  },
  {
    slug: "saturn", name: "Saturn", emoji: "🪐", accent: "#E8C547",
    tagline: "Arc chain intelligence for agents",
    description: "Arc network token data, markets, and on-chain intel from public endpoints.",
    longDescription: "Saturn covers the Arc chain — token scanning, market data, and wallet intel, all public data, no keys.",
    category: "chains", endpoint: "https://saturn-mcp.vercel.app/api/mcp",
    siteUrl: "https://saturn-mcp.vercel.app", kicker: "Chain: Arc · No auth", version: "1.0.0",
  },
  {
    slug: "terra", name: "Terra", emoji: "🌍", accent: "#627EEA",
    tagline: "Ethereum intelligence for agents",
    description: "Ethereum token scanning, wallet intel, gas tracking, and DeFi market data.",
    longDescription: "Terra is the Ethereum MCP — ERC-20 safety scans, Dexscreener markets, wallet balances, and live gas prices from public RPC.",
    category: "chains", endpoint: "https://terra-mcp.vercel.app/api/mcp",
    siteUrl: "https://terra-mcp.vercel.app", kicker: "Chain: Ethereum · No auth", version: "1.0.0",
  },
  {
    slug: "luna", name: "Luna", emoji: "🌙", accent: "#F7931A",
    tagline: "Bitcoin intelligence for agents",
    description: "BTC price, address balances, transaction history, fee estimates, and mempool stats.",
    longDescription: "Luna is the Bitcoin MCP, powered by the public mempool.space API — live price, address intel, recommended fees, and mempool depth.",
    category: "chains", endpoint: "https://luna-mcp.vercel.app/api/mcp",
    siteUrl: "https://luna-mcp.vercel.app", kicker: "Chain: Bitcoin · No auth", version: "1.0.0",
  },
  {
    slug: "venus", name: "Venus", emoji: "📈", accent: "#00D4FF",
    tagline: "Robinhood stock tokens for agents",
    description: "Tokenized stock intel on Robinhood Chain — scan stock tokens, compare DEX vs oracle price.",
    longDescription: "Venus tracks stock tokens on Robinhood Chain: safety scans, DEX-vs-oracle premium checks, and underlying equity prices. Apogee-style intel, rebuilt open.",
    category: "chains", endpoint: "https://venus-mcp.vercel.app/api/mcp",
    siteUrl: "https://venus-mcp.vercel.app", kicker: "Chain: Robinhood · No auth", version: "1.0.0",
  },
  {
    slug: "comet", name: "Comet", emoji: "☄️", accent: "#F0B90B",
    tagline: "BSC intelligence for agents",
    description: "BNB Chain token scanning, wallet balances, and gas tracking from public endpoints.",
    longDescription: "Comet is the BSC MCP — token safety scans, markets, wallet intel, and gas on BNB Chain.",
    category: "chains", endpoint: "https://comet-mcp.vercel.app/api/mcp",
    siteUrl: "https://comet-mcp.vercel.app", kicker: "Chain: BSC · No auth", version: "1.0.0",
  },
  {
    slug: "io", name: "Io", emoji: "🟣", accent: "#8247E5",
    tagline: "Polygon intelligence for agents",
    description: "Polygon token scanning, wallet balances, and gas tracking from public endpoints.",
    longDescription: "Io is the Polygon MCP — token scans, markets, wallet intel, and gas on Polygon.",
    category: "chains", endpoint: "https://io-mcp.vercel.app/api/mcp",
    siteUrl: "https://io-mcp.vercel.app", kicker: "Chain: Polygon · No auth", version: "1.0.0",
  },
  {
    slug: "nebula", name: "Nebula", emoji: "🔷", accent: "#28A0F0",
    tagline: "Arbitrum intelligence for agents",
    description: "Arbitrum token scanning, wallet balances, and gas tracking from public endpoints.",
    longDescription: "Nebula is the Arbitrum MCP — token scans, markets, wallet intel, and gas on Arbitrum One.",
    category: "chains", endpoint: "https://nebula-mcp.vercel.app/api/mcp",
    siteUrl: "https://nebula-mcp.vercel.app", kicker: "Chain: Arbitrum · No auth", version: "1.0.0",
  },
  {
    slug: "quasar", name: "Quasar", emoji: "🌊", accent: "#6FBCF0",
    tagline: "Sui intelligence for agents",
    description: "Sui token scanning, object ownership, balances, and market data.",
    longDescription: "Quasar is the Sui MCP — token scans, owned objects, balances via public fullnode, and Sui DeFi markets.",
    category: "chains", endpoint: "https://quasar-mcp.vercel.app/api/mcp",
    siteUrl: "https://quasar-mcp.vercel.app", kicker: "Chain: Sui · No auth", version: "1.0.0",
  },

  // ── Market data MCPs ───────────────────────────────────────────
  {
    slug: "orion", name: "Orion", emoji: "📊", accent: "#4CAF50",
    tagline: "Stock market data for agents",
    description: "Free stock quotes and price history for any ticker — no key.",
    longDescription: "Orion serves stock market data from free public feeds — live quotes and daily history for US equities.",
    category: "market", endpoint: "https://orion-mcp.vercel.app/api/mcp",
    siteUrl: "https://orion-mcp.vercel.app", kicker: "Equities · No auth", version: "1.0.0",
  },
  {
    slug: "europa", name: "Europa", emoji: "💱", accent: "#2196F3",
    tagline: "FX rates for agents",
    description: "Live and historical foreign exchange rates — free, no key.",
    longDescription: "Europa is the forex MCP — convert currencies, pull latest and historical rates from public central-bank data.",
    category: "market", endpoint: "https://europa-mcp.vercel.app/api/mcp",
    siteUrl: "https://europa-mcp.vercel.app", kicker: "Forex · No auth", version: "1.0.0",
  },
  {
    slug: "neptune", name: "Neptune", emoji: "🌊", accent: "#00BCD4",
    tagline: "DeFi yields for agents",
    description: "Top DeFi yields by chain and protocol — live APYs, TVL, no key.",
    longDescription: "Neptune dives into DeFi yields — thousands of pools across chains with live APY and TVL from public data.",
    category: "market", endpoint: "https://neptune-mcp.vercel.app/api/mcp",
    siteUrl: "https://neptune-mcp.vercel.app", kicker: "DeFi · No auth", version: "1.0.0",
  },
  {
    slug: "pulse", name: "Pulse", emoji: "💓", accent: "#FF5252",
    tagline: "Market sentiment for agents",
    description: "Fear & Greed index history and global crypto market overview.",
    longDescription: "Pulse reads the market's mood — the Fear & Greed index with history plus global market cap and BTC dominance.",
    category: "market", endpoint: "https://pulse-mcp.vercel.app/api/mcp",
    siteUrl: "https://pulse-mcp.vercel.app", kicker: "Sentiment · No auth", version: "1.0.0",
  },
  {
    slug: "harbor", name: "Harbor", emoji: "⚓", accent: "#009688",
    tagline: "Stablecoin intel for agents",
    description: "Stablecoin market caps, chains, and flows — live public data.",
    longDescription: "Harbor tracks every major stablecoin — supplies, chains, and market share from public data.",
    category: "market", endpoint: "https://harbor-mcp.vercel.app/api/mcp",
    siteUrl: "https://harbor-mcp.vercel.app", kicker: "Stablecoins · No auth", version: "1.0.0",
  },
  {
    slug: "titan", name: "Titan", emoji: "⛽", accent: "#FF9800",
    tagline: "Gas prices for agents",
    description: "Live gas across Ethereum, Base, BSC, Polygon, Arbitrum — plus BTC fees.",
    longDescription: "Titan watches gas on every major EVM chain plus Bitcoin fees, so agents always know the cheapest time to move.",
    category: "market", endpoint: "https://titan-mcp.vercel.app/api/mcp",
    siteUrl: "https://titan-mcp.vercel.app", kicker: "Gas · No auth", version: "1.0.0",
  },

  // ── Vertical MCPs ────────────────────────────────────────────
  {
    slug: "mars", name: "Mars", emoji: "🏈", accent: "#FF5722",
    tagline: "Sports data for agents",
    description: "Live scores and schedules for NFL, NBA, MLB, NHL, and soccer.",
    longDescription: "Mars is the sports MCP — live scoreboards, schedules, and team info across the major leagues, from public feeds.",
    category: "verticals", endpoint: "https://mars-mcp.vercel.app/api/mcp",
    siteUrl: "https://mars-mcp.vercel.app", kicker: "Sports · No auth", version: "1.0.0",
  },
  {
    slug: "aurora", name: "Aurora", emoji: "🌤️", accent: "#87CEEB",
    tagline: "Weather for agents",
    description: "Current weather and forecasts for anywhere on Earth — free, no key.",
    longDescription: "Aurora serves weather from Open-Meteo — geocode any place, get current conditions and 7-day forecasts.",
    category: "verticals", endpoint: "https://aurora-mcp.vercel.app/api/mcp",
    siteUrl: "https://aurora-mcp.vercel.app", kicker: "Weather · No auth", version: "1.0.0",
  },
  {
    slug: "herald", name: "Herald", emoji: "📰", accent: "#9C27B0",
    tagline: "Crypto news for agents",
    description: "Latest crypto headlines from public news feeds, searchable.",
    longDescription: "Herald aggregates crypto news from public RSS feeds — latest headlines and keyword search for agents that need the narrative.",
    category: "verticals", endpoint: "https://herald-mcp.vercel.app/api/mcp",
    siteUrl: "https://herald-mcp.vercel.app", kicker: "News · No auth", version: "1.0.0",
  },
  {
    slug: "drop", name: "Drop", emoji: "🎁", accent: "#E91E63",
    tagline: "Trending discovery for agents",
    description: "What's trending in crypto right now — coins and NFTs people are searching.",
    longDescription: "Drop surfaces what's hot — trending coins and NFTs from public search data, so agents catch narratives early.",
    category: "verticals", endpoint: "https://drop-mcp.vercel.app/api/mcp",
    siteUrl: "https://drop-mcp.vercel.app", kicker: "Trends · No auth", version: "1.0.0",
  },
];

export const CATEGORIES = [
  { id: "official", label: "Official" },
  { id: "chains", label: "Chains" },
  { id: "market", label: "Market Data" },
  { id: "verticals", label: "Verticals" },
] as const;
