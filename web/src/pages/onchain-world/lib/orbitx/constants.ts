import type {
  BreakdownSlice,
  DashboardSnapshot,
  EventKind,
  TickerStats,
} from "./types";

export const APP_NAME = "OrbitX On-Chain";
export const APP_VERSION = "v1.0.0";

export const EMPTY_TICKER: TickerStats = {
  block: null,
  blockAgeSec: null,
  eventsPerSec: null,
  txPerMin: null,
  buys: null,
  sells: null,
  swaps: null,
  transfers: null,
  burns: null,
  kolEvents: null,
  orbitxBuys: null,
  orbitxSells: null,
  orbitxBuys24h: null,
  orbitxSells24h: null,
  orbitxTraders24h: null,
  orbitxBurned: null,
  whaleActivityUsd: null,
  activeWallets: null,
};

export const EMPTY_BREAKDOWN: BreakdownSlice[] = [
  { key: "buy", label: "BUY", pct: 0 },
  { key: "sell", label: "SELL", pct: 0 },
  { key: "swap", label: "SWAP", pct: 0 },
  { key: "transfer", label: "TRANSFER", pct: 0 },
  { key: "burn", label: "BURN", pct: 0 },
  { key: "other", label: "OTHER", pct: 0 },
];

export const EMPTY_SNAPSHOT: DashboardSnapshot = {
  ticker: EMPTY_TICKER,
  events: [],
  breakdown: EMPTY_BREAKDOWN,
  transactions: [],
  eventRate: [],
  wallet: null,
  network: {
    name: "Solana Mainnet",
    rpc: "idle",
    lastIndexedBlock: null,
    indexingDelaySec: null,
    ws: "disconnected",
    version: APP_VERSION,
  },
};

export const EVENT_META: Record<
  EventKind,
  { label: string; tone: "buy" | "sell" | "burn" | "transfer" | "whale" | "launch" | "dim"; short: string }
> = {
  kol_buy: { label: "KOL BUY", tone: "sell", short: "KOL" },
  kol_sell: { label: "KOL SELL", tone: "whale", short: "KOL" },
  orbitx_buy: { label: "ORBITX BUY", tone: "buy", short: "BUY" },
  orbitx_sell: { label: "ORBITX SELL", tone: "sell", short: "SELL" },
  orbitx_burn: { label: "ORBITX BURN", tone: "burn", short: "BURN" },
  sol_transfer: { label: "SOL TRANSFER", tone: "transfer", short: "XFER" },
  whale_sell: { label: "WHALE SELL", tone: "whale", short: "WHALE" },
  token_buy: { label: "BUY", tone: "buy", short: "BUY" },
  token_sell: { label: "SELL", tone: "sell", short: "SELL" },
  token_swap: { label: "SWAP", tone: "transfer", short: "SWAP" },
  token_launch: { label: "TOKEN LAUNCH", tone: "launch", short: "LAUNCH" },
  liquidity_add: { label: "LIQUIDITY ADD", tone: "launch", short: "LP" },
  other: { label: "OTHER", tone: "dim", short: "OTHER" },
};

export const ALL_EVENT_KINDS = Object.keys(EVENT_META) as EventKind[];

export const WORLD_NODES = [
  {
    id: "jupiter",
    label: "JUPITER",
    sub: "DEX",
    x: 33,
    y: 26,
    tone: "accent",
  },
  {
    id: "raydium",
    label: "RAYDIUM",
    sub: "DEX",
    x: 18,
    y: 60,
    tone: "whale",
  },
  {
    id: "orbitx",
    label: "ORBITX",
    sub: null,
    x: 47,
    y: 48,
    tone: "accent",
    hub: true,
  },
  {
    id: "pumpfun",
    label: "PUMP.FUN",
    sub: "LAUNCHPAD",
    x: 78,
    y: 73,
    tone: "buy",
  },
] as const;

export const TOKEN_PADS = [
  { id: "wif", label: "$WIF", src: "/tokens/wif.jpg", x: 50, y: 21 },
  { id: "bonk", label: "$BONK", src: "/tokens/bonk.jpg", x: 66, y: 20 },
  { id: "steve", label: "$STEVE", src: "/tokens/steve.jpg", x: 80, y: 42 },
] as const;

export const TRAILS: Array<[string, string, "cyan" | "buy" | "accent"]> = [
  ["orbitx", "jupiter", "cyan"],
  ["orbitx", "raydium", "accent"],
  ["orbitx", "pumpfun", "buy"],
];
