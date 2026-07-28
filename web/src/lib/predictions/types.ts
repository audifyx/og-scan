export type PredCategory = "crypto" | "meme" | "macro" | "politics" | "sports" | "orbitx" | "other";
export type PredStatus = "open" | "closed" | "resolved";
export type PredSide = "yes" | "no";
export type PredAction = "buy" | "sell";

export interface PredMarket {
  id: string;
  slug: string | null;
  question: string;
  description: string;
  category: PredCategory;
  image_url: string | null;
  status: PredStatus;
  resolution: "yes" | "no" | "void" | null;
  resolves_at: string | null;
  yes_pool: number;
  no_pool: number;
  volume_usdc: number;
  traders_count: number;
  featured: boolean;
  created_at: string;
}

export interface PredPortfolio {
  user_id: string;
  usdc_balance: number;
  initial_balance: number;
  total_trades: number;
  realized_pnl: number;
}

export interface PredPosition {
  id: string;
  user_id: string;
  market_id: string;
  side: PredSide;
  shares: number;
  avg_price: number;
  cost_basis: number;
  market?: PredMarket;
}

export interface PredTrade {
  id: string;
  market_id: string;
  side: PredSide;
  action: PredAction;
  shares: number;
  price: number;
  amount_usdc: number;
  created_at: string;
  market?: PredMarket;
}

export const PRED_CATEGORIES: { id: PredCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "crypto", label: "Crypto" },
  { id: "meme", label: "Meme" },
  { id: "macro", label: "Macro" },
  { id: "orbitx", label: "OrbitX" },
  { id: "politics", label: "Politics" },
  { id: "sports", label: "Sports" },
];

export function yesPrice(m: Pick<PredMarket, "yes_pool" | "no_pool">): number {
  const t = m.yes_pool + m.no_pool;
  return t > 0 ? m.no_pool / t : 0.5;
}

export function noPrice(m: Pick<PredMarket, "yes_pool" | "no_pool">): number {
  return 1 - yesPrice(m);
}

export function fmtCents(p: number): string {
  return `${Math.round(p * 100)}¢`;
}

export function fmtUsd(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  }
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
