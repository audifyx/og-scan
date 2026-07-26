/**
 * OrbitX World — shared API DTO contracts (backend).
 * Frontend may import types only; no React here.
 */

export type OxwCityId = "nyc" | "miami" | "la" | "boston" | string;

export interface OxwProgression {
  user_id: string;
  xp: number;
  level: number;
  title: string;
  prestige: number;
  updated_at: string;
}

export interface OxwLobby {
  id: string;
  channel_id: string;
  label: string;
  city_id: OxwCityId;
  visibility: "public" | "private" | "friends";
  max_players: number;
  player_count: number;
  status: "open" | "full" | "closed" | "archived";
  created_at: string;
}

export interface OxwTradeRecordRequest {
  wallet: string;
  side: "buy" | "sell" | "swap";
  inputMint: string;
  outputMint: string;
  inputAmount: number | string;
  outputAmount: number | string;
  signature: string;
  venue?: "jupiter" | "pumpfun" | "raydium" | "orbitx" | "other";
  priceUsd?: number;
  valueUsd?: number;
  meta?: Record<string, unknown>;
}

export interface OxwTokenIntel {
  mint: string;
  chain: string;
  symbol?: string | null;
  name?: string | null;
  risk_score?: number | null;
  risk_flags: unknown[];
  holder_count?: number | null;
  top10_pct?: number | null;
  liquidity_usd?: number | null;
  mcap_usd?: number | null;
  dev_wallet?: string | null;
  last_scanned_at: string;
}

export interface OxwApiError {
  error: string;
  retryAfter?: number;
  route?: string;
}
