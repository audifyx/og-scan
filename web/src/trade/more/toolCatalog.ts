/**
 * Trade More — curated tools (no duplicates).
 */
import { ORBITX_PREDICTIONS_URL } from "../../../shared/orbitx-predictions.js";


export type ToolKind = "panel" | "advanced" | "link";

export type TradeTool = {
  id: string;
  name: string;
  description: string;
  category: string;
  kind: ToolKind;
  advancedKey?: string;
  href?: string;
  featured?: boolean;
};

export const TOOL_CATEGORIES = [
  "Actions",
  "Analytics",
  "Security",
  "Wallet",
  "Launchpad",
  "Platform",
] as const;

export const TRADE_TOOLS: TradeTool[] = [
  // Actions (interactive)
  {
    id: "rent-refund",
    name: "Rent Refund",
    description: "Close empty ATAs and reclaim SOL rent",
    category: "Actions",
    kind: "panel",
    featured: true,
  },
  {
    id: "creator-fee-claim",
    name: "Creator Fee Claim",
    description: "Claim pump + custom-lane creator fees",
    category: "Actions",
    kind: "panel",
    featured: true,
  },
  {
    id: "token-burner",
    name: "Token Burner",
    description: "Burn holdings; reclaim rent when emptied",
    category: "Actions",
    kind: "panel",
    featured: true,
  },
  {
    id: "unwrap-wsol",
    name: "Unwrap wSOL",
    description: "Close wrapped SOL accounts",
    category: "Actions",
    kind: "panel",
  },

  // Analytics
  { id: "token-sniper", name: "Token Sniper", description: "Detect new launches", category: "Analytics", kind: "advanced", advancedKey: "Token Sniper" },
  { id: "jupiter-routes", name: "Jupiter Routes", description: "Swap routes & slippage", category: "Analytics", kind: "advanced", advancedKey: "Jupiter Routes" },
  { id: "liquidity-sniper", name: "Liquidity Sniper", description: "New pool snipes", category: "Analytics", kind: "advanced", advancedKey: "Liquidity Sniper" },
  { id: "profit-curve", name: "Profit Curve", description: "PnL curves over time", category: "Analytics", kind: "advanced", advancedKey: "Profit Curve" },
  { id: "trading-style", name: "Trading Style", description: "Classify wallet patterns", category: "Analytics", kind: "advanced", advancedKey: "Trading Style" },
  { id: "holder-analysis", name: "Holder Analysis", description: "Holder concentration", category: "Analytics", kind: "advanced", advancedKey: "Holder Analysis" },
  { id: "liquidity-scanner", name: "Liquidity Scanner", description: "Pool depth scan", category: "Analytics", kind: "advanced", advancedKey: "Liquidity Scanner" },
  { id: "token-metadata", name: "Token Metadata", description: "On-chain metadata", category: "Analytics", kind: "advanced", advancedKey: "Token Metadata" },
  { id: "whale-concentration", name: "Whale Concentration", description: "Whale holdings", category: "Analytics", kind: "advanced", advancedKey: "Whale Concentration" },
  { id: "mev-tracker", name: "MEV Tracker", description: "MEV activity", category: "Analytics", kind: "advanced", advancedKey: "MEV Tracker" },
  { id: "fee-analyzer", name: "Fee Analyzer", description: "Fee breakdowns", category: "Analytics", kind: "advanced", advancedKey: "Fee Analyzer" },
  { id: "program-monitor", name: "Program Monitor", description: "DEX program activity", category: "Analytics", kind: "advanced", advancedKey: "Program Monitor" },
  { id: "lp-scanner", name: "LP Scanner", description: "LP positions & yields", category: "Analytics", kind: "advanced", advancedKey: "LP Scanner" },
  { id: "staking-calc", name: "Staking Calculator", description: "Staking rewards", category: "Analytics", kind: "advanced", advancedKey: "Staking Calculator" },
  { id: "impermanent-loss", name: "Impermanent Loss", description: "IL calculator", category: "Analytics", kind: "advanced", advancedKey: "Impermanent Loss" },

  // Security
  { id: "rug-detector", name: "Rug Detector", description: "Rug risk score", category: "Security", kind: "advanced", advancedKey: "Rug Detector" },
  { id: "risk-detector", name: "Risk Detector", description: "Risk scoring", category: "Security", kind: "advanced", advancedKey: "Risk Detector" },
  { id: "token-creator", name: "Creator Tracker", description: "Creator history", category: "Security", kind: "advanced", advancedKey: "Token Creator" },
  { id: "wash-trading", name: "Wash Trading", description: "Wash patterns", category: "Security", kind: "advanced", advancedKey: "Wash Trading" },
  { id: "insider-detector", name: "Insider Detector", description: "Insider patterns", category: "Security", kind: "advanced", advancedKey: "Insider Detector" },
  { id: "token-locks", name: "Token Locks", description: "Lock schedules", category: "Security", kind: "advanced", advancedKey: "Token Locks" },
  { id: "burn-watcher", name: "Burn Watcher", description: "Live burns", category: "Security", kind: "advanced", advancedKey: "Burn Watcher" },
  { id: "truth-scanner", name: "Truth Scanner", description: "OG verdict scan", category: "Security", kind: "link", href: "/intel/scan" },

  // Wallet
  { id: "wallet-profiler", name: "Wallet Profiler", description: "Wallet performance", category: "Wallet", kind: "advanced", advancedKey: "Wallet Profiler" },
  { id: "wallet-age", name: "Wallet Age", description: "Age & activity", category: "Wallet", kind: "advanced", advancedKey: "Wallet Age" },
  { id: "transfer-profiler", name: "Transfer Profiler", description: "Transfer patterns", category: "Wallet", kind: "advanced", advancedKey: "Transfer Profiler" },
  { id: "wallet-graph", name: "Wallet Graph", description: "Relationships", category: "Wallet", kind: "advanced", advancedKey: "Wallet Graph" },
  { id: "multi-wallet", name: "Multi-Wallet", description: "Merge wallet views", category: "Wallet", kind: "advanced", advancedKey: "Multi-Wallet" },
  { id: "sol-depletion", name: "SOL Depletion", description: "Low balance alerts", category: "Wallet", kind: "advanced", advancedKey: "SOL Depletion" },
  { id: "airdrop-analyzer", name: "Airdrop Analyzer", description: "Airdrop eligibility", category: "Wallet", kind: "advanced", advancedKey: "Airdrop Analyzer" },
  { id: "stake-tracker", name: "Stake Tracker", description: "Stake accounts", category: "Wallet", kind: "advanced", advancedKey: "Stake Tracker" },

  // Launchpad
  { id: "rescue-console", name: "Rescue Console", description: "Full rent + burn suite", category: "Launchpad", kind: "link", href: "/orbitxlaunch/rescue" },
  { id: "launchpad-claim", name: "Claim Desk", description: "Creator fee claim UI", category: "Launchpad", kind: "link", href: "/orbitxlaunch/claim" },
  { id: "launchpad-launch", name: "Token Launch", description: "Launch pump / custom", category: "Launchpad", kind: "link", href: "/orbitxlaunch" },
  { id: "launch-terminal", name: "Launch Terminal", description: "Launch trading terminal", category: "Launchpad", kind: "link", href: "/terminal" },

  // Platform (unique destinations only)
  { id: "orbitx-dex", name: "OrbitX DEX", description: "Full DEX experience", category: "Platform", kind: "link", href: "/ORBITX_DEX" },
  { id: "dex-tools", name: "DEX Tools", description: "DEX tool rack", category: "Platform", kind: "link", href: "/ORBITX_DEX/tools" },
  { id: "intel-whales", name: "Whale Intel", description: "Large wallet flows", category: "Platform", kind: "link", href: "/intel/whales" },
  { id: "social-hq", name: "Social HQ", description: "OrbitX social", category: "Platform", kind: "link", href: "/hq" },
  { id: "orbitx-city", name: "OrbitX City", description: "3D city", category: "Platform", kind: "link", href: "/Orbitxcity" },
  { id: "predictions", name: "Predictions", description: "Prediction markets", category: "Platform", kind: "link", href: ORBITX_PREDICTIONS_URL },
];

export const TOOL_COUNT = TRADE_TOOLS.length;
