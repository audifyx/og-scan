/**
 * Trade More — 60 advanced tools catalog.
 * kinds: panel (in-app interactive) | advanced (lazy analytics) | link (OrbitX route)
 */

export type ToolKind = "panel" | "advanced" | "link";

export type TradeTool = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: ToolKind;
  /** For kind=advanced — key into ADVANCED_TOOL_LOADERS */
  advancedKey?: string;
  /** For kind=link */
  href?: string;
  featured?: boolean;
};

export const TOOL_CATEGORIES = [
  "Featured",
  "Wallet",
  "Token",
  "Trading",
  "Analytics",
  "Security",
  "DeFi",
  "Launchpad",
  "Platform",
] as const;

export const TRADE_TOOLS: TradeTool[] = [
  // ── Featured interactive ──────────────────────────────────────────
  {
    id: "rent-refund",
    name: "Rent Refund",
    description: "Close empty token accounts and reclaim locked SOL rent",
    category: "Featured",
    kind: "panel",
    featured: true,
  },
  {
    id: "creator-fee-claim",
    name: "Creator Fee Claim",
    description: "Claim pump.fun + OrbitX custom-lane creator trading fees",
    category: "Featured",
    kind: "panel",
    featured: true,
  },
  {
    id: "token-burner",
    name: "Token Burner",
    description: "Burn SPL / Token-2022 holdings; reclaim rent when emptied",
    category: "Featured",
    kind: "panel",
    featured: true,
  },
  {
    id: "unwrap-wsol",
    name: "Unwrap wSOL",
    description: "Close wrapped SOL accounts and return SOL + rent",
    category: "Wallet",
    kind: "panel",
  },

  // ── Advanced analytics (existing components) ──────────────────────
  { id: "token-sniper", name: "Token Sniper", description: "Detect new token launches", category: "Trading", kind: "advanced", advancedKey: "Token Sniper" },
  { id: "wallet-profiler", name: "Wallet Profiler", description: "Analyze any wallet's performance", category: "Wallet", kind: "advanced", advancedKey: "Wallet Profiler" },
  { id: "jupiter-routes", name: "Jupiter Routes", description: "Track swap routes and slippage", category: "Trading", kind: "advanced", advancedKey: "Jupiter Routes" },
  { id: "liquidity-sniper", name: "Liquidity Sniper", description: "Snipe new liquidity pools", category: "Trading", kind: "advanced", advancedKey: "Liquidity Sniper" },
  { id: "profit-curve", name: "Profit Curve", description: "Generate PnL curves over time", category: "Analytics", kind: "advanced", advancedKey: "Profit Curve" },
  { id: "trading-style", name: "Trading Style", description: "Classify wallet trading patterns", category: "Analytics", kind: "advanced", advancedKey: "Trading Style" },
  { id: "holder-analysis", name: "Holder Analysis", description: "Deep dive into token holders", category: "Token", kind: "advanced", advancedKey: "Holder Analysis" },
  { id: "liquidity-scanner", name: "Liquidity Scanner", description: "Check pool liquidity depth", category: "DeFi", kind: "advanced", advancedKey: "Liquidity Scanner" },
  { id: "token-metadata", name: "Token Metadata", description: "Inspect on-chain token data", category: "Token", kind: "advanced", advancedKey: "Token Metadata" },
  { id: "whale-concentration", name: "Whale Concentration", description: "Analyze whale holdings", category: "Analytics", kind: "advanced", advancedKey: "Whale Concentration" },
  { id: "wash-trading", name: "Wash Trading", description: "Detect wash trading patterns", category: "Security", kind: "advanced", advancedKey: "Wash Trading" },
  { id: "insider-detector", name: "Insider Detector", description: "Find insider trading patterns", category: "Security", kind: "advanced", advancedKey: "Insider Detector" },
  { id: "staking-calc", name: "Staking Calculator", description: "Calculate staking rewards", category: "DeFi", kind: "advanced", advancedKey: "Staking Calculator" },
  { id: "impermanent-loss", name: "Impermanent Loss", description: "IL calculator for LP positions", category: "DeFi", kind: "advanced", advancedKey: "Impermanent Loss" },
  { id: "lp-scanner", name: "LP Scanner", description: "Scan LP positions and yields", category: "DeFi", kind: "advanced", advancedKey: "LP Scanner" },
  { id: "program-monitor", name: "Program Monitor", description: "Monitor DEX program interactions", category: "Analytics", kind: "advanced", advancedKey: "Program Monitor" },
  { id: "fee-analyzer", name: "Fee Analyzer", description: "Analyze transaction fees", category: "Analytics", kind: "advanced", advancedKey: "Fee Analyzer" },
  { id: "token-locks", name: "Token Locks", description: "Monitor token lock schedules", category: "Security", kind: "advanced", advancedKey: "Token Locks" },
  { id: "rug-detector", name: "Rug Detector", description: "Analyze rug pull risk", category: "Security", kind: "advanced", advancedKey: "Rug Detector" },
  { id: "risk-detector", name: "Risk Detector", description: "Comprehensive risk scoring", category: "Security", kind: "advanced", advancedKey: "Risk Detector" },
  { id: "token-creator", name: "Token Creator Tracker", description: "Track token creator history", category: "Security", kind: "advanced", advancedKey: "Token Creator" },
  { id: "burn-watcher", name: "Burn Watcher", description: "Monitor token burns live", category: "Token", kind: "advanced", advancedKey: "Burn Watcher" },
  { id: "mev-tracker", name: "MEV Tracker", description: "Detect MEV activity", category: "Trading", kind: "advanced", advancedKey: "MEV Tracker" },
  { id: "sol-depletion", name: "SOL Depletion", description: "Low balance warnings", category: "Wallet", kind: "advanced", advancedKey: "SOL Depletion" },
  { id: "wallet-age", name: "Wallet Age", description: "Calculate wallet age & activity", category: "Wallet", kind: "advanced", advancedKey: "Wallet Age" },
  { id: "transfer-profiler", name: "Transfer Profiler", description: "Analyze transfer patterns", category: "Wallet", kind: "advanced", advancedKey: "Transfer Profiler" },
  { id: "wallet-graph", name: "Wallet Graph", description: "Visualize wallet relationships", category: "Wallet", kind: "advanced", advancedKey: "Wallet Graph" },
  { id: "stake-tracker", name: "Stake Tracker", description: "Track staking accounts", category: "DeFi", kind: "advanced", advancedKey: "Stake Tracker" },
  { id: "airdrop-analyzer", name: "Airdrop Analyzer", description: "Check airdrop eligibility", category: "Wallet", kind: "advanced", advancedKey: "Airdrop Analyzer" },
  { id: "multi-wallet", name: "Multi-Wallet Merge", description: "Merge multiple wallet views", category: "Wallet", kind: "advanced", advancedKey: "Multi-Wallet" },

  // ── Platform links & utilities ────────────────────────────────────
  { id: "rescue-console", name: "Rescue Console", description: "Full claim scanner + rent + burn suite", category: "Launchpad", kind: "link", href: "/orbitxlaunch/rescue" },
  { id: "launchpad-claim", name: "Launchpad Claim Desk", description: "Full creator fee claim UI with buyback", category: "Launchpad", kind: "link", href: "/orbitxlaunch/claim" },
  { id: "launchpad-launch", name: "Token Launch", description: "Launch pump or custom Token-2022 coins", category: "Launchpad", kind: "link", href: "/orbitxlaunch" },
  { id: "launch-terminal", name: "Launch Terminal", description: "Dedicated launchpad trading terminal", category: "Launchpad", kind: "link", href: "/terminal" },
  { id: "truth-scanner", name: "Truth Scanner", description: "OG verdict scan for any mint", category: "Security", kind: "link", href: "/intel/scan" },
  { id: "intel-trade", name: "Intel Trade Desk", description: "Crypto intelligence trade desk", category: "Trading", kind: "link", href: "/intel/trade" },
  { id: "intel-whales", name: "Whale Intel", description: "Track large wallet flows", category: "Analytics", kind: "link", href: "/intel/whales" },
  { id: "intel-trending", name: "Trending Intel", description: "Market movers and narrative heat", category: "Analytics", kind: "link", href: "/intel/trending" },
  { id: "intel-portfolio", name: "Portfolio Desk", description: "Intel portfolio overview", category: "Wallet", kind: "link", href: "/intel/portfolio" },
  { id: "orbitx-dex", name: "OrbitX DEX", description: "Full DEX trading experience", category: "Trading", kind: "link", href: "/ORBITX_DEX" },
  { id: "trade-desk", name: "Trade Desk", description: "Open the OrbitX trade desk", category: "Trading", kind: "link", href: "/trade/desk" },
  { id: "trade-alerts", name: "Price Alerts", description: "Limit / TP / stop notify alerts", category: "Trading", kind: "link", href: "/trade/notifications" },
  { id: "markets", name: "Market Screener", description: "Discover pump & curated markets", category: "Trading", kind: "link", href: "/trade" },
  { id: "leaderboard", name: "Trader Board", description: "W/L leaderboard", category: "Platform", kind: "link", href: "/trade/leaderboard" },
  { id: "profile", name: "Trade Profile", description: "Wallet, balances, PnL", category: "Wallet", kind: "link", href: "/trade/profile" },
  { id: "advanced-tools-hub", name: "DEX Tools Hub", description: "OrbitX DEX tools & utilities", category: "Platform", kind: "link", href: "/ORBITX_DEX/tools" },
  { id: "tools-page", name: "Solana Tools", description: "DEX tool rack & scanners", category: "Platform", kind: "link", href: "/ORBITX_DEX/tools" },
  { id: "social-hq", name: "Social HQ", description: "OrbitX social feed & spaces", category: "Platform", kind: "link", href: "/hq" },
  { id: "orbitx-os", name: "OrbitX OS", description: "Desktop OS shell", category: "Platform", kind: "link", href: "/os" },
  { id: "orbitx-city", name: "OrbitX City", description: "3D city playground", category: "Platform", kind: "link", href: "/Orbitxcity" },
  { id: "play", name: "Play Arena", description: "Games and arcade", category: "Platform", kind: "link", href: "/play" },
  { id: "predictions", name: "Prediction Markets", description: "OrbitX prediction markets", category: "Platform", kind: "link", href: "/predictions" },
  { id: "sentiment", name: "Sentiment Intel", description: "Market sentiment dashboard", category: "Analytics", kind: "link", href: "/intel/sentiment" },
  { id: "launch-studio", name: "Launch Studio", description: "Intel launch studio", category: "Launchpad", kind: "link", href: "/intel/launch" },
  { id: "nft-hub", name: "NFT Hub", description: "NFT collections & burn/transfer", category: "Token", kind: "link", href: "/nft" },
  { id: "agent-sign", name: "Agent Sign", description: "Sign MCP-prepared burn / rent / claim txs", category: "Wallet", kind: "link", href: "/agent/sign" },
];

export const TOOL_COUNT = TRADE_TOOLS.length;
