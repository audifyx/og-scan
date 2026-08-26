export type EventKind =
  | "kol_buy"
  | "orbitx_buy"
  | "sol_transfer"
  | "orbitx_burn"
  | "whale_sell"
  | "token_launch"
  | "liquidity_add"
  | "other";

export type BreakdownKey = "buy" | "transfer" | "sell" | "orbitx" | "burn" | "other";

export type LiveEvent = {
  id: string;
  kind: EventKind;
  title: string;
  token?: string;
  tokenName?: string | null;
  tokenImage?: string | null;
  mint?: string | null;
  amountLabel?: string;
  usd?: number | null;
  detail?: string;
  wallet?: string;
  ts: number;
};

export type TickerStats = {
  block: number | null;
  blockAgeSec: number | null;
  eventsPerSec: number | null;
  txPerMin: number | null;
  orbitxBuys: number | null;
  orbitxBurned: number | null;
  whaleActivityUsd: number | null;
  activeWallets: number | null;
};

export type TransactionRow = {
  id: string;
  time: string;
  kind: EventKind;
  wallet: string;
  token: string;
  amount: string;
  usd: number | null;
  signature: string;
};

export type WalletBalance = {
  symbol: string;
  mint?: string;
  name?: string | null;
  amount: number | null;
  usd: number | null;
  icon?: string;
  banner?: string;
};

export type Counterparty = {
  address: string;
  txs: number;
  sol: number;
};

export type WalletSnapshot = {
  address: string;
  tracked: boolean;
  balances: WalletBalance[];
  totalTransactions: number | null;
  solReceived: number | null;
  solSent: number | null;
  tokensTraded: number | null;
  firstSeen: string | null;
  walletAgeDays: number | null;
  orbitxPurchasedUsd: number | null;
  orbitxSoldUsd: number | null;
  orbitxBurned: number | null;
  orbitxHoldings: number | null;
  orbitxAvgBuy: number | null;
  activity: number[];
  counterparties: Counterparty[];
};

export type BreakdownSlice = {
  key: BreakdownKey;
  label: string;
  pct: number;
};

export type EventRatePoint = {
  t: string;
  v: number;
};

export type RpcStatus = "healthy" | "degraded" | "down" | "idle";
export type WsStatus = "connected" | "disconnected";

export type NetworkStatus = {
  name: string;
  rpc: RpcStatus;
  lastIndexedBlock: number | null;
  indexingDelaySec: number | null;
  ws: WsStatus;
  version: string;
  live?: boolean;
  liveLabel?: string;
  liveReason?: string | null;
};

export type DashboardSnapshot = {
  ticker: TickerStats;
  events: LiveEvent[];
  breakdown: BreakdownSlice[];
  transactions: TransactionRow[];
  eventRate: EventRatePoint[];
  wallet: WalletSnapshot | null;
  network: NetworkStatus;
};

export type CenterView =
  | "world"
  | "terminal"
  | "map"
  | "orbitx"
  | "wallets"
  | "analytics";

export type BottomTab =
  | "recent"
  | "orbitx_activity"
  | "whale"
  | "kol"
  | "wallets";

export type ViewOptions = {
  labels: boolean;
  trails: boolean;
  figures: boolean;
  grid: boolean;
};

export type CameraState = {
  x: number;
  y: number;
  zoom: number;
};
